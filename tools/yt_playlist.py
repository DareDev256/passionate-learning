#!/usr/bin/env python3
"""Find or create a Passionate Learning playlist by exact title, add videos to it, and read the result back.

  yt_playlist.py --title "Every AI Plan, Priced" [--description D] [--privacy public] VIDEO_ID [VIDEO_ID ...]

Idempotent: an existing playlist with the same title is reused, and a video already in it is skipped, so a make run
can call it with every new price Short. Prints the playlist id, then one line per video (added / already / FAILED).
Exits 1 if any requested video is missing from the read-back. Refuses unless the token acts for Passionate Learning.
Run with ~/.local/share/many-roads-growth/venv/bin/python. Quota: 50 units per insert, 1 per list page.
"""
import argparse, os, sys, time
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

TOKEN = Path.home() / '.secrets/youtube-token-passionate-learning.json'
SCOPES = ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload']
NAME = 'Passionate Learning'


def api():  # same token and refusal as yt.py, which parses argv at import and so cannot be imported
    if not TOKEN.exists(): sys.exit('no token: run `yt.py auth` first')
    c = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not c.valid:
        c.refresh(Request()); TOKEN.write_text(c.to_json()); os.chmod(TOKEN, 0o600)
    y = build('youtube', 'v3', credentials=c, cache_discovery=False)
    names = [i['snippet']['title'] for i in y.channels().list(part='snippet', mine=True).execute().get('items', [])]
    if NAME not in names: sys.exit(f'refusing: token acts for {names}, not {NAME}')
    return y


def items(y, pid):
    out, tok = [], None
    while True:
        for attempt in range(6):  # a just-created playlist answers 404 for a few seconds (seen 2026-10-29)
            try:
                r = y.playlistItems().list(part='snippet', playlistId=pid, maxResults=50, pageToken=tok).execute(); break
            except HttpError as e:
                if e.resp.status != 404 or attempt == 5: raise
                time.sleep(5)
        out += [i['snippet']['resourceId']['videoId'] for i in r.get('items', [])]
        tok = r.get('nextPageToken')
        if not tok:
            return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--title', required=True)
    ap.add_argument('--description', default='')
    ap.add_argument('--privacy', default='public', choices=['public', 'unlisted', 'private'])
    ap.add_argument('videos', nargs='+')
    a = ap.parse_args()
    y = api()
    pid, tok = None, None
    while pid is None:
        r = y.playlists().list(part='snippet', mine=True, maxResults=50, pageToken=tok).execute()
        pid = next((p['id'] for p in r.get('items', []) if p['snippet']['title'] == a.title), None)
        tok = r.get('nextPageToken')
        if not tok:
            break
    if pid is None:
        pid = y.playlists().insert(part='snippet,status', body={
            'snippet': {'title': a.title, 'description': a.description, 'defaultLanguage': 'en'},
            'status': {'privacyStatus': a.privacy}}).execute()['id']
        print('created', pid)
    else:
        print('found', pid)
    have = set(items(y, pid))
    for v in a.videos:
        if v in have:
            print('already', v); continue
        y.playlistItems().insert(part='snippet', body={'snippet': {
            'playlistId': pid, 'resourceId': {'kind': 'youtube#video', 'videoId': v}}}).execute()
        print('added', v)
    back = set(items(y, pid))
    missing = [v for v in a.videos if v not in back]
    for v in missing:
        print('FAILED', v, 'not in the read-back')
    print(f'read back {len(back)} videos in {pid}')
    sys.exit(1 if missing else 0)


if __name__ == '__main__':
    main()
