import Link from "next/link";
import { Stick } from "@/art/Stick";

export const metadata = { title: "Not found | Passionate Learning" };

export default function NotFound() {
  return (
    <main className="wrap">
      <div className="guide"><Stick pose="shrug" face="shock" size={110} /><p className="bubble">That page is not here. The stickman looked everywhere.</p></div>
      <h1 className="h2">This page wandered off</h1>
      <p>The link may be old, or the page may have moved. Nothing is lost: your progress is exactly where you left it.</p>
      <p><Link className="btn" href="/">MAP</Link></p>
    </main>
  );
}
