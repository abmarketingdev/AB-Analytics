import { Card } from "./Card";

/** Placeholder for screens not yet built. Names the job so the skeleton still
 *  documents intent rather than showing an empty box. */
export function PageStub({
  title,
  job,
  phase,
}: {
  title: string;
  job: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="t-display">{title}</h2>
        <p className="mt-2 max-w-[60ch] text-[14px] text-fg2">{job}</p>
      </div>
      <Card className="items-start gap-3">
        <span className="t-label">Ikke bygget ennå</span>
        <p className="max-w-[60ch] text-[13px] text-fg2">
          Skallet, tokens og navigasjonen er på plass. Denne skjermen kommer i {phase}.
        </p>
      </Card>
    </div>
  );
}
