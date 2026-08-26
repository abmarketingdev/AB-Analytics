"use client";

import { useEffect, useRef } from "react";
import { RadarMark } from "./RadarMark";
import { orgCounts } from "@/lib/mock/counts";
import { TOTAL_DOORS } from "@/lib/mock/world";
import { n } from "@/lib/format";

const WORD = "AB ANALYTICS";
export const TAGLINE = "Hver dør. Hver time. Hver selger.";

/** Real counts, not fake reassurance — read from the same source the command
 *  bar and status bar use, so the boot log cannot drift away from the console
 *  it is booting. In production these are the true row counts from the first
 *  payload. */
const C = orgCounts();
const LOG: Array<{ text: string; strong?: string; tail?: string; ok?: boolean }> = [
  { text: "Kobler til analysemotor", tail: " ok", ok: true },
  { text: "Laster ", strong: n(C.headcount), tail: ` personer · ${C.teams} team` },
  { text: "Indekserer ", strong: n(TOTAL_DOORS), tail: " dører" },
  { text: "Synkroniserer ", strong: String(C.campaigns), tail: " kampanjer" },
  { text: "Klar.", ok: true },
];

const DURATION = 4200;

export function BootSequence({
  name,
  onDone,
}: {
  name?: string;
  onDone?: () => void;
}) {
  const doneRef = useRef(false);

  // Hold the callback in a ref so the timer effect can run EXACTLY ONCE.
  // Passing `onDone` as a dep means every parent re-render restarts the
  // countdown — and a parent that ticks faster than DURATION (the login page's
  // door counter does) would reset it forever and never navigate.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  };

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const t = window.setTimeout(finish, reduce ? 400 : DURATION);

    // Any key or click skips ahead — never trap someone in a splash screen.
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="boot-playing fixed inset-0 z-100 grid cursor-pointer place-items-center bg-canvas">
      <div className="flex w-[min(420px,86vw)] flex-col items-center">
        <RadarMark size={74} />

        <div className="boot-word mt-[22px] flex text-[26px] font-extrabold tracking-[0.16em]">
          {WORD.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.75 + i * 0.03}s` }}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </div>

        <div className="boot-tag mt-3 text-center text-[14px] text-iris-soft">{TAGLINE}</div>

        <div className="boot-bar mt-[26px] h-[2px] w-full overflow-hidden rounded-sm bg-s2">
          <i />
        </div>

        <div className="boot-log mt-3.5 flex min-h-[92px] w-full flex-col gap-[5px] font-mono text-[11px] text-fg3">
          {LOG.map((l, i) => {
            const isLast = i === LOG.length - 1;
            return (
              <div key={i}>
                <span className={isLast || l.ok ? "text-ja" : undefined}>
                  {"› "}
                  {l.text}
                </span>
                {l.strong && <b className="font-medium text-fg1">{l.strong}</b>}
                {l.tail && <span className={l.ok ? "text-ja" : undefined}>{l.tail}</span>}
                {isLast && name && <span className="text-ja"> God kveld, {name}.</span>}
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-[11px] text-fg3">Trykk hvor som helst for å hoppe over</p>
      </div>
    </div>
  );
}
