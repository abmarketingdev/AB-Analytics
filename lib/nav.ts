import {
  LayoutGrid, Crosshair, Users, BarChart3, Flag,
  TriangleAlert, Radio, FileText, type LucideIcon,
} from "lucide-react";

export type BadgeKind = "alerts" | "online" | null;

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  badge: BadgeKind;
  /** the single question this screen answers — shown in the palette + tooltip */
  job: string;
}

export const NAV: NavItem[] = [
  { href: "/",           label: "Kommandosenter",  short: "Oversikt", icon: LayoutGrid,    badge: null,     job: "Er vi i rute nå, og hvem trenger meg?" },
  { href: "/geografi",   label: "Geografi",        short: "Geo",      icon: Crosshair,     badge: null,     job: "Hvor vinner vi, og hvor er de uknokkede dørene?" },
  { href: "/personer",   label: "Personer",        short: "Personer", icon: Users,         badge: null,     job: "Alt om ett menneske, på ett sted." },
  { href: "/rangering",  label: "Rangering",       short: "Rangering",icon: BarChart3,     badge: null,     job: "Hvem er best, hvem er svakest — og hvilken form har organisasjonen?" },
  { href: "/kampanjer",  label: "Kampanjer",       short: "Kampanjer",icon: Flag,          badge: null,     job: "Hvordan går hver kampanje over tid?" },
  { href: "/terskler",   label: "Terskler & avvik",short: "Terskler", icon: TriangleAlert, badge: "alerts", job: "Hvem er under grensen — og hvorfor?" },
  { href: "/live",       label: "Live & rute",     short: "Live",     icon: Radio,         badge: "online", job: "Hva skjer nå — og hva skjedde den dagen?" },
  { href: "/rapporter",  label: "Rapporter",       short: "Rapporter",icon: FileText,      badge: null,     job: "Eksporter, planlegg, og bevis at det ble sendt." },
];

export function activeHref(pathname: string): string {
  if (pathname === "/") return "/";
  const hit = NAV.find((it) => it.href !== "/" && pathname.startsWith(it.href));
  return hit ? hit.href : "/";
}
