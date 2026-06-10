import { useGetDashboardStats, useGetStatsByApp, useGetTopAffiliates, useGetEarningsTimeline, useReleaseHolds } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { ArrowUpRight, Users, MousePointer, UserPlus, TrendingUp, Clock, CheckCircle, DollarSign, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded bg-background ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

const APP_LABELS: Record<string, string> = {
  onetailor: "OneTailor",
  onesolar: "OneSolar",
  onesalon: "OneSalon",
};

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: byApp } = useGetStatsByApp();
  const { data: topAffiliates } = useGetTopAffiliates();
  const { data: timeline } = useGetEarningsTimeline();
  const releaseHolds = useReleaseHolds();
  const { toast } = useToast();

  const handleReleaseHolds = () => {
    releaseHolds.mutate(undefined, {
      onSuccess: (data) => {
        toast({ title: "Holds Released", description: data.message });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded p-4 h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Network Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time affiliate performance across all PWAs</p>
        </div>
        <button
          data-testid="button-release-holds"
          onClick={handleReleaseHolds}
          disabled={releaseHolds.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-secondary border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${releaseHolds.isPending ? "animate-spin" : ""}`} />
          Release Holds
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Affiliates" value={fmt(stats?.totalAffiliates ?? 0)} sub={`${stats?.activeAffiliates ?? 0} active`} icon={Users} />
        <StatCard label="Total Clicks" value={fmt(stats?.totalClicks ?? 0)} icon={MousePointer} color="text-blue-400" />
        <StatCard label="Signups" value={fmt(stats?.totalSignups ?? 0)} icon={UserPlus} color="text-violet-400" />
        <StatCard label="Conversions" value={fmt(stats?.totalConversions ?? 0)} icon={ArrowUpRight} color="text-primary" />
        <StatCard label="Total Revenue" value={fmtCurrency(stats?.totalRevenue ?? 0)} icon={DollarSign} color="text-amber-400" />
      </div>

      {/* Earnings breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded p-4" data-testid="stat-hold-amount">
          <p className="text-[10px] uppercase tracking-wider text-amber-400">On Hold</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{fmtCurrency(stats?.holdAmount ?? 0)}</p>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <p className="text-[10px] text-muted-foreground">14-day hold period</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded p-4" data-testid="stat-payable-amount">
          <p className="text-[10px] uppercase tracking-wider text-blue-400">Payable</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{fmtCurrency(stats?.payableAmount ?? 0)}</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <p className="text-[10px] text-muted-foreground">Ready to disburse</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded p-4" data-testid="stat-paid-amount">
          <p className="text-[10px] uppercase tracking-wider text-primary">Paid Out</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{fmtCurrency(stats?.paidAmount ?? 0)}</p>
          <div className="flex items-center gap-1 mt-1">
            <CheckCircle className="w-3 h-3 text-primary" />
            <p className="text-[10px] text-muted-foreground">{stats?.pendingPayouts ?? 0} pending payouts</p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Earnings timeline */}
        <div className="col-span-2 bg-card border border-border rounded p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Earnings — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timeline ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 12%)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                tick={{ fontSize: 10, fill: "hsl(240 5% 65%)" }}
                interval={6}
              />
              <YAxis tick={{ fontSize: 10, fill: "hsl(240 5% 65%)" }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 10% 12%)", borderRadius: 4, fontSize: 11 }}
                formatter={(v: number) => [`$${v}`, "Earnings"]}
              />
              <Line type="monotone" dataKey="earnings" stroke="hsl(153 60% 53%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* By app */}
        <div className="bg-card border border-border rounded p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">By App</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={(Array.isArray(byApp) ? byApp : []).filter(a => a.conversions > 0 || a.clicks > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 12%)" />
              <XAxis dataKey="appName" tick={{ fontSize: 9, fill: "hsl(240 5% 65%)" }} tickFormatter={(v: string) => APP_LABELS[v] ?? v} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(240 5% 65%)" }} />
              <Tooltip
                contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 10% 12%)", borderRadius: 4, fontSize: 11 }}
                labelFormatter={(v: string) => APP_LABELS[v] ?? v}
              />
              <Bar dataKey="conversions" fill="hsl(153 60% 53%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="clicks" fill="hsl(200 90% 60% / 0.4)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top affiliates */}
      <div className="bg-card border border-border rounded">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Affiliates</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Ref Code</th>
              <th className="text-right px-4 py-2">Clicks</th>
              <th className="text-right px-4 py-2">Conversions</th>
              <th className="text-right px-4 py-2">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(topAffiliates) ? topAffiliates : []).map((a, i) => (
              <tr key={a.affiliateId} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                data-testid={`row-top-affiliate-${a.affiliateId}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4 tabular-nums">#{i + 1}</span>
                    <div>
                      <p className="font-medium text-xs">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[10px] bg-secondary px-2 py-0.5 rounded">{a.refCode}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">{fmt(a.clicks)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">{fmt(a.conversions)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-primary font-semibold">{fmtCurrency(a.totalEarnings)}</td>
              </tr>
            ))}
            {!topAffiliates?.length && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">No affiliates yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
