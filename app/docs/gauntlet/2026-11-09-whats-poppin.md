# What's Poppin gauntlet, 2026-11-09

Bar: Duolingo lesson celebrations and character life, Threes! tactile feel, Peggle payoff moments (a quality bar, not something to copy). The builder never graded. Each round a fresh-context critic (new agent, no repo access to code) judged only rendered frames at 390 px and a recording, plus the in-app iframe views. Loop rule: stop at 8/10 or after 5 rounds.

**Result: 5 rounds used, final score 5.5 / 10. The 8/10 bar was NOT reached.**

| Round | Overall | Duolingo | Threes! | Peggle | Polish | Evidence |
|---|---|---|---|---|---|---|
| 1 | 5.5 | 6.5 | 4.5 | 5 | 6 | `screenshots/2026-11-09_arcade/pop-r1/` |
| 2 | 5.5 | 5.5 | 4.5 | 5 | 6 | `pop-r2/` |
| 3 | 5.5 | 6.5 | 5 | 5.5 | 6 | `pop-r3/` |
| 4 | 5 | 5.5 | 4.5 | 4 | 6 | `pop-r4/` (first deterministic 30 fps capture) |
| 5 | 5.5 | 6 | 5 | 5 | 6.5 | `pop-r5/` |

Capture note: rounds 1 to 3 used headless screenshots, which are not real time (the timer moved a full second per shot), so critics saw pops "vanish". From round 4 the game loop is stopped and stepped 1/30 s per frame (`playthrough-30fps.mp4`).

## Round by round: top issues and what changed

1. Top issues: pops have no tactile weight; bubbles flat; toasts cover the board; fever text over bubbles; characters pose-swap only; stray stage dashes; streak text hits Hero. Changed: toasts moved to the footer, stray dashes removed, streak banner given its own band, hint icon theme-safe, disabled-button olive fixed, layout labels enlarged.
2. Top issues: refill gap and bubbles drawn above the board; pop no squash; fever washes the board pale; same pose for all characters; "+120" ghost on a label; labels crossed by the ground line. Changed: drop and refill timers cut, board shake per pop, idle wobble, contact shadow on bubbles, per-character reactions in turn, staggered tier reactions, fever dim plus glow, ground line raised so labels clear it.
3. Top issues: pops vanish, refill timid, fever and streak live on the stage not the board, tiny text. Changed: bubbles clipped to the board, swell-and-burst pops, fever plate and rising sparks, idle crew life, title icons removed, encouragement line on game over.
4. Top issues: no weight on pop and settle, 5x and 8x almost invisible, fever is a banner not an event, crew underused. Changed: white-flash pop, shock ring, fever shimmer, board border flash on streak tiers, bigger small text.
5. Top issues: plain pop still light, FIRE banner collides with the score popup, 8x has no moment, fever pale, game over has no count-up weight, tiny text and iframe top gap. Changed before this round: visible slower drops with landing squash, board colour wave, tier-up banner with hit-stop and shake, fever starburst, stamp-in grade.

## Not fixed (deferred, in the critic's own words)
- Plain pop and settle still read as light (Threes! 5/10).
- The tier banner can overlap the floating score popup near the top of the board.
- Fever and 8x need a larger, longer takeover (Peggle 5/10).
- Game over score count-up and a larger confetti burst.
- Some labels are still under 11 px; the iframe has dead space above the HUD (the app's Back pill) at some phone aspect ratios.

## Honest caveat
Critics scored mostly from stills and sampled frames, and read headless-capture timing as sluggish at times. The score is a floor on what a person playing would feel, not a measurement of it. The stickman cast, notebook look and character reactions were consistently called the strongest part and left alone.
