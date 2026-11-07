import Link from "next/link";
import { Logo } from "@/art/Logo";

export const metadata = { title: "Privacy | Passionate Learning" };

export default function Privacy() {
  return (
    <main className="wrap">
      <header className="topbar"><Link className="x" href="/settings/" aria-label="Back to settings">←</Link><Logo size={40} /></header>
      <h1 className="h2">Privacy</h1>
      <p>Passionate Learning keeps your progress on your own device, and only there.</p>
      <h2 className="h2">What we store</h2>
      <p>Your XP, rank, days played, which cards you have seen and your settings are saved on this device. There are no accounts. Clearing the app&apos;s data removes all of it. Reset progress in Settings removes your progress and keeps your settings.</p>
      <h2 className="h2">What we send</h2>
      <p>Nothing. The app does not send your progress, your name or anything else about you to us or to anyone else.</p>
      <h2 className="h2">What we do not do</h2>
      <p>No ads. No tracking. No analytics.</p>
      <h2 className="h2">Questions</h2>
      <p>Write to <a href="mailto:james@stiersolutions.ca">james@stiersolutions.ca</a>, or see the <Link href="/support/">support page</Link>.</p>
      <p className="foot">Published by S-Tier Solutions Inc.</p>
    </main>
  );
}
