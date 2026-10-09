#!/usr/bin/env python3
"""Upload queue for the Passionate Learning channel: drains ~/Creative/ai-for-idiots-channel/upload-queue.jsonl at the
pace YouTube allows. New channels get a daily upload cap ("uploadLimitExceeded"); this exists so a batch never needs
James to remember to come back.

Each queue line: {"ep","mp4","title","description_file","tags","privacy","publish_at","playlist",
                  optional "thumb", optional "replace": "<old video id to delete once the new one reads back>"}
Done lines are appended to upload-queue.done.jsonl ({"ep","id","at"}), so a re-run never double-uploads.

A Short whose slot has passed is re-slotted to the next free 08/12/19 ET slot (logged), never published late silently.
Exit codes: 0 queue drained or nothing due · 75 stopped at the cap with items left (normal, retried next run)
            1 something is wrong: a slot that has already passed, a failed read-back, a missing file. Posts to #alerts.
The cap is not an alert by itself; a cap that will make a slot miss IS (any pending slot within 6 h).
Run with ~/.local/share/many-roads-growth/venv/bin/python. --dry-run lists what it would do.
"""
import json, sys, time, datetime as dt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from yt_track import send, embed  # one Discord path for the channel tools
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError, ResumableUploadError

import os
KIT = Path(os.environ.get('YT_QUEUE_DIR', Path.home() / 'Creative/ai-for-idiots-channel'))
QUEUE, DONE = KIT / 'upload-queue.jsonl', KIT / 'upload-queue.done.jsonl'
TOKEN = Path.home() / '.secrets/youtube-token-passionate-learning.json'
DRY = '--dry-run' in sys.argv
now = dt.datetime.now(dt.timezone.utc)

def read(p): return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []
def at(s): return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
def alert(title, msg):
    print(f'ALERT {title}: {msg}')
    if not DRY: send('alerts', {'embeds': [embed(title, msg, 0xE53935, 'tools/yt_queue.py')]})

done = {d['ep'] for d in read(DONE)}
pending = [q for q in read(QUEUE) if q['ep'] not in done]
if not pending: print('queue empty'); sys.exit(0)
pending.sort(key=lambda q: q.get('publish_at') or '9999')  # unscheduled (unlisted longs awaiting James) go last
c = Credentials.from_authorized_user_file(str(TOKEN))
if not c.valid: c.refresh(Request())
y = build('youtube', 'v3', credentials=c, cache_discovery=False)
me = y.channels().list(part='snippet,contentDetails', mine=True).execute()['items'][0]
if me['snippet']['title'] != 'Passionate Learning': sys.exit(f"refusing: token acts for {me['snippet']['title']}")

# Re-slot instead of missing: a queued Short whose slot is gone (or under 45 min away) moves to the next free
# 08:00 / 12:00 / 19:00 ET slot (12:00Z / 16:00Z / 23:00Z) that no scheduled video and no other queue item holds.
def taken_slots():
    ids, tok = [], None
    up = me['contentDetails']['relatedPlaylists']['uploads']
    while True:
        r = y.playlistItems().list(part='contentDetails', playlistId=up, maxResults=50, pageToken=tok).execute()
        ids += [i['contentDetails']['videoId'] for i in r.get('items', [])]; tok = r.get('nextPageToken')
        if not tok: break
    out = set()
    for i in range(0, len(ids), 50):
        for v in y.videos().list(part='status', id=','.join(ids[i:i + 50])).execute().get('items', []):
            if v['status'].get('publishAt'): out.add(v['status']['publishAt'].replace('.000', ''))
    return out
moved = []
due = [q for q in pending if q.get('publish_at') and at(q['publish_at']) <= now + dt.timedelta(minutes=45)]
if due:
    taken = taken_slots() | {q['publish_at'] for q in pending if q.get('publish_at')}
    day = now.date()
    for q in due:
        while True:
            free = [f"{day}T{h}:00:00Z" for h in ('12', '16', '23') if at(f"{day}T{h}:00:00Z") > now + dt.timedelta(minutes=90) and f"{day}T{h}:00:00Z" not in taken]
            if free: break
            day += dt.timedelta(days=1)
        moved.append(f"{q['ep']}: {q['publish_at']} -> {free[0]}"); q['publish_at'] = free[0]; taken.add(free[0])
    if not DRY:  # persist the new slots so the next run, and James, see them
        byep = {q['ep']: q for q in pending}
        QUEUE.write_text(''.join(json.dumps(byep.get(r['ep'], r)) + '\n' for r in read(QUEUE)))
    for m in moved: print('reslotted', m)

