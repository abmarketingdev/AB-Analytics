import type { KeyboardEvent } from "react";

/**
 * Props that turn a clickable <div> into something a keyboard can actually use.
 *
 * Several rows in the console (a person, a campaign, a chief, a bar in the day
 * graph) are divs with an onClick, because they hold a grid of cells that a
 * <button> would not lay out the same way. That works with a mouse and is
 * invisible to Tab and to a screen reader. Spreading this onto the element
 * gives it the button role, a tab stop, and Enter/Space to activate.
 */
export function clickable(onActivate: () => void, label?: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    ...(label ? { "aria-label": label } : {}),
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/** Same, for a row that expands rather than navigates. */
export function expandable(onToggle: () => void, expanded: boolean, label?: string) {
  return {
    ...clickable(onToggle, label),
    "aria-expanded": expanded,
  };
}
