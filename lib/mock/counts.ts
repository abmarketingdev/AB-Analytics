import { ORG, scaledPeople } from "./org";
import { CAMPAIGNS } from "./world";

/** ONE source for every headcount on screen. Four different numbers for "how
 *  many people work here" is the fastest way for a dashboard to lose trust —
 *  the command bar, the status bar, the greeting and the presence card all read
 *  from here. */
export function orgCounts() {
  const all = [...scaledPeople().values()];
  const staff = all.filter((p) => p.role !== "chief");   // sellers + leaders
  return {
    headcount: all.length,          // everyone, chiefs included
    staff: staff.length,            // everyone who knocks
    online: staff.filter((p) => p.online).length,
    teams: ORG.teams.length,
    chiefs: ORG.chiefs.length,
    campaigns: CAMPAIGNS.length,
  };
}
