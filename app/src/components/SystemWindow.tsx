import type { ReactNode } from "react";

/**
 * The "System" layer: a dark holographic panel that interrupts the doodle page, the way a system message
 * interrupts a story. Original design: bracketed header, cyan edge glow, corner ticks.
 */
export function SystemWindow({ title, children, tone = "info", className = "" }: { title: string; children: ReactNode; tone?: "info" | "alert" | "gold"; className?: string }) {
  return (
    <section className={`sys sys-${tone} ${className}`} role="status" aria-live="polite">
      <span className="sys-tick tl" aria-hidden="true" />
      <span className="sys-tick tr" aria-hidden="true" />
      <span className="sys-tick bl" aria-hidden="true" />
      <span className="sys-tick br" aria-hidden="true" />
      <header className="sys-head">
        <span className="sys-bang" aria-hidden="true">!</span>
        <span>[ {title} ]</span>
      </header>
      <div className="sys-body">{children}</div>
    </section>
  );
}
