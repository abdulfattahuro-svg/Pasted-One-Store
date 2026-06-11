import { useGetDashboardStats, useGetStatsByApp, useGetTopAffiliates, useGetEarningsTimeline, useReleaseHolds } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { ArrowUpRight, Users, MousePointer, UserPlus, TrendingUp, Clock, CheckCircle, DollarSign, RefreshCw, UserCheck, BarChart2, Award } from "lucide-react";
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

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmtCurrency(n);
}

type LeadEconomics = {
  totalExpectedValue: number;
  totalClosedDealValue: number;
  totalActualRevenue: number;
  avgDealSize: number;
  totalLeadCommissions: number;
  topAffiliatesByRevenue: Array<{ affiliateId: number; name: string; refCode: string; closedValue: number; commission: number; leads: number }>;
  topOffersByRevenue: Array<{ offerId: number; name: string; slug: string; closedValue: number; commission: number; leads: number; wonLeads: number }>;
};

const APP_LABELS: Record<string, string> = {};

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: byApp } = useGetStatsByApp();
  const { data: topAffiliates } = useGetTopAffiliates();
  const { data: timeline } = useGetEarningsTimeline();
  const releaseHolds = useReleaseHolds();
  const { toast } = useToast();

  const { data: economics } = useQuery<LeadEconomics>({
    queryKey: ["lead-economics"],
    queryFn: async () => {
      const res = await fetch("/api/stats/lead-economics", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

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

  const s = stats as Record<string, number> | undefined;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Network Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time affiliate performance across all offers</p>
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

      {/* Referral stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Affiliates" value={fmt(stats?.totalAffiliates ?? 0)} sub={`${stats?.activeAffiliates ?? 0} active`} icon={Users} />
        <StatCard label="Total Clicks" value={fmt(stats?.totalClicks ?? 0)} icon={MousePointer} color="text-blue-400" />
        <StatCard label="Signups" value={fmt(stats?.totalSignups ?? 0)} icon={UserPlus} color="text-violet-400" />
        <StatCard label="Conversions" value={fmt(stats?.totalConversions ?? 0)} icon={ArrowUpRight} color="text-primary" />
        <StatCard label="Total Revenue" value={fmtCurrency(stats?.totalRevenue ?? 0)} icon={DollarSign} color="text-amber-400" />
      </div>

      {/* Lead pipeline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={fmt(s?.totalLeads ?? 0)} sub="all time" icon={UserCheck} color="text-cyan-400" />
        <StatCard label="Approved Leads" value={fmt(s?.approvedLeads ?? 0)} sub="approved + won" icon={UserCheck} color="text-sky-400" />
        <StatCard label="Won Leads" value={fmt(s?.wonLeads ?? 0)} sub={`${s?.leadConversionPct ?? 0}% win rate`} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label="Lead Commissions" value={fmtCurrency(s?.leadRevenue ?? 0)} sub="from lead triggers" icon={DollarSign} color="text-amber-400" />
      </div>

      {/* Lead economics - deal values */}
      {economics && (economics.totalExpectedValue > 0 || economics.totalClosedDealValue > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead Economics</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pipeline</p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-violet-400">{fmtCompact(economics.totalExpectedValue)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">expected value</p>
            </div>
            <div className="bg-card border border-border rounded p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Closed Revenue</p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-400">{fmtCompact(economics.totalClosedDealValue)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">from won deals</p>
            </div>
            <div className="bg-card border border-border rounded p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Deal Size</p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-sky-400">{fmtCompact(economics.avgDealSize)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">per lead</p>
            </div>
            <div className="bg-card border border-border rounded p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Actual Revenue</p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-primary">{fmtCompact(economics.totalActualRevenue || economics.totalClosedDealValue)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">recorded revenue</p>
            </div>
          </div>

          {/* Top affiliates by revenue + top offers */}
          <div className="grid grid-cols-2 gap-4">
            {economics.topAffiliatesByRevenue.length > 0 && (
              <div className="bg-card border border-border rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Affiliates by Revenue</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-4 py-2">Affiliate</th>
                      <th className="text-right px-4 py-2">Closed</th>
                      <th className="text-right px-4 py-2">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {economics.topAffiliatesByRevenue.map((a, i) => (
                      <tr key={a.affiliateId} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-4 tabular-nums">#{i + 1}</span>
                            <div>
                              <p className="font-medium">{a.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{a.refCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-400 tabular-nums">
                          {a.closedValue > 0 ? fmtCompact(a.closedValue) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-primary tabular-nums">
                          {fmtCompact(a.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {economics.topOffersByRevenue.length > 0 && (
              <div className="bg-card border border-border rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Offers by Revenue</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-4 py-2">Offer</th>
                      <th className="text-right px-4 py-2">Leads</th>
                      <th className="text-right px-4 py-2">Won</th>
                      <th className="text-right px-4 py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {economics.topOffersByRevenue.map((o, i) => (
                      <tr key={o.offerId} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-4 tabular-nums">#{i + 1}</span>
                            <p className="font-medium">{o.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{o.leads}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-400">{o.wonLeads}</td>
                        <td className="px-4 py-2 text-right font-semibold text-primary tabular-nums">
                          {o.closedValue > 0 ? fmtCompact(o.closedValue) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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

        <div className="bg-card border border-border rounded p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Offer</p>
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
