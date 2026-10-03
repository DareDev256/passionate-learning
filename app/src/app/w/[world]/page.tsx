import { notFound } from "next/navigation";
import { WORLDS, getWorld } from "@/content";
import { WorldView } from "@/components/WorldView";

export const dynamicParams = false;
export function generateStaticParams() {
  return WORLDS.filter((w) => w.status === "live").map((w) => ({ world: w.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ world: string }> }) {
  const w = getWorld((await params).world);
  return { title: w ? `${w.title} | Passionate Learning` : "Passionate Learning", description: w?.tagline };
}

export default async function Page({ params }: { params: Promise<{ world: string }> }) {
  const w = getWorld((await params).world);
  if (!w || w.status !== "live") notFound();
  return <WorldView worldId={w.id} />;
}
