import { useState } from "react";
import { useListEvents } from "@workspace/api-client-react";
import { Filter } from "lucide-react";

const APP_LABELS: Record<string, string> = {
  onetailor: "OneTailor",
  onesolar: "OneSolar",
  onesalon: "OneSalon",
};

const APPS = ["onetailor", "onesolar", "onesalon"];

export default function Events() {
  const [eventType, setEventType] = useState<string>("");
  const [appName, setAppName] = useState<string>("");

  const { data: events, isLoading } = useListEvents({
    eventType: (eventType as "click" | "signup") || undefined,
    appName: appName || undefined,
    limit: 100,
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Referral Events</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{events?.length ?? 0} events</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            data-testid="select-event-type"
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value="click">Click</option>
            <option value="signup">Signup</option>
          </select>
          <select
            data-testid="select-app"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Apps</option>
            {APPS.map(a => <option key={a} value={a}>{APP_LABELS[a]}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-2.5">Event</th>
              <th className="text-left px-4 py-2.5">App</th>
              <th className="text-left px-4 py-2.5">Ref Code</th>
              <th className="text-left px-4 py-2.5">User ID</th>
              <th className="text-left px-4 py-2.5">IP Address</th>
              <th className="text-left px-4 py-2.5">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</td></tr>
            )}
            {!isLoading && events?.map(e => (
              <tr key={e.id} data-testid={`row-event-${e.id}`} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                    e.eventType === "signup" ? "bg-violet-500/10 text-violet-400" : "bg-secondary text-muted-foreground"
                  }`}>
                    {e.eventType}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">{APP_LABELS[e.appName] ?? e.appName}</td>
                <td className="px-4 py-2.5 font-mono text-[10px]">{e.refCode}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{e.userId ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{e.ipAddress ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!isLoading && !events?.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
