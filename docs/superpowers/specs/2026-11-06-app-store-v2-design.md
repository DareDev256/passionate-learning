# Passionate Learning 2.0: the App Store release

Design, 2026-11-06. Written by Claude with full authority from James (13:45 EST: "Don't ask me questions, you got this. Make an artifact of everything you decided. After V1 I will make reiterations… go nuts"). James reviews and iterates after V1 ships to TestFlight. Every decision below marked **(J)** is James's; everything else is Claude's call and can be changed.

## Intent

Passionate Learning becomes S-Tier Solutions' first App Store release: a free AI and tech literacy game that a normal person picks up for 60 seconds and keeps coming back to. The bar is the best learning games on the App Store and Steam (Duolingo, Brilliant, NYT Games, Kahoot, while True: learn()), judged by a fresh critic against those apps, not by us. **(J: "as good as the best learning games on App Store, Steam")**

Why now: the YouTube channel (65 Shorts in October, 3,692 Instagram followers on PL Instagram) already points people at the web game, the Apple developer account is paid, and S-Tier's D-U-N-S number arrived today.

## Goals

1. Approved on the first App Store submission.
2. A new player plays a round within 10 seconds of first launch, with no sign-in wall.
3. Day-7 return pull without guilt: quests, leagues, friend quests and new daily games. Not streak shame.
4. Variety: card rounds plus arcade-style learning games (bubble pop, crossword, word building, swiping, a kart race). **(J: "bubble pop, crosswords, scrabble type games, mini games, Mario Kart group games… keep it interesting")**
5. One codebase serves the website and the iPhone app; progress follows the player between them. **(J: accounts and real leagues in v1)**

## Non-goals (v1)

- Android. The Capacitor choice keeps the door open; nothing is built for it now.
- Chat or any free-text messaging between players.
- AI calls at runtime (an "explain my answer" model call). It needs a spend cap and a moderation story; v1.1 at the earliest.
- Money: no ads, no in-app purchases, no subscription, no paywalled lives.

## Anti-goals (a failure even if it technically works)

- Any streak that resets, any guilt copy in notifications, any energy or hearts system. "No streak guilt" is the brand. Days played only ever counts up.
- A login wall before the first round.
- A web page in an iOS frame (Guideline 4.2 rejection).
- Leagues that can be won by cheating or that shame people by demoting them.
- Facts that are wrong. Every card claim is checked before it ships.

## Decisions

### 1. Platform

- **Capacitor (current major) wraps the existing Next.js 16 static export.** `next.config.ts` already exports static files for exactly this. Web and iOS stay one codebase; `out/` is the webDir. No remote URL is loaded: every world, mode and asset ships inside the binary, so the app plays fully offline (Guidelines 2.5.2 and 4.7).
- App ID `ca.stiersolutions.passionatelearning` (company domain stiersolutions.ca; permanent after first release).
- iOS 17 minimum. iPhone and iPhone Duo first-class; iPad runs it, but isn't marketed in v1.
- Next.js in this repo has breaking changes: read `app/AGENTS.md` and `node_modules/next/dist/docs/` before touching routing.

### 2. Accounts and data **(J: yes)**

- **Guest first.** The game is fully playable without an account (Guideline 5.1.1(v)). The local save (`passionate-learning:v1`, `src/lib/save.ts`) stays the source of truth while offline.
- **Sign in with Apple and an email code**, via Convex Auth. Both on web and iOS. No Google/Facebook in v1 (keeps 4.8 simple). Signing in merges the guest save into the account (max of XP, union of days, per-card memory kept by latest review).
- **Backend: Convex** (house stack; `python3 ~/.claude/scripts/convex-authz-audit.py` gates every function). Identity always comes from `ctx.auth`, never from arguments. Every public mutation is rate limited.
- **Sync model:** the client keeps playing offline and queues round results; on reconnect it sends them; the server re-derives XP from round results (it never accepts an XP number from the client).
- **Delete account** in Settings: deletes the user, their progress, league rows and friendships, and revokes the Sign in with Apple token. One tap plus a typed confirm. (5.1.1(v))
- **Demo account** for App Review, documented in the review notes.
- **Age:** accounts require 13+ (a birth-year gate at sign-up; under 13 keeps playing as a guest). App age rating 13+ because players see each other's handles.

### 3. Progression and social

