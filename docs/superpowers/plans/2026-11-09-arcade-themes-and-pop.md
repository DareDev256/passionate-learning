# Arcade: True/False, theme shop, What's Poppin glow-up. Plan

> Written 2026-11-09 17:50 ET for branch `v2-arcade` (cut from `v2-p2` at 4b3a873). James asked for this directly ("bubble pop needs the ultimate glow up, stick chars in it, a gauntlet loop, think out arcade, tokens are new themes, remove cap with true so it's less ghetto") and gave full creative authority for this app on 2026-11-06. Nothing below is asked of him; every ruling is Claude's call, logged, and changeable.

## Jobs

1. True/False replaces the cap slang (display copy only; ids, `type: "cap"`, `isCap` and world id `cap` unchanged so saves keep working). World title is now **Fact Check**. Done in commit cc9f2f5, pinned by `true-false.test.ts`.
2. Arcade economy: tokens buy themes.
3. What's Poppin glow-up with the stickman cast.
4. Gauntlet loop on What's Poppin (receipt: `app/docs/gauntlet/2026-11-09-whats-poppin.md`).

## Economy design (job 2)

Earning today: a finished round pays 1 token (2 when perfect), the daily chest pays 5, one What's Poppin game costs 1. A player who finishes the three quests earns about 7 to 9 tokens in a day and spends a few on the arcade.

- **A. Theme shop, whole themes.** One purchase unlocks a complete theme: the app palette, the stickman's hero outfit, and the What's Poppin skin together. Tokens are spent once, the theme is owned forever, and equipping is free and instant. Six themes, one free.
- **B. Two shops.** Paint (palette) and Wardrobe (stickman outfit) bought separately. More to browse, but two prices to learn, a combinatorial set to test, and the game skin has no obvious home.
- **C. Token-per-game only plus a random prize drawer.** Chance rewards with tokens read as a loot box. It also fights App Review's gambling guidance. Rejected.

**Pick: A.** One idea a player can say in one line ("spend tokens, the whole app changes"), and every purchase changes what they see on every screen, every day. It never needs money (no IAP, nothing for App Review to worry about), costs nothing to maintain, and one equipped theme is a single value in the save.

**Prices** (tokens), set against about 8 earned per day: Notebook 0 (the default, always owned), Blackout 6, Redline 10, Greenroom 12, Ultraviolet 15, Bubblegum 18. The cheapest is about one day of chest plus rounds; the dearest is about two days with nothing spent on games. 1 token per What's Poppin game stays: it is the sink that makes prices matter, and it keeps "learning first" true.

**Rules.** Tokens never go negative (`buyTheme` refuses with a reason and returns the same save). A theme is bought once (a repeat is a no-op and costs nothing). Equip needs ownership. The save gains `themes: { owned: string[]; equipped: string }` with default `{ owned: ["notebook"], equipped: "notebook" }`; migration of any older v2 save fills the default; an unknown id in a save is dropped and falls back to Notebook. Every buy and equip appends an event (`type: "buy" | "equip"`, `unit` = theme id, empty `cards` and `correct`) so a P3 server folding the log can rebuild ownership and spend.

**Grounds** (house taste: white, true black, or one saturated colour plus one loud accent; no cream, muted gold, sage, taupe, default blue):

| id | name | price | ground | ink | accent |
|---|---|---|---|---|---|
| notebook | Notebook | 0 | #ffffff | #0a0a0a | #ff3b1f |
| blackout | Blackout | 6 | #000000 | #ffffff | #c6ff00 |
| redline | Redline | 10 | #ff2a1a | #0a0a0a | #ffffff |
| greenroom | Greenroom | 12 | #00b84a | #0a0a0a | #fff200 |
| ultraviolet | Ultraviolet | 15 | #5b21ff | #ffffff | #ffe500 |
| bubblegum | Bubblegum | 18 | #ff2e93 | #0a0a0a | #fff200 |

`src/lib/themes.ts` is the source of truth for the app. The game has its own copy in `public/arcade/pop/src/theme.js` (it is a separate vanilla page); a unit test reads both and fails if ids or colours drift. The app opens the game as `/arcade/pop/index.html?theme=<id>`.

## What's Poppin glow-up (job 3), decisions

- The cast: Hero (vermilion headband), Bolt (robot), Pro (glasses and tie), Spark (bun). Drawn on a 2D canvas from the same joint data as `src/art/stickKit.ts` (poses, faces, accessories), redrawn per frame so limbs tween between poses. They replace the four anime characters; `characters.js` goes.
- The board gets a stage above it where the cast lives all game and reacts: pop (hero hops), streaks (more of the cast joins), power-up (shock then cheer), fever (all cheer, confetti), low time (sweat and panic), game over (win: cool and cheer, low score: sad then a try-again wave).
- Look: ink-outlined doodle bubbles on the equipped theme's ground. Layout rebuilt with no overlaps: HUD row, thin timer bar, stage, board, footer.
- Game feel: anticipation squash before a pop, impact particles in the bubble's colour, screen shake and zoom punch scaled by combo size, short hit-stop on big matches, slow-motion payoff on a fever start or a 4+ chain, count-up scores, bounce-and-squash landings, wobbling selected bubble.
- `prefers-reduced-motion`: no shake, zoom, slow-mo or confetti; cast holds poses and swaps instead of tweening wildly.
- Offline only: no network, no remote assets, CSP unchanged.

## Gauntlet (job 4)

Builder never grades. Critic is a fresh-context agent that sees only rendered 390 px frames (title, mid-play, streak, fever, game over, in-app iframe view) plus a frame strip, scored out of 10 against Duolingo lesson celebrations and character life, Threes! tactile feel, Peggle payoff moments. Loop until 8 or higher, or 5 rounds. Receipt below the plan is `app/docs/gauntlet/2026-11-09-whats-poppin.md`.

## Done when

Unit, e2e (390, 430, 669, workers 2), lint, validate, tsc and next build exit 0; theme buy/equip e2e; token guard mutation goes red then is restored; screenshots reviewed at 390; version 1.5.0 with CHANGELOG and README line; every commit on `v2-arcade`, pushed.

## Not considering (ranked)

1. A theme preview before buying (try it for one screen).
2. Seasonal limited themes.
3. A "gift a theme" or share flow (needs accounts, so P3 or later).
