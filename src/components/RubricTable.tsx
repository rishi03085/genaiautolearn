import type { CheckResult } from "@/lib/checks";
import { cn } from "@/lib/utils";

export function PassBadge({ pass }: { pass: boolean }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide",
      pass ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground")}>
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

export function RubricTable({ checks }: { checks: CheckResult[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="p-2.5">Check</th><th className="p-2.5">Result</th><th className="p-2.5">Reason</th></tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} className="border-t border-border align-top">
              <td className="p-2.5"><span className="font-mono text-xs text-muted-foreground">{c.id}</span> {c.name}</td>
              <td className="p-2.5"><PassBadge pass={c.pass} /></td>
              <td className="p-2.5 text-muted-foreground">{c.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