- **Kept as built:** XP, ranks E to S (`RANKS` in save.ts), FSRS memory per card, Kumon-style mastery gates, days played that never reset.
- **Daily quests:** three each day (finish a round, clear a review, play a daily game), with a token chest for all three. Every quest has a floor: one round counts.
- **Weekly leagues:** cohorts of 30 players by sign-up of the week, six divisions (Rookie, Tinkerer, Builder, Hacker, Architect, Oracle). The top 7 climb each Monday 00:00 UTC. **Nobody ever drops** below the division they've reached: the division is a floor, never a threat. Only signed-in players join; guests see a preview and a "save and join" card.
- **Friend quests:** pair with a friend (invite link or 6-character friend code) or an automatically matched partner, for a shared weekly XP goal and a joint chest. No chat.
- **Handles:** generated stickman handles by default ("Turbo Tokenizer 42"); players can rename. Names pass a profanity and impersonation filter; any player can report or block a handle (Guideline 1.2). No avatars uploaded by players: avatars are stickman poses and faces from `src/art`.
- **Anti-cheat:** XP is computed on the server from submitted rounds, with plausibility caps (minimum round duration, maximum XP per hour); race results are bounded by track length and answer count. Suspicious accounts are excluded from promotion, never shown a public accusation.

### 4. Game modes **(J: bubble pop, crosswords, scrabble type, mini games, Mario Kart group games)**

All modes draw from the same content (cards and a new glossary) and feed the same FSRS memory, so every game teaches. Each mode is a route under `/play/` and a tile on Home.

| Mode | What it is | Content it uses | Daily? |
|---|---|---|---|
| **Card rounds** (kept) | The 6 existing card types in 60-second rounds | worlds | per unit |
| **Bubble Pop: "Pop the Cap"** | Bubbles rise carrying claims; pop only the made-up ones before they escape. Combos, a fever meter, 45 s | cap cards, choice options | yes, daily seed |
| **Scam or Legit** | Swipe left or right on fake texts, emails and pop-ups. 20 swipes, then the tells are revealed | new Scam Radar world | no |
| **The Daily Grid** | A 5x5 mini crossword, the same for everyone each day, from glossary terms. Share card shows your time | glossary | yes |
| **Word Forge** | Scrabble-style: 7 letter tiles, build words for points; tech terms from the glossary pay triple. 90 s | ENABLE word list (public domain) + glossary | yes, daily rack |
| **Token Slicer** | Slice a sentence where you think the AI cuts it into tokens; the real cuts are revealed | precomputed tokenizations in content | no |
| **Prompt Prix** | Kart race: answer to boost, a wrong answer spins you out, three in a row earns an item. Ghost Cup races 3 recorded runs from your league; Party Room races up to 8 friends live by room code; Couch mode splits the iPhone Duo's two halves for 2 players | all cards | Ghost Cup weekly |
| **What's Poppin** (kept) | The arcade break bought with tokens | n/a | no |

- Live Party Room uses Convex realtime: the server owns the race clock and answer order; clients render. If a phone drops, its kart coasts and it can rejoin.
- Prompt Prix art: top-down 2D track in canvas, stickman karts in the house SVG style, the house sound engine for engine and item sounds.

### 5. Content

- Ship the 4 "coming soon" worlds: **Deepfake Detector, Scam Radar, Code Dojo, AI at Work**, about 30 cards each, so 13 live worlds at launch.
- Add `src/content/glossary.ts`: term, clue, world, difficulty. It feeds the Daily Grid and Word Forge, generated from existing type cards plus new entries.
- **Fact check:** every new card's factual claim gets a source and a pass from a fresh-context critic before it ships; claims reuse the channel's claims ledger format (`~/Projects/products/ai-se-for-idiots/series/claims/ledger.json`). `npm run validate` must stay green.

### 6. Feel

- Every answer gets a sound (the existing sound engine), a haptic on iOS and a stickman reaction. Big moments (rank-up, chest, promotion, race win) get one full-screen celebration each, never more than one per screen.
- Run `gamedev-codex` (game-feel Lenses) on each mode's loop, then `find-animation-opportunities` and `animate`, within `apple-design` motion rules; `prefers-reduced-motion` respected.
- First launch: one tap from opening to the first card. No tutorial screens; the first card teaches the controls.

### 7. Native iOS

