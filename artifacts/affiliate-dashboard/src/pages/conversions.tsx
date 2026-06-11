import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListConversions } from "@workspace/api-client-react";
import { Clock, Filter } from "lucide-react";

type Offer = { id: number; name: string; slug: string };

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  HOLD: "bg-amber-500/10 text-amber-400",
  PAYABLE: "bg-blue-500/10 text-blue-400",
  PAID: "bg-primary/10 text-primary",
};

const STATUSES = ["HOLD", "PAYABLE", "PAID"];

export default function Conversions() {
  const [status, setStatus] = useState<string>("");
  const [appName, setAppName] = useState<string>("");

  const { data: offers = [] } = useQuery<Offer[]>({
    queryKey: ["offers-list"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: conversions, isLoading } = useListConversions({
    status: (status as "HOLD" | "PAYABLE" | "PAID") || undefined,
    appName: appName || undefined,
  });

  const offerLabel = (slug: string) =>
    offers.find(o => o.slug === slug)?.name ?? slug;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Conversions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{conversions?.length ?? 0} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            data-testid="select-status"
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="text-xs bg-card border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            data-testid="select-app"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            className="text-xs bg-card border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
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
              <th className="text-left px-4 py-2.5">Payment ID</th>
              <th className="text-left px-4 py-2.5">Offer</th>
              <th className="text-left px-4 py-2.5">User</th>
              <th className="text-right px-4 py-2.5">Amount</th>
              <th className="text-right px-4 py-2.5">Commission</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Hold Until</th>
              <th className="text-left px-4 py-2.5">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</td></tr>
            )}
            {!isLoading && conversions?.map(c => (
              <tr key={c.id} data-testid={`row-conversion-${c.id}`} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{c.paymentId}</td>
                <td className="px-4 py-2.5 text-xs">{offerLabel(c.appName)}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{c.userId}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">{fmtCurrency(c.amount)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-primary">{fmtCurrency(c.commission)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${STATUS_COLORS[c.status] ?? ""}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {c.status === "HOLD" ? (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(c.holdEndDate).toLocaleDateString()}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(c.conversionDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {!isLoading && !conversions?.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">No conversions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
