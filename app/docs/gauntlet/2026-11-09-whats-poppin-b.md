# What's Poppin gauntlet B, 2026-11-09 and 2026-11-10 (option B: the crew is the board)

Bar: Duolingo lesson celebrations and character life, Threes! tactile feel, Peggle payoff moments (a quality bar, not something to copy), plus one extra criterion the critic had to score: "the stick characters are in the game, not beside it". The builder never graded. Each round a fresh-context critic (new Opus agent, no code access, told to read only the evidence folder) scored real rendered frames at 390 px, frame strips, a 30 fps recording and the in-app iframe view. Loop rule: stop at 8/10 or after 5 rounds.

**Result: the 8/10 bar was NOT reached. Scored rounds: 3 (5, 5.5, 6). Round 4 evidence was captured and committed, but the fresh critic could not be launched: the session hit its subagent spawn cap (SPAWN_CAP_DENY=24, a hook in ~/.claude, not something this branch may change). Round 4 and 5 are therefore unscored; no self-grade is offered in their place.**

| Round | Overall | Duolingo | Threes! | Peggle | Crew in the game | Polish | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | 5 | 6 | 6 | 4 | 7 | 3 | first full capture of 6 themes, strips, video, in-app |
| 2 | 5.5 | 6 | 6 | 5.5 | 7 | 4 | notebook and redline re-captured |
| 3 | 6 | 6.5 | 6 | 6 | 8 | 4.5 | notebook, redline, blackout, greenroom re-captured |
| 4 | not scored (spawn cap) | | | | | | notebook, redline, strips, video, in-app re-captured |

For comparison, the previous method (option A, `2026-11-09-whats-poppin.md`, the crew on a stage above generic marbles) stalled at 5.5/10 after 5 rounds. The new method moved the score from 5 to 6 in three rounds and lifted "crew in the game" from 7 to 8, but it did not reach 8.

