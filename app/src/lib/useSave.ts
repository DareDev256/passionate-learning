"use client";
import { useCallback, useEffect, useState } from "react";
import { type Save, freshSave, loadSave, writeSave } from "./save";

/** Client-only save. Renders with a fresh save on the server, then hydrates from localStorage. */
export function useSave() {
  const [save, setSave] = useState<Save>(freshSave);
  const [ready, setReady] = useState(false);
  // Hydrate after mount on purpose: the static HTML is rendered without localStorage, so reading it during
  // render would mismatch. One extra render on load is the cost.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSave(loadSave()); setReady(true); }, []);
  const update = useCallback((next: Save) => { setSave(next); writeSave(next); }, []);
  return { save, update, ready };
}