problems = []
for q in pending:
    if q.get('publish_at') and at(q['publish_at']) <= now: problems.append(f"{q['ep']} slot {q['publish_at']} already passed; not uploaded (reslot it)")
    for k in ('mp4', 'description_file'):
        if not Path(q[k]).exists(): problems.append(f"{q['ep']}: {k} missing ({q[k]})")
live = [q for q in pending if (not q.get('publish_at') or at(q['publish_at']) > now) and Path(q['mp4']).exists() and Path(q['description_file']).exists()]
if DRY:
    for p in problems: print('PROBLEM', p)
    for q in live: print('would upload', q['ep'], q.get('publish_at') or q.get('privacy'), q['title'][:60], ('replacing ' + q['replace']) if q.get('replace') else '')
    sys.exit(1 if problems else 0)


capped = False
for q in live:
    body = {'snippet': {'title': q['title'], 'description': Path(q['description_file']).read_text().strip(), 'categoryId': '27',
                        'tags': [t.strip() for t in q.get('tags', '').split(',') if t.strip()], 'defaultLanguage': 'en', 'defaultAudioLanguage': 'en'},
            'status': {'privacyStatus': q.get('privacy', 'private'), 'selfDeclaredMadeForKids': False}}
    if q.get('publish_at'): body['status']['privacyStatus'] = 'private'; body['status']['publishAt'] = q['publish_at']
    try:
        r = y.videos().insert(part='snippet,status', body=body, media_body=MediaFileUpload(q['mp4'], chunksize=-1, resumable=True)).execute()
    except (HttpError, ResumableUploadError) as e:
        if 'uploadLimitExceeded' in str(e): capped = True; print('cap reached at', q['ep']); break
        problems.append(f"{q['ep']}: upload failed: {str(e)[:200]}"); continue
    vid = r['id']; time.sleep(2)
    st = y.videos().list(part='status', id=vid).execute()['items'][0]['status']
    if st.get('publishAt') != q.get('publish_at'):
        problems.append(f"{q['ep']} uploaded as {vid} but publishAt reads {st.get('publishAt')}, expected {q.get('publish_at')}")
    if q.get('playlist'):
        y.playlistItems().insert(part='snippet', body={'snippet': {'playlistId': q['playlist'], 'resourceId': {'kind': 'youtube#video', 'videoId': vid}}}).execute()
    if q.get('thumb'):
        try: y.thumbnails().set(videoId=vid, media_body=MediaFileUpload(q['thumb'])).execute()
        except Exception as e: problems.append(f"{q['ep']}: thumbnail not set ({str(e)[:120]})")
    if q.get('replace'):  # delete the copy this one replaces, only once the new one is confirmed and only if the old one is still private
        old = y.videos().list(part='status', id=q['replace']).execute().get('items', [])
        if old and old[0]['status']['privacyStatus'] == 'private': y.videos().delete(id=q['replace']).execute(); print('deleted replaced', q['replace'])
        elif old: problems.append(f"{q['ep']}: old copy {q['replace']} is {old[0]['status']['privacyStatus']}; NOT deleted, check for a duplicate")
    with DONE.open('a') as f: f.write(json.dumps({'ep': q['ep'], 'id': vid, 'at': now.isoformat(timespec='seconds')}) + '\n')
    print('uploaded', q['ep'], vid, q.get('publish_at') or q.get('privacy'))

left = [q for q in pending if q['ep'] not in {d['ep'] for d in read(DONE)}]
soon = [q for q in left if q.get('publish_at') and dt.timedelta(0) < at(q['publish_at']) - now < dt.timedelta(hours=6)]
if capped and soon: problems.append('upload cap will make these miss their slot: ' + ', '.join(f"{q['ep']} {q['publish_at']}" for q in soon))
if problems: alert('Upload queue needs James', '\n'.join(problems))
print(f'{len(left)} left in queue' + (' (stopped at the daily cap; next run continues)' if capped else ''))
sys.exit(1 if problems else 75 if left else 0)
