#!/usr/bin/env python3
"""James's YouTube progress tracker. Daily snapshot of each channel and every upload, appended to a
per-channel ledger, then a delta report (vs the previous snapshot and vs ~7 days ago) to Discord #intel:
one message, one embed per channel, same block format for every channel.

  yt_track.py                    snapshot every channel + print + post
  yt_track.py --channel KEY      only that channel (repeatable; keys below)
  yt_track.py --no-post          snapshot + ledger + print, no post
  yt_track.py --dry-run          snapshot + print the would-be post; no ledger write, no post
  yt_track.py --report           print the report from the ledgers, no API call

Channels (CHANNELS below): passionate-learning (@PassionateLearningHQ), many-roads (@playmanyroads),
watchmeplay2d (WatchMePlay2D, handle @watchmeplay14). A channel with its own OAuth token is read as its
owner (private + scheduled uploads show). One without a token is read publicly through any working token
and its block says "(public view: no channel token)" once; private/scheduled uploads are invisible there.

Ledgers: ~/.claude/state/youtube-<key>.jsonl (one JSON row per snapshot).
Fails loud: an API error, a token for the wrong channel, or a snapshot that drops videos or views
the previous one had exits non-zero and posts to #alerts. It never writes a zero it did not measure.
Run with ~/.local/share/many-roads-growth/venv/bin/python (google-api-python-client lives there).
"""
import argparse, json, os, sys, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SECRETS = Path.home() / '.secrets'
STATE = Path.home() / '.claude/state'
CHANNELS = [
    {'key': 'passionate-learning', 'name': 'Passionate Learning', 'handle': '@PassionateLearningHQ',
     'id': 'UCuOGggeRly1PMGhNIB-JmVw', 'token': 'youtube-token-passionate-learning.json', 'color': 0x7C4DFF},
    {'key': 'many-roads', 'name': 'Many Roads Game', 'handle': '@playmanyroads',
     'id': 'UC0uo4EuWaUgZFTsH4HsOCvg', 'token': 'youtube-token.json', 'color': 0xFF7043},
    # Title is WatchMePlay2D; the handle is @watchmeplay14 (verified via channels.list forHandle, 2026-10-08).
    {'key': 'watchmeplay2d', 'name': 'WatchMePlay2D', 'handle': '@watchmeplay14',
     'id': 'UCcqHLdd8nF3PVMWpvTxiCIQ', 'token': None, 'color': 0x26A69A},
]
PUBLIC_NOTE = '(public view: no channel token)'


def ledger_path(ch):
    if ch['key'] == 'passionate-learning' and os.environ.get('YT_LEDGER'):
        return Path(os.environ['YT_LEDGER'])
    return Path(os.environ.get('YT_LEDGER_DIR', STATE)) / f"youtube-{ch['key']}.jsonl"


def webhook(name):
    try:
        return json.loads((SECRETS / 'discord-webhooks.json').read_text())[name]
    except Exception:
        return None


def send(name, payload):
    url = webhook(name)
    if not url or not url.startswith('https://discord.com/'):
        print(f'[no {name} webhook; not posted]', file=sys.stderr)
        return False
    req = urllib.request.Request(url, json.dumps(payload).encode(),
                                 {'Content-Type': 'application/json', 'User-Agent': 'yt_track.py'})
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        print(f'discord post failed: {e}', file=sys.stderr)
        return False


def embed(title, text, color, footer):
    return {'title': title, 'description': text[:3800], 'color': color, 'footer': {'text': footer}}


def alert(ch, msg, no_post):
    print(f"ERROR [{ch['key']}]: {msg}", file=sys.stderr)
    if not no_post:
        send('alerts', {'embeds': [embed(f"{ch['name']} YouTube tracker FAILED", msg, 0xE53935,
                                         f"yt_track.py · {ch['handle']}")]})


def creds(token_file):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    p = SECRETS / token_file
    if not p.exists():
        raise RuntimeError(f'no token at {p}: run tools/yt.py auth')
    c = Credentials.from_authorized_user_file(str(p))
    if not c.valid:
        c.refresh(Request()); p.write_text(c.to_json()); os.chmod(p, 0o600)
    return c


