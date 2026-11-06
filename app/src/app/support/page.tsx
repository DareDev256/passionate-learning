import Link from "next/link";
import { Logo } from "@/art/Logo";

export const metadata = { title: "Support | Passionate Learning" };

export default function Support() {
  return (
    <main className="wrap">
      <header className="topbar"><Link className="x" href="/settings/" aria-label="Back to settings">←</Link><Logo size={40} /></header>
      <h1 className="h2">Support</h1>
      <p>Something broken, confusing or wrong? Email <a href="mailto:james@stiersolutions.ca">james@stiersolutions.ca</a> and a real person will read it.</p>
      <h2 className="h2">What to include in a bug report</h2>
      <ul>
        <li>What you were doing and what you expected to happen.</li>
        <li>What happened instead. A screenshot helps a lot.</li>
        <li>Your device and iOS version, and the app version (it is at the bottom of Settings).</li>
        <li>The world and unit you were in, if it was during a round.</li>
      </ul>
      <p>Found a wrong or unclear card? Tell us which one and what it should say.</p>
      <p className="foot">Passionate Learning is made by S-Tier Solutions Inc. See also the <Link href="/privacy/">privacy page</Link>.</p>
    </main>
  );
}
