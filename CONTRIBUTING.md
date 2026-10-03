# Contributing to Passionate Learning

Thanks for helping people learn. You don't need to be a developer to contribute: most of this game is **words**.

## Ways to help

1. **Write a unit** (5 to 8 cards) for an existing world, or **start a new world**. See below.
2. **Fix a card**: a fact that's wrong, a joke that doesn't land, a confusing question. Open an issue or a PR.
3. **Game design**: new card types, new mechanics, better feedback. Open a "Feature idea" issue first.
4. **Art**: new stickman poses, props or meme formats for the kit in `app/src/art/`.
5. **Play and report**: tell us where you got bored or confused. That's the most useful bug report there is.

## Add a world in 10 minutes

1. Copy `app/src/content/worlds/red-team.ts` to `app/src/content/worlds/your-world.ts`.
2. Change `id`, `title`, `tagline`, `accent` (a hex colour) and the `guide` (pose + face of the stickman).
3. Write units. Each unit needs **at least 4 cards**. Card types:

```ts
{ id: "xx-001", type: "choice", prompt: "Question?", options: ["A", "B", "C"], answer: 1, why: "One line: the idea in plain words." }
{ id: "xx-002", type: "cap", claim: "A claim an AI might make.", isCap: true, why: "Cap. Here's what's actually true." }
{ id: "xx-003", type: "predict", context: "Peanut butter and ___", options: [{ token: "jelly", p: 0.78 }, { token: "bread", p: 0.12 }], why: "..." }
{ id: "xx-004", type: "spot", prompt: "Which line is made up?", sentences: ["...", "...", "..."], answer: 2, why: "..." }
{ id: "xx-005", type: "order", prompt: "Put these in order:", steps: ["first", "second", "third"], why: "..." }
{ id: "xx-006", type: "type", prompt: "The word for ...", accept: ["word", "words"], hint: "optional", why: "..." }
```

   Optional on any card: `meme: { kind: "drake", no: "...", yes: "..." }` (also `galaxy`, `expect`, `buttons`, `fine`).
4. Add your world to the list in `app/src/content/index.ts`.
5. Run `npm run validate` and `npm test` in `app/`. Fix anything they flag.
6. Open a pull request. Screenshots of your world are great but not required.

## The voice

- **Ask first, explain after.** The question comes before the lesson.
- **Short.** Prompts under 25 words. `why` is one or two sentences.
- **Funny, never mean.** Write like a smart friend, not a textbook. Memes welcome.
- **True.** Every fact must be correct and still true next year. If it could change, don't use it.
- **No dashes in copy.** Use a colon, a comma, or a new sentence.
- **Safe for teens.** No slurs, no gore, nothing a 13-year-old couldn't show a parent.

## Ground rules

- Be kind. Assume good intent. Critique the card, not the person.
- No personal data in content, no real private individuals, no copyrighted characters.
- The app stores nothing about players on a server. Keep it that way: no trackers in PRs.

## Dev setup

```bash
cd app && npm install && npm run dev
```

Questions and ideas: [Discussions](https://github.com/DareDev256/passionate-learning/discussions), or open an issue.