Evidence folder: `app/docs/screenshots/2026-11-09_pop-b/` (notebook full set, redline and the other themes, `playthrough-30fps.mp4`, `strip-*.png`, `inapp-*`). Capture method: the game loop is slept and stepped 1/30 s per frame with `performance.now` and `Date.now` replaced by a virtual clock. (Phaser's tween manager reads the real clock, so without that override tweens ran at a tenth of speed in the first captures.) The mp4 is spliced from separate scenes (idle, pop and chain, fever and payoff, game over), each restarted from a fixed seed. A chain board is built by script because a random board rarely chains.

## Round by round

1. Score 5. Top issues: celebration heads covered the multiplier, HUD and final score; chains did not escalate (same starburst at x2, x3, x4) and "NICE!" clipped at the right edge; fever was framed rather than a takeover and its payoff was small and never reached the score; crew colours change per theme; text collisions (toast on the tip line, stat labels running together). Changed: head rain moved behind the HUD; chain banner scaled by depth with a board-wide shockwave ring from chain 3; the page behind the canvas takes the fever ground; Redline meter fill no longer white on white; payoff plate flies into the score; single speech bubble at a time; cheer faces differ per crew member; refill no longer leaves holes (drop and refill run together); stats labels shortened; tier banner clamped to the screen.
2. Score 5.5. Top issues: text collisions at the peak moments; the payoff does not land (the count-up never visibly adds to the score, the card looks like a dialog); fever does not change the board itself and Redline's fever ground read as cooling down; identity fragile across themes; clutter (chain burst covers 40 % of the board, red text on red heads). Changed: the HUD score holds during fever and the plate banks into it with a count-up; board panel tints toward the fever ground; Redline fever ground becomes true black; HUD text recolours by contrast on the fever ground; swapped heads slide along arcs and pass around each other; popups are ink text on a white stroke; fever banner clears any chain banner and no banner prints in the first 1.5 s of fever.
3. Score 6. Top issues: heads still crossing the HUD (the rain started 220 px above the board); the score reading 0 beside "+700" for the whole fever looked broken; the payoff is a plain white card; murky grey and black chain overlays; "NICE!" printed twice; a fire emoji clashing with the drawn style; "+240" clipped at the screen edge. Changed (round 4 build, unscored): rain spawns at the board's top edge behind the HUD; the score label reads "SCORE +N IN FEVER" while the HUD score holds; the payoff plate gets a starburst and two cheering crew members and counts up over 0.95 s; chain bursts are always the accent with a white-stroked label and no dark wash; pop rings only for big pops; the duplicate tier text and the emoji are gone; popups are clamped on screen.

## Not fixed (deferred)

- The crew's colours change per theme (Hero is red on Notebook, white on Redline). The six theme palettes come from the theme system built last pass and are covered by a drift test; identity is carried by accessory and face, but the critic still marked it down. Locking each crew member's colour would mean changing the theme data and that test (James's call).
- Spikes, antenna and bun of heads in lower rows tuck behind the head above (pitch 54 on 52 px heads), so they show fully only on the top row.
- The idle "tell" (heads leaning toward a waiting move) is subtle in stills; it needs a recording to see and the critic called it a blink.
- The Shapes (colour-blind badge) option is still off by default.
- Round 4 and round 5 critic scores (spawn cap).
- Ultraviolet and Bubblegum stills, and Blackout and Greenroom stills in the final folder, are from earlier builds of the same art (late rounds re-captured only Notebook and Redline because the machine was heavily loaded by another session).

## Frame time (measured, with a caveat)

Per-frame cost of the game step (update plus render submit) in headless Chromium with software WebGL, 390 px at DPR 2, one board, on a Mac that was at load average 50 to 300 because another session was rendering video. Best of two clean runs: chain phase p50 5.1 ms, p95 20.2 ms; fever phase p50 4.9 ms, p95 9.6 ms. Fever meets the 16.7 ms target; the chain p95 does not on this loaded machine (the other run read 23.2 ms and 15.3 ms). Both runs also showed a few single-step stalls of seconds, which are the machine, not the game. A re-measure on a quiet Mac is still owed; a real iPhone was not tested.

## Honest caveat

Critics scored stills, strips and a spliced recording, not hands on glass. The recorded frame cadence is the stepped 30 fps, so squash, bounce and hit-stop frames can fall between samples (a critic reported "no visible settle bounce" from sampled frames). The score is a floor on what a player would feel, not a measurement of it.

## Round 4 (2026-11-10 11:12 ET, fresh critic after the spawn cap was reset)

Scored on the committed stills and strips only; the critic did not extract frames from the 30 fps video, so motion was inferred from strips.

| Criterion | Score |
|---|---|
| Character life and celebrations (Duolingo) | 4.5 |
| Tactile pop, swap, settle (Threes!) | 5 |
| Payoff moments (Peggle) | 5.5 |
| Polish at 390 px | 4.5 |
| Stick characters in the game, not beside it | 3.5 |
| **Overall** | **4.5** |

Lower than round 3 (6) from a different critic on the same build: critic variance is about 1.5 points, so the honest read is 4.5 to 6.

Top issues, most costly first:
1. Heads only: on Notebook, Blackout and Ultraviolet the board shows faces with props, no body, limbs or pose, so the crew reads as emoji rather than stick characters (notebook-02, notebook-07, inapp-blackout-02, blackout-09).
2. The crew never celebrates during play: chain and fever cover the board with a starburst and words instead of the characters reacting (strip-fever, strip-chain).
3. Overlay collisions: UNSTOPPABLE on the STREAK label, FEVER banner over 30% of the board, debris over SCORE and SECONDS, GO! over tiles, dead gap under BACK TO LEARNING (notebook-11, blackout-09, greenroom-14, inapp-blackout-02).
4. Pops are one flat sticker for every head; swap and about-to-pop look like idle; columns collapse with no cushioned settle (notebook-04, notebook-07, strip-pop-frames).
5. Score stays 0 through fever then jumps; low-contrast NEW HIGH SCORE on Bubblegum; tiny secondary labels; FIRST POP button stays all game.

Most leverage toward 8: full stick bodies on the board in every theme that act (jump, flinch, cheer, dance) with each pop, chain and fever, plus a reserved banner lane so the board stays clear.
