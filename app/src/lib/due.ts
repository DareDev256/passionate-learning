/** When a card comes back, in words for the end of a sentence: "You will see this again <label>." Calendar days, local time. */
export function dueLabel(due: Date, now: Date = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(due) - day(now)) / 86400000);
  if (diff <= 0) return "in your next round";
  if (diff === 1) return "tomorrow";
  if (diff <= 6) return `on ${due.toLocaleDateString("en-US", { weekday: "long" })}`;
  return `on ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
