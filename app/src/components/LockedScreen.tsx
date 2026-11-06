import Link from "next/link";
import { Stick } from "@/art/Stick";
import type { Unit, World } from "@/content/types";

/** Shown instead of a round when a unit is opened by direct URL before the one ahead of it is cleared. */
export function LockedScreen({ world, unit, blocker }: { world: World; unit: Unit; blocker: Unit }) {
  return (
    <main className="round locked-screen" style={{ ["--wa" as string]: world.accent } as React.CSSProperties}>
      <Stick pose="point" face="happy" size={104} />
      <h1 className="world-h1">Finish &quot;{blocker.title}&quot; first</h1>
      <p className="world-sub">&quot;{unit.title}&quot; opens when you clear &quot;{blocker.title}&quot; at 70%.</p>
      <Link className="btn block" href={`/w/${world.id}/`}>Back to {world.title}</Link>
    </main>
  );
}
