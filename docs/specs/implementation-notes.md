# Implementation notes: unified Passionate Learning app (started 2026-10-03 17:05)

The running ledger. Read this first after any context reset. Spec: `2026-10-03-unified-app.md`.

## James's full mission (verbatim intent, 2026-10-03 17:02-17:11; he is out, full control)
1. Gauntlet-loop the learning games + prototypes up to a decent standard; prettier; competition-studied; personalised.
2. MERGE into ONE ongoing learning game with a growing catalogue; iPhone-ready; Kumon/LeapFrog-style smart teaching; ADHD retention.
3. Look: AI for Idiots stickman + a bit of Solo-Leveling-style "System" windows, fun drawn teaching aesthetic. Avoid gen-AI spend.
4. Custom suite logo + one matching brand.
5. At the end: PUBLIC repo, update every site that links any of the games to the new link, invite contributors (community).
6. When it's up to par: new YouTube channel (funny name, "Teaching AI for Idiots"-ish), 1 Short + 1 long video, very funny;
   long videos need his approval for taste. Study SEO/marketing; apply the MANY ROADS growth engine.
7. "Prove why you are king."

## Hard limits (not negotiable, say so in the report)
- Creating the YouTube channel = creating an account → stage everything, James clicks create. Then upload.
- Long video: upload UNLISTED/private for his approval, not public.
- Secrets scan before making any repo public.

## Rulings
- Architecture: one Next.js static-export PWA at `passionate-learning/app/`, engine + typed world data files. — cost if wrong: a rewrite of the shell only; content files survive.
- Content written fresh: old games shipped template placeholder curricula (token-prophet's curriculum.ts IS the template example).
- No streak reset anywhere (AI for Idiots / James's own rule); "days played" instead.
- Next 16.1.1 (template) had a critical advisory → upgraded to 16.3.8, prod audit 0.

## Progress
- [x] spec + notes
- [x] scaffold app/, deps, 0 vulns
- [x] content model + validator; 4 live worlds (prompt, token, cap, redteam) = 60 cards; 5 soon worlds
- [x] stick art React wrapper, logo, System window, meme cards
- [x] engine (own save.ts + round.ts on ts-fsrs; template lib dropped except soundEngine), profile (rank, days, quest)
- [x] pages: home/map, world, round (6 card types + reaction zone + drawer), recap, arcade, about; PWA manifest + SW + icons + og
- [x] tests 18/18, build, screenshots desktop + 390px (docs/screenshots/2026-10-03_pl-*)
- [x] deployed: https://passionate-learning.vercel.app (Vercel project passionate-learning, ./ship.sh, headers verified, live round + arcade 0 errors)
- [ ] blind critic pass (subagent cap parked 17:4x per CLAUDE.md fan-out rule)
- [ ] port Bias, Tools, Circuit, Net, Keys
- [ ] public repo + CONTRIBUTING + site link updates
- [ ] YouTube kit + Short + long draft
