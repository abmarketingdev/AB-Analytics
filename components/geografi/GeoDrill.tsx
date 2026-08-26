"use client";

import { ChevronRight, ArrowLeft } from "lucide-react";
import type { GeoNode } from "@/lib/api/geo";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface Crumb { level: "root" | "fylke" | "kommune"; code: string | null; name: string }

const LEVEL_LABEL: Record<string, string> = {
  root: "Fylke", fylke: "Kommune", kommune: "Område", grunnkrets: "Område",
};

export function GeoBreadcrumb({ trail, onJump }: { trail: Crumb[]; onJump: (i: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[12.5px]">
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={`${c.level}:${c.code}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-fg3" />}
            <button
              type="button"
              disabled={last}
              onClick={() => onJump(i)}
              className={cn(
                "rounded px-1.5 py-0.5",
                last ? "font-semibold text-fg1" : "cursor-pointer text-fg3 hover:text-iris-soft",
              )}
            >
              {c.name}
            </button>
          </span>
        );
      })}
    </div>
  );
}

export function GeoDrillList({
  nodes, level, onDrill, onBack, canBack, selectedCode,
}: {
  nodes: GeoNode[];
  level: "root" | "fylke" | "kommune";
  onDrill: (nd: GeoNode) => void;
  onBack: () => void;
  canBack: boolean;
  selectedCode: string | null;
}) {
  const totalDoors = nodes.reduce((a, x) => a + x.doors, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 pb-2">
        {canBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1 text-[11.5px] text-iris-soft hover:text-fg1"
          >
            <ArrowLeft size={12} /> Tilbake
          </button>
        )}
        <span className="t-label ml-auto">{LEVEL_LABEL[level]} · {nodes.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {nodes.length === 0 && (
          <p className="px-1 py-6 text-center text-[12.5px] text-fg3">Ingen områder her.</p>
        )}

        {nodes.map((nd) => (
          <button
            key={nd.key}
            type="button"
            onClick={() => onDrill(nd)}
            className={cn(
              "mb-1 w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
              selectedCode === nd.code
                ? "border-iris/60 bg-iris/12"
                : "border-transparent hover:border-line2 hover:bg-s2",
            )}
          >
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{nd.name}</span>
              <span data-num className="text-[11px] text-fg3">{n(nd.doors)}</span>
            </span>

            {/* penetration bar — the single most useful thing at a glance */}
            <span className="mt-1.5 block h-[5px] overflow-hidden rounded-sm bg-s3">
              <span
                className="block h-full rounded-sm"
                style={{ width: `${Math.min(100, nd.penetration)}%`, background: "var(--iris)" }}
              />
            </span>

            <span className="mt-1 flex items-center gap-2 font-mono text-[10px] text-fg3">
              <span>{n1(nd.penetration)} % banket</span>
              <span className={nd.jaRate >= 3 ? "text-ja" : undefined}>{n1(nd.jaRate)} % ja</span>
              <span className="ml-auto text-ih">{n(nd.remaining)} igjen</span>
            </span>
          </button>
        ))}
      </div>

      {nodes.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-mono text-[10.5px] text-fg3">
          <span>{nodes.length} enheter</span>
          <span data-num>{n(totalDoors)} dører</span>
        </div>
      )}
    </div>
  );
}
