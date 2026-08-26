import { REGIONS } from "@/lib/mock/regions";
import { ORG, scaledPeople, type Person } from "@/lib/mock/org";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { mockCall } from "./client";

export type Health = "ok" | "watch" | "alert";

export interface RegionPresence {
  id: string; name: string; x: number; y: number;
  active: number; doorsPerHour: number; alerts: number; health: Health;
}

export interface AnomalyPin {
  id: string; name: string; initials: string; x: number; y: number;
  reason: string; severity: "crit" | "warn"; region: string;
}

export interface Presence {
  regions: RegionPresence[];
  anomalies: AnomalyPin[];
  online: number;
  headcount: number;
  quiet: number; // everyone who is fine — collapsed into a count, never plotted
}

const REASON: Record<NonNullable<Person["flag"]>, { text: string; sev: "crit" | "warn" }> = {
  under_normal: { text: "under egen normal 4. dag", sev: "crit" },
  no_full_day:  { text: "6 dager uten full dag",    sev: "crit" },
  proximity:    { text: "12 nærhetsbrudd",          sev: "warn" },
  late_start:   { text: "startet 16:40",            sev: "warn" },
  low_ja:       { text: "ja-rate 0,9 %",            sev: "warn" },
  no_gps:       { text: "uten GPS-signal",          sev: "warn" },
};

/** At national zoom the unit of information is the REGION, not the person.
 *  The only individuals ever plotted are the ones worth acting on — everyone
 *  else collapses into a count. */
export const fetchPresence = (chiefId = "all") =>
  mockCall<Presence>(() => {
    const people = scaledPeople();
    const teams = chiefId === "all" ? ORG.teams : ORG.teams.filter((t) => t.chiefId === chiefId);
    const teamIds = new Set(teams.map((t) => t.id));

    const inScope = [...people.values()].filter(
      (p) => p.role !== "chief" && p.teamId && teamIds.has(p.teamId),
    );
    const online = inScope.filter((p) => p.online);

    // deterministic region assignment, weighted to Oslo like the real business
    const WEIGHTS = [0.48, 0.17, 0.13, 0.09, 0.07, 0.06];
    const regionOf = (p: Person) => {
      const r = mulberry32(seedFrom("region:" + p.id))();
      let acc = 0;
      for (let i = 0; i < WEIGHTS.length; i++) {
        acc += WEIGHTS[i];
        if (r <= acc) return REGIONS[i].id;
      }
      return REGIONS[0].id;
    };

    const flagged = online.filter((p) => p.flag);

    const regions: RegionPresence[] = REGIONS.map((def) => {
      const here = online.filter((p) => regionOf(p) === def.id);
      const alerts = here.filter((p) => p.flag).length;
      const doors = here.reduce((a, p) => a + p.doorsToday, 0);
      // average of the individual paces, not today's partial doors over a full
      // day of active minutes — that ratio is always small and made every
      // region read "watch"
      const dph = here.length
        ? Number((here.reduce((a, p) => a + p.paceDoorsPerHour, 0) / here.length).toFixed(1))
        : 0;
      return {
        ...def,
        active: here.length,
        doorsPerHour: here.length ? dph : 0,
        alerts,
        health: (alerts > 1 ? "alert" : alerts === 1 || dph < 14 ? "watch" : "ok") as Health,
      };
    })
      .filter((r) => r.active > 0)
      .sort((a, b) => b.active - a.active);

    const anomalies: AnomalyPin[] = flagged.slice(0, 5).map((p) => {
      const rid = regionOf(p);
      const def = REGIONS.find((r) => r.id === rid) ?? REGIONS[0];
      const jitter = mulberry32(seedFrom("jit:" + p.id));
      const meta = REASON[p.flag!];
      return {
        id: p.id, name: p.name, initials: p.initials,
        x: def.x + (jitter() - 0.5) * 9,
        y: def.y + (jitter() - 0.5) * 9,
        reason: meta.text, severity: meta.sev, region: def.name,
      };
    });

    return {
      regions,
      anomalies,
      online: online.length,
      headcount: inScope.length,
      quiet: online.length - anomalies.length,
    };
  });