- Capacitor plugins: haptics, local notifications, share, status bar, splash screen, app review prompt, Sign in with Apple.
- **One gentle reminder a day** at a time the player picks (default off until they finish their first day). Copy is curious, never guilt: "Your daily grid is ready" not "Don't lose your progress".
- **Share card:** a generated image of the result (the Daily Grid time, a race podium, a rank-up), shared through the native share sheet.
- **App review prompt** after a win, at most three times a year (Apple caps it anyway).
- **iPhone Duo:** layouts adapt to folded (430 wide) and open (669 wide); the open Duo shows the card and its explanation side by side, and Couch mode in Prompt Prix uses each half for a player. Follow the `iphone-duo-*` skills.
- **Apple Watch companion:** "Card of the Day" and a 3-card review, synced from the phone through a small Swift Capacitor plugin (WatchConnectivity). Stretch for v1; it becomes required if App Review raises 4.2.

### 8. Privacy, safety, pages

- Privacy label: Identifiers (user ID), Contact info (email, only if they use email sign-in), Usage data (gameplay), all linked to the account, none used for tracking. No third-party analytics SDKs.
- Our own aggregate learning metrics live in Convex (rounds, accuracy, day-1/7 return), shown to us only.
- `PrivacyInfo.xcprivacy` declares the required-reason APIs Capacitor and its plugins use; run Capacitor's required-reason scanner over `node_modules` and the built bundle.
- Pages on the website: `/privacy`, `/support` (real contact: the S-Tier email), `/terms`.

### 9. Quality bar and the gauntlet **(J: "gauntlet loop")**

- Builder never grades its own work (`gauntlet-loop` skill). Each round, a fresh-context critic gets screenshots and frame strips of every screen at 390, 430 and 669 wide plus the bar apps' equivalent screens, scores each screen out of 10 against the bar, and names the single biggest gap.
- Bars: Duolingo (path, quests, leagues, celebrations), Brilliant (interactive explanation), NYT Games (daily grid polish and sharing), Kahoot (party room), Mario Kart Tour (race feel).
- Loop until every screen scores 8 or more, or 5 rounds; the remaining gaps go on the V1 page for James.

### 10. App Store **(J: "App Store review skill at the end")**

