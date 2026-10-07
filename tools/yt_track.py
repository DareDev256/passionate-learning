#!/usr/bin/env python3
"""Passionate Learning YouTube progress tracker. Daily snapshot of the channel and every upload,
appended to a ledger, then a delta report (vs the previous snapshot and vs ~7 days ago) to Discord #intel.

  yt_track.py              snapshot + print + post
  yt_track.py --no-post    snapshot + print only
  yt_track.py --report     print the report from the ledger, no API call

Ledger: ~/.claude/state/youtube-passionate-learning.jsonl (one JSON row per snapshot).
Fails loud: an API error, a token for the wrong channel, or a snapshot that drops videos or views
the previous one had exits non-zero and posts to #alerts. It never writes a zero it did not measure.
Run with ~/.local/share/many-roads-growth/venv/bin/python (google-api-python-client lives there).
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SECRETS = Path.home() / '.secrets'
TOKEN = SECRETS / 'youtube-token-passionate-learning.json'
SCOPES = ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload']
NAME = 'Passionate Learning'
LEDGER = Path(os.environ.get('YT_LEDGER', Path.home() / '.claude/state/youtube-passionate-learning.jsonl'))


def webhook(name):
    try:
        return json.loads((SECRETS / 'discord-webhooks.json').read_text())[name]
    except Exception:
        return None


def post(name, title, text, color):
    url = webhook(name)
    if not url or not url.startswith('https://discord.com/'):
        print(f'[no {name} webhook; not posted]', file=sys.stderr)
        return False
    body = json.dumps({'embeds': [{'title': title, 'description': text[:3800], 'color': color,
                                   'footer': {'text': 'yt_track.py · @PassionateLearningHQ'}}]}).encode()
    req = urllib.request.Request(url, body, {'Content-Type': 'application/json', 'User-Agent': 'yt_track.py'})
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        print(f'discord post failed: {e}', file=sys.stderr)
        return False


def fail(msg, no_post):
    print(f'ERROR: {msg}', file=sys.stderr)
    if not no_post:
        post('alerts', 'Passionate Learning YouTube tracker FAILED', msg, 0xE53935)
    sys.exit(1)


def snapshot():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    if not TOKEN.exists():
        raise RuntimeError(f'no token at {TOKEN}: run tools/yt.py auth')
    c = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not c.valid:
        c.refresh(Request()); TOKEN.write_text(c.to_json()); os.chmod(TOKEN, 0o600)
    y = build('youtube', 'v3', credentials=c, cache_discovery=False)
    items = y.channels().list(part='snippet,statistics,contentDetails', mine=True).execute().get('items', [])
    ch = next((i for i in items if i['snippet']['title'] == NAME), None)
    if not ch:
        raise RuntimeError(f'token acts for {[i["snippet"]["title"] for i in items]}, not {NAME}')
    uploads = ch['contentDetails']['relatedPlaylists']['uploads']
    ids, tok = [], None
    while True:
        r = y.playlistItems().list(part='contentDetails', playlistId=uploads, maxResults=50, pageToken=tok).execute()
        ids += [i['contentDetails']['videoId'] for i in r.get('items', [])]
        tok = r.get('nextPageToken')
        if not tok: break
    videos = []
    for i in range(0, len(ids), 50):
        r = y.videos().list(part='snippet,statistics,status,contentDetails', id=','.join(ids[i:i + 50])).execute()
        for v in r.get('items', []):
            st = v.get('statistics', {})
            videos.append({'id': v['id'], 'title': v['snippet']['title'],
                           'published': v['snippet'].get('publishedAt'),
                           'privacy': v['status'].get('privacyStatus'),
                           'publish_at': v['status'].get('publishAt'),
                           'duration': v['contentDetails'].get('duration'),
                           'views': int(st.get('viewCount', 0)), 'likes': int(st.get('likeCount', 0)),
                           'comments': int(st.get('commentCount', 0))})
    s = ch['statistics']
    return {'at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'channel_id': ch['id'],
            'subscribers': int(s.get('subscriberCount', 0)), 'views': int(s.get('viewCount', 0)),
            'video_count': int(s.get('videoCount', 0)), 'videos': videos}


def load():
    if not LEDGER.exists(): return []
    return [json.loads(l) for l in LEDGER.read_text().splitlines() if l.strip()]


def baseline(rows, now, days):
    """Latest row at least `days` old (falls back to the oldest row)."""
    cut = now - timedelta(days=days) + timedelta(hours=2)
    old = [r for r in rows if datetime.fromisoformat(r['at']) <= cut]
    return old[-1] if old else (rows[0] if rows else None)


def d(a, b): return '' if b is None else f' ({a - b:+d})'


def report(rows):
    cur = rows[-1]; prev = rows[-2] if len(rows) > 1 else None
    now = datetime.fromisoformat(cur['at'])
    wk = baseline(rows[:-1], now, 7) if len(rows) > 1 else None
    pv = {v['id']: v for v in (prev or {}).get('videos', [])}
    wv = {v['id']: v for v in (wk or {}).get('videos', [])}
    lines = [f"**Subscribers** {cur['subscribers']}{d(cur['subscribers'], prev and prev['subscribers'])}"
             f" · **Views** {cur['views']}{d(cur['views'], prev and prev['views'])}"
             f" · **Videos** {cur['video_count']}{d(cur['video_count'], prev and prev['video_count'])}"]
    if wk:
        lines.append(f"7d: subs {cur['subscribers'] - wk['subscribers']:+d}, views {cur['views'] - wk['views']:+d}"
                     f" (since {wk['at'][:10]})")
    else:
        lines.append('7d: no baseline yet (first snapshot)')
    vids = sorted(cur['videos'], key=lambda v: v['views'], reverse=True)
    lines.append('')
    for v in vids:
        if v['privacy'] != 'public':
            when = f" → {v['publish_at'][:16].replace('T', ' ')}Z" if v.get('publish_at') else ''
            lines.append(f"⏳ {v['title'][:60]} ({v['privacy']}{when})")
            continue
        p = pv.get(v['id']); w = wv.get(v['id'])
        new = ' 🆕' if prev and not p else ''
        week = f", 7d {v['views'] - w['views']:+d}" if w else ''
        lines.append(f"{v['views']:>5} views{d(v['views'], p and p['views'])}{week}"
                     f" · {v['likes']}♥ {v['comments']}💬 · {v['title'][:60]}{new}")
    return '\n'.join(lines)


def check(cur, prev):
    """Refuse a snapshot that loses what the last one measured — that is a broken read, not a trend."""
    if not prev: return None
    if cur['video_count'] < prev['video_count'] and len(cur['videos']) < len(prev['videos']):
        return f"video count fell {prev['video_count']} -> {cur['video_count']} (deleted, or a bad read)"
    if cur['views'] + 5 < prev['views']:
        return f"channel views fell {prev['views']} -> {cur['views']}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-post', action='store_true'); ap.add_argument('--report', action='store_true')
    a = ap.parse_args()
    rows = load()
    if a.report:
        if not rows: fail(f'ledger empty: {LEDGER}', True)
        print(report(rows)); return
    try:
        cur = snapshot()
    except Exception as e:
        fail(f'snapshot failed: {e}', a.no_post)
    if not cur['videos'] and cur['video_count']:
        fail(f"channel says {cur['video_count']} videos but the uploads list returned none", a.no_post)
    bad = check(cur, rows[-1] if rows else None)
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open('a') as f: f.write(json.dumps(cur) + '\n')
    text = report(rows + [cur])
    print(text)
    if bad:
        fail(bad + ' (row kept in the ledger for forensics)', a.no_post)
    if not a.no_post:
        post('intel', f"Passionate Learning YouTube · {cur['at'][:10]}", text, 0x7C4DFF)


if __name__ == '__main__':
    main()
