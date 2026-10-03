import { WORLDS } from "../src/content";
import { validateWorlds } from "../src/content/validate";

const errs = validateWorlds(WORLDS);
const cards = WORLDS.reduce((n, w) => n + w.units.reduce((m, u) => m + u.cards.length, 0), 0);
if (errs.length) { console.error(errs.join("\n")); console.error(`\n${errs.length} problem(s). Fix them before shipping.`); process.exit(1); }
console.log(`content ok: ${WORLDS.length} worlds, ${cards} cards`);
