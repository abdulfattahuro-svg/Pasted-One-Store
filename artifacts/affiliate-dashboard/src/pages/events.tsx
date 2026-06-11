import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListEvents } from "@workspace/api-client-react";
import { Filter } from "lucide-react";

type Offer = { id: number; name: string; slug: string };

export default function Events() {
  const [eventType, setEventType] = useState<string>("");
  const [appName, setAppName] = useState<string>("");

  const { data: offers = [] } = useQuery<Offer[]>({
    queryKey: ["offers-list"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: events, isLoading } = useListEvents({
    eventType: (eventType as "click" | "signup") || undefined,
    appName: appName || undefined,
    limit: 100,
  });

  const offerLabel = (slug: string) =>
    offers.find(o => o.slug === slug)?.name ?? slug;

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
            <option value="">All Offers</option>
            {offers.length === 0 ? (
              <option disabled value="">No offers available</option>
            ) : (
              offers.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)
            )}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-2.5">Event</th>
              <th className="text-left px-4 py-2.5">Offer</th>
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
                <td className="px-4 py-2.5 text-xs">{offerLabel(e.appName)}</td>
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
