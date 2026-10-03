#!/usr/bin/env python3
"""YouTube Data API for the Passionate Learning channel. Secrets live in ~/.secrets, never in the repo.

  yt.py auth                         one-time consent (pick the Passionate Learning channel); stores a refresh token
  yt.py whoami                       channels this token acts for
  yt.py upload FILE --title T [--description-file F] [--tags a,b] [--privacy public|unlisted|private] [--thumb PNG] [--playlist ID]
  yt.py branding --description-file F --keywords "a b \"c d\"" [--banner PNG]
  yt.py playlist --title T --description D [--privacy public]
  yt.py stats
Run with ~/.local/share/many-roads-growth/venv/bin/python. Refuses to act unless the token's channel is named Passionate Learning.
"""
import argparse, json, os, sys
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SECRETS = Path.home() / '.secrets'
CLIENT = SECRETS / 'youtube-oauth.json'
TOKEN = SECRETS / 'youtube-token-passionate-learning.json'
SCOPES = ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload']
NAME = 'Passionate Learning'

def api():
    if not TOKEN.exists(): sys.exit('no token: run `yt.py auth` first')
    c = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not c.valid:
        c.refresh(Request()); TOKEN.write_text(c.to_json()); os.chmod(TOKEN, 0o600)
    return build('youtube', 'v3', credentials=c, cache_discovery=False)

def channel(y):
    items = y.channels().list(part='snippet,brandingSettings', mine=True).execute().get('items', [])
    for it in items:
        if it['snippet']['title'] == NAME: return it
    sys.exit(f'refusing: token acts for {[i["snippet"]["title"] for i in items]}, not {NAME}')

def cmd_auth(_):
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES)
    c = flow.run_local_server(port=8766, open_browser=False, prompt='consent',
                              authorization_prompt_message='CONSENT_URL {url}', success_message='Done. You can close this tab.')
    TOKEN.write_text(c.to_json()); os.chmod(TOKEN, 0o600); print('token stored', flush=True)

def cmd_whoami(_):
    for it in api().channels().list(part='snippet', mine=True).execute().get('items', []): print(it['id'], it['snippet']['title'], it['snippet'].get('customUrl'))

def read(f): return Path(f).read_text().strip() if f else ''

def cmd_upload(a):
    y = api(); channel(y)
    body = {'snippet': {'title': a.title, 'description': read(a.description_file), 'categoryId': '27',  # Education
                        'tags': [t.strip() for t in (a.tags or '').split(',') if t.strip()], 'defaultLanguage': 'en', 'defaultAudioLanguage': 'en'},
            'status': {'privacyStatus': a.privacy, 'selfDeclaredMadeForKids': False, 'embeddable': True}}
    req = y.videos().insert(part='snippet,status', body=body, media_body=MediaFileUpload(a.file, chunksize=8 * 1024 * 1024, resumable=True))
    resp = None
    while resp is None: _, resp = req.next_chunk()
    vid = resp['id']
    if a.thumb: y.thumbnails().set(videoId=vid, media_body=MediaFileUpload(a.thumb)).execute()
    if a.playlist: y.playlistItems().insert(part='snippet', body={'snippet': {'playlistId': a.playlist, 'resourceId': {'kind': 'youtube#video', 'videoId': vid}}}).execute()
    print(json.dumps({'id': vid, 'url': f'https://youtu.be/{vid}', 'privacy': resp['status']['privacyStatus']}))

def cmd_branding(a):
    y = api(); ch = channel(y)
    b = ch['brandingSettings']; b.setdefault('channel', {})
    b['channel'].update({'description': read(a.description_file), 'keywords': a.keywords, 'defaultLanguage': 'en', 'country': 'CA'})
    if a.banner:
        url = y.channelBanners().insert(media_body=MediaFileUpload(a.banner, mimetype='image/png')).execute()['url']
        b.setdefault('image', {})['bannerExternalUrl'] = url
    y.channels().update(part='brandingSettings', body={'id': ch['id'], 'brandingSettings': b}).execute()
    print('branding updated', ch['id'])

def cmd_playlist(a):
    y = api(); channel(y)
    r = y.playlists().insert(part='snippet,status', body={'snippet': {'title': a.title, 'description': a.description, 'defaultLanguage': 'en'}, 'status': {'privacyStatus': a.privacy}}).execute()
    print(r['id'])

def cmd_stats(_):
    y = api(); ch = channel(y)
    s = y.channels().list(part='statistics', id=ch['id']).execute()['items'][0]['statistics']
    print('subscribers', s.get('subscriberCount'), 'views', s.get('viewCount'), 'videos', s.get('videoCount'))

p = argparse.ArgumentParser(); s = p.add_subparsers(dest='cmd', required=True)
for n in ('auth', 'whoami', 'stats'): s.add_parser(n)
u = s.add_parser('upload'); u.add_argument('file'); u.add_argument('--title', required=True); u.add_argument('--description-file')
u.add_argument('--tags'); u.add_argument('--privacy', default='private'); u.add_argument('--thumb'); u.add_argument('--playlist')
b = s.add_parser('branding'); b.add_argument('--description-file', required=True); b.add_argument('--keywords', required=True); b.add_argument('--banner')
pl = s.add_parser('playlist'); pl.add_argument('--title', required=True); pl.add_argument('--description', default=''); pl.add_argument('--privacy', default='public')
a = p.parse_args(); {'auth': cmd_auth, 'whoami': cmd_whoami, 'upload': cmd_upload, 'branding': cmd_branding, 'playlist': cmd_playlist, 'stats': cmd_stats}[a.cmd](a)