- Name "Passionate Learning" (fallback "Passionate Learning: AI Games"), subtitle "Learn AI in 60-second games". Primary category Education, secondary Games.
- Seller: S-Tier Solutions Inc. once Apple converts the membership with the D-U-N-S number (James's click). If that takes more than about 2 weeks, ship under the individual membership; it converts later.
- Screenshots: required iPhone set (1179x2556 or 1206x2622) plus both iPhone Duo sets (outer 1398x2034, inner 2007x2853), real captures from the build, headlines from `store-listing-copy`. A 15 to 30 s app preview captured from the running app.
- **Pre-review skill:** vet `devsemih/appstore-review-skill` and Cap-go's `capacitor-apple-review-preflight` with `vet-viral-tool`; harvest the best checks into our own `app-store-preflight` skill (Capacitor-aware: 4.2, 5.1.1(v), privacy manifest, metadata, demo account). It runs before every submission and exits non-zero on a failed check.
- `submission-gauntlet` runs on the listing copy (it goes out under S-Tier's name).
- Release path: TestFlight internal (James plays on his Duo) → fixes → App Review. **Submitting is James's click.**

## Audit of today's app (2026-11-06, v1.2.0)

A fresh-storage play-through at 390, 430 and 669 wide (shots in `docs/screenshots/2026-11-06_audit/`) found these gaps. Each is fixed in V1, in the phase shown.

| # | Gap (shot) | V1 fix | Phase |
|---|---|---|---|
| 1 | No onboarding or placement; first launch lands on the full home (01-first-launch-390) | The first screen IS a card: "What brought you here?" (work, curious, protect myself, build stuff) picks the first world, and the second card is already a lesson. Still one tap to play | P2 |
| 2 | Home shows 9 equal worlds plus 4 "soon": choice overload (02-home-full-390) | Home becomes one path with the next node lit ("Up next"); the world map is a tap deeper | P2 |
| 3 | Nothing pulls a player back on day 7 (12-home-after-round1-390) | Daily quests with a chest, leagues, friend quests, daily games, one gentle reminder | P2, P3, P5 |
| 4 | Recap after a miss offers only Replay (10-recap-prompt-390) | Recap lists the missed cards and offers "Fix your mistakes", a short pass on just those | P2 |
| 5 | The 70% unlock rule is never explained | Recap says what unlocks next and what it needs ("67%, need 70%: one more round") | P2 |
| 6 | Locked units open by direct URL; tapping a locked node does nothing (40-locked-unit-direct-url-390, 05-locked-unit-tap-390) | Real route guard; a locked tap shakes and says what to finish first | P1 |
| 7 | 107 of 163 cards are plain multiple choice | New card types: match pairs, slider estimate, tap the spot in an image, swipe. Target: no more than half of all cards are plain choice | P3, P4 |
| 8 | No settings screen | Settings: sound, haptics, reduced motion, reminder time, account, delete account, privacy, support | P1 |
| 9 | Arcade is one button on an empty page (32-arcade-390) | Becomes the Games hub with all 7 modes; What's Poppin lives inside it | P3 |
| 10 | Daily quest is a static checklist with no reward | Three quests and a chest | P2 |
| 11 | About 35 to 45 minutes of content, then only reviews | 4 new worlds, plus daily games with a fresh seed every day | P3, P4 |
| 12 | Wrong-answer feedback is generic ("Nope. Now you know.") | Says the card will come back ("You'll see this again Thursday") using its FSRS due date | P2 |
| 13 | No profile, stats or achievements | Profile page: rank, days played, accuracy per world, achievements, league history | P2 |
| 14 | The "soon" strip clips at 430 and sits oddly at 669 (02-home-full-390) | Goes away: the 4 worlds ship | P4 |
| 15 | ✕ quits a round instantly; mid-round resume untested | Confirm on quit; a round in progress resumes after the app is backgrounded | P1 |

Broken now: at 669 wide (Duo open) the answer drawer covers the third option (15-token-feedback-669) and the page is a stretched phone column; a 1 px horizontal scroll at 430 (26-circuit-feedback-430); a bad URL shows a raw 404 (39-bad-unit-url-390). P1 fixes the overflow and the 404; P5 builds the real Duo layouts.

Keep, because the audit called them the strongest parts: the hand-drawn stickman on the dotted white page with the vermilion accent and pressed buttons; the 60-second "beat it for +15 XP" timer with no penalty; the segmented progress and combo flame; the feedback drawer with the one-line why; the meme cards and the predict probability reveal; the cyan System windows; the "A missed day resets nothing here" line.

## Phases (each ends in something that runs)

| Phase | Ends when |
|---|---|
| P1 Foundation | Convex dev deployment with auth; guest save merges into an account; Capacitor iOS shell runs the full game offline in the simulator; vitest + Playwright green |
| P2 Progression | quests, leagues (with a simulated week), friend quests, handles, report/block, delete account, all driven end to end in a real browser |
| P3 Modes | Bubble Pop, Scam or Legit, Daily Grid, Word Forge, Token Slicer and Prompt Prix (Ghost Cup, Party Room, Couch) playable start to scored end |
| P4 Content | 4 new worlds and the glossary shipped, every new claim sourced and critic-passed |
| P5 Native and feel | haptics, reminder, share card, review prompt, Duo layouts, watch companion (stretch); TestFlight build on James's Duo |
| P6 Gauntlet | every screen at 8/10 or better against its bar, or 5 rounds done |
| P7 Store | preflight skill green, store assets made from the build, submission gauntlet receipt, build waiting for James's submit click |

## Done when (ship-it gates)

Runs on James's Duo from TestFlight · proves itself with Playwright runs of every mode and simulator screenshots that were looked at · fails loud when sync fails (a visible "not saved yet" state, never silent loss) · refuses implausible XP on the server, with a test that breaks the guard and watches it go red · admits age (the league timer and leaderboard come from the server with a timestamp) · every guard mutation-checked.

## Left to the builder

Exact visuals of each mode within the house style; division colours; league cohort matching details; the Word Forge letter values; Prompt Prix item set and track count; card counts per new world within about 25 to 35.

## Risks

- **4.2 rejection** despite native features: the watch companion and offline-first design are the answer; review notes list the native features.
- **Capacitor + Next 16 static export quirks** (trailing slashes, route params in a file:// context): P1 proves every route inside the iOS shell before anything else is built on it.
- **Leagues need players:** with few signed-in players, cohorts fill with fewer than 30; the league still runs with whoever is there, and Ghost Cup ghosts come from any division when the league is thin.
- **Scope:** this is many sessions of work. Phases ship in order, and each phase leaves the app shippable.