def reader():
    """Any working token, for public reads of a channel that has none of its own."""
    errs = []
    for ch in CHANNELS:
        if ch['token']:
            try:
                return creds(ch['token'])
            except Exception as e:
                errs.append(f"{ch['token']}: {e}")
    raise RuntimeError('no usable YouTube token for a public read: ' + '; '.join(errs))


def snapshot(ch):
    from googleapiclient.discovery import build
    owner = bool(ch['token'])
    y = build('youtube', 'v3', credentials=creds(ch['token']) if owner else reader(), cache_discovery=False)
    if owner:
        items = y.channels().list(part='snippet,statistics,contentDetails', mine=True).execute().get('items', [])
        c = next((i for i in items if i['id'] == ch['id']), None)
        if not c:
            raise RuntimeError(f"token acts for {[i['snippet']['title'] for i in items]}, not {ch['name']}")
    else:
        items = y.channels().list(part='snippet,statistics,contentDetails', id=ch['id']).execute().get('items', [])
        if not items:
            raise RuntimeError(f"channel {ch['id']} not returned by the API")
        c = items[0]
    uploads = c['contentDetails']['relatedPlaylists']['uploads']
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
    s = c['statistics']
    return {'at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'channel_id': c['id'],
            'view': 'owner' if owner else 'public',
            'subscribers': int(s.get('subscriberCount', 0)), 'views': int(s.get('viewCount', 0)),
            'video_count': int(s.get('videoCount', 0)), 'videos': videos}


def load(ch):
    p = ledger_path(ch)
    if not p.exists(): return []
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


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
    lines = [PUBLIC_NOTE] if cur.get('view') == 'public' else []
    lines.append(f"**Subscribers** {cur['subscribers']}{d(cur['subscribers'], prev and prev['subscribers'])}"
                 f" · **Views** {cur['views']}{d(cur['views'], prev and prev['views'])}"
                 f" · **Videos** {cur['video_count']}{d(cur['video_count'], prev and prev['video_count'])}")
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
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--channel', action='append', choices=[c['key'] for c in CHANNELS])
    a = ap.parse_args()
    quiet = a.no_post or a.dry_run
    chans = [c for c in CHANNELS if not a.channel or c['key'] in a.channel]
    embeds, failed = [], 0
    for ch in chans:
        rows = load(ch)
        if a.report:
            if not rows:
                print(f"[{ch['key']}] ledger empty: {ledger_path(ch)}", file=sys.stderr); failed += 1; continue
            print(f"== {ch['name']} YouTube\n{report(rows)}\n"); continue
        try:
            cur = snapshot(ch)
        except Exception as e:
            alert(ch, f'snapshot failed: {e}', quiet); failed += 1; continue
        if not cur['videos'] and cur['video_count'] and cur['view'] == 'owner':
            # A public read legitimately lists fewer uploads than the count (private/unlisted); owner reads must not.
            alert(ch, f"channel says {cur['video_count']} videos but the uploads list returned none", quiet)
            failed += 1; continue
        bad = check(cur, rows[-1] if rows else None)
        if not a.dry_run:
            p = ledger_path(ch); p.parent.mkdir(parents=True, exist_ok=True)
            with p.open('a') as f: f.write(json.dumps(cur) + '\n')
        text = report(rows + [cur])
        title = f"{ch['name']} YouTube · {cur['at'][:10]}"
        print(f"== {title}\n{text}\n")
        if bad:
            alert(ch, bad + ('' if a.dry_run else ' (row kept in the ledger for forensics)'), quiet)
            failed += 1; continue
        embeds.append(embed(title, text, ch['color'], f"yt_track.py · {ch['handle']}"))
    if embeds and a.dry_run:
        print(f"[DRY-RUN] would post 1 message with {len(embeds)} embed(s) to #intel; nothing posted, no ledger written")
    elif embeds and not a.no_post:
        cap = min(3800, 5400 // len(embeds))  # Discord: 6000 chars across all embeds of one message
        for e in embeds:
            if len(e['description']) > cap:
                e['description'] = e['description'][:cap].rsplit('\n', 1)[0] + '\n…'
        send('intel', {'embeds': embeds[:10]})
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
