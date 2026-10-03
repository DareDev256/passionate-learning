import { notFound } from "next/navigation";
import { WORLDS, getUnit, getWorld } from "@/content";
import { RoundPlayer } from "@/components/RoundPlayer";

export const dynamicParams = false;
export function generateStaticParams() {
  return WORLDS.filter((w) => w.status === "live").flatMap((w) => w.units.map((u) => ({ world: w.id, unit: u.id })));
}

export async function generateMetadata({ params }: { params: Promise<{ world: string; unit: string }> }) {
  const p = await params;
  const w = getWorld(p.world), u = getUnit(p.world, p.unit);
  return { title: w && u ? `${u.title} · ${w.title} | Passionate Learning` : "Passionate Learning" };
}

export default async function Page({ params }: { params: Promise<{ world: string; unit: string }> }) {
  const p = await params;
  if (!getUnit(p.world, p.unit)) notFound();
  return <RoundPlayer worldId={p.world} unitId={p.unit} />;
}
