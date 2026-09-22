/** The key that triggers the action next to it. Linear shows one on every
 *  action; a hint you never read still teaches you the key over time. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      aria-hidden="true"
      style={{
        display: "inline-grid", placeItems: "center", minWidth: 16, height: 16, padding: "0 4px",
        borderRadius: 4, border: "1px solid var(--line2, var(--line))", background: "var(--sunk, var(--s2))",
        color: "var(--tx3, var(--fg3))", font: "500 10.5px/1 'IBM Plex Mono', monospace",
      }}
    >
      {children}
    </kbd>
  );
}
