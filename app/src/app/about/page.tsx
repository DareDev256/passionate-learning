import Link from "next/link";
import { Logo } from "@/art/Logo";
import { Stick } from "@/art/Stick";
import { WORLDS, CATALOGUE_DATE } from "@/content";
import pkg from "../../../package.json";

export const metadata = { title: "About | Passionate Learning" };

export default function About() {
  const cards = WORLDS.reduce((n, w) => n + w.units.reduce((m, u) => m + u.cards.length, 0), 0);
  return (
    <main className="wrap">
      <header className="topbar"><Link className="x" href="/" aria-label="Back to the map">←</Link><Logo size={40} /></header>
      <div className="guide"><Stick pose="present" face="happy" size={92} /><p className="bubble">Built so anyone can learn AI in <em>60-second rounds</em>, and so anyone can add to it.</p></div>
      <h2 className="h2">How it teaches</h2>
      <p>Every card asks before it explains. Short rounds. The stickman reacts to every answer. Old cards come back right before you would forget them (spaced repetition). A unit is mastered at 90% over your last three rounds. There is no streak to lose: one round counts as a full day, and a missed day resets nothing.</p>
      <h2 className="h2">Build it with us</h2>
      <p>Passionate Learning is open source. A new world is one data file: write cards, open a pull request, and it ships to everyone. Game designers, teachers and people who just learned something: all welcome.</p>
      <p><a className="btn" href="https://github.com/DareDev256/passionate-learning">CONTRIBUTE ON GITHUB</a></p>
      <p className="foot">v{pkg.version} · catalogue {CATALOGUE_DATE} · {WORLDS.length} worlds · {cards} cards · made by <a href="https://jamesdare.com">James Dare</a> (DareDev256), Toronto</p>
    </main>
  );
}
