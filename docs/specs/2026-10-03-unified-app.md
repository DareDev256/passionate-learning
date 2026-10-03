# Passionate Learning: the unified app (spec, 2026-10-03)

James, 2026-10-03 17:02-17:05: "merge them all together ... an on going learning game that updates and adds more to its
catalogue ... consider it for iphones ... like kumon and leap frog ... but more adhd retention since new generation of kids
are something else ... the stickman aesthetic of ai for idiots ... a bit of the system solo leveling manhwa style ... more
teaching and fun drawn aesthetic ... dont gen ai too much". Full control handed over; Claude makes every call below and
records it here. This file is the map; `implementation-notes.md` beside it records deviations.

## What it is
One installable web app (PWA; Capacitor iOS later) that replaces the separate suite sites. One profile, one XP and rank,
one spaced-repetition memory across every topic. Topics are **worlds** in a catalogue that grows: a new world is a data
file, not a new app.

## Look (decided)
- **The page:** pure white paper, black ink, one vermilion accent `#ff3b1f` (the AI for Idiots palette; never cream).
- **The cast:** the AI for Idiots stickman kit (`ai-se-for-idiots/src/stick.js`, hand-coded SVG, zero generation cost). The
  player's guide is the headband stickman. Faces react to every answer (grin, shock, facepalm, cool, spiral).
- **The System:** an original "system window" layer inspired by the manhwa genre: dark navy panels with a cyan edge glow
  and bracketed headers (`[ DAILY QUEST ]`, `[ LEVEL UP ]`, `[ RANK UP: D → C ]`). It interrupts the doodle page the way
  a system message interrupts a story. No characters, names or art from any existing work.
- **Memes as rewards:** original stickman meme cards (drake, galaxy brain, expectation/reality, this is fine, two buttons)
  explain a concept after the player meets it.
- Type: a heavy display face for titles, a marker-style hand face for the stickman's lines, a clean sans for body.

## Learning design (decided)
- **Problem first** (from the master spec): every card asks before it explains.
- **Rounds of 60 to 90 seconds**, 5 to 7 cards. One round counts as a full day ("the floor"). **No streak that resets.**
  The profile counts days played, never days missed.
- **Instant feedback:** the stickman reacts, a sound plays, a one-line why appears; wrong answers explain, never buzz.
- **Mastery gates (Kumon):** a unit unlocks the next at 90 percent on its last three tries.
- **Spaced repetition (FSRS, from the template):** old cards return across all worlds; a recall after 7 days is worth 2x XP,
  after 30 days 3x.
- **Ranks E, D, C, B, A, S** from total XP; rank-ups are System windows.
- **Daily Quest:** three small goals a day (one round, one review, one perfect card). Optional, never punished.
- **Arcade break:** finishing a round earns pop tokens; What's Poppin plays as the reward break (ADHD dopamine budget).
- Audience: teens and adults new to AI and tech, gamers, street culture; humour in the AI for Idiots register.

## Card types (the engine)
`choice` (2 to 4 options) · `capOrFacts` (is this AI claim cap or facts?) · `predict` (pick the next token; probabilities
shown after) · `spot` (tap the made-up sentence in a passage) · `order` (put steps in order) · `type` (type the term,
speed-scored). Each card carries `why` (one line), optional `meme`, and a stickman `react` override.

## Worlds (catalogue)
| World | From | Launch |
|---|---|---|
| Prompt Dojo | Prompt Craft | v1 |
| Token Temple | Token Prophet | v1 |
| Cap Detector | Hallucination Hunter (broken site retired) | v1 |
| Red Team | Red Team Arena | v1 |
| Bias Check | Bias Buster | v1 if time, else next |
| Tool Shop | Tool Match | next |
| Circuit Lab | Circuit Prophet (84 items to port) | next |
| Net Run | NetRunner (128 items to port) | next |
| Speed Keys | TypeMaster AI | next |
| Arcade | What's Poppin | v1 (embedded) |
Worlds not ready show as locked "coming soon" cards with their stickman, so the catalogue reads as growing.

## Stack (decided)
Next.js 16 static export + React 19 + TypeScript + Tailwind v4, reusing the template's tested `lib/` (FSRS, storage,
achievements, sound, recall rewards). Lives at `passionate-learning/app/`. Deploys to Vercel project `passionate-learning`.
PWA: manifest, icons, offline cache. Content is typed data in `app/src/content/worlds/*.ts`.

## Bar (gauntlet references)
Duolingo (character reactions, juice, round length), Brilliant (visual discovery), Kahoot (energy), Monkeytype (typing feel),
Kumon (mastery gates), LeapFrog (safe failure). Critique each screen against them; the builder never grades itself alone.

## DONE WHEN (v1)
- runs: the app loads on desktop and a 390px phone, installs as a PWA, plays a full round in 4 worlds offline-capable
- proves: screenshots of home, a round, a System level-up, a meme card, phone width; unit tests on the engine + content
- fails loud: content validator fails the build on a card with no answer, no why, or a duplicate id
- refuses: no streak reset anywhere; no cream; no generated art without a CA$ quote
- admits age: version and catalogue date shown in settings
- mutation: break a content item, see the validator go red
