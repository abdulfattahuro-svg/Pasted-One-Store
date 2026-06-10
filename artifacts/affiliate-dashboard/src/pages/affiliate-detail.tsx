import { useGetAffiliate, getGetAffiliateQueryKey, useGetAffiliateStats, useListConversions, useListEvents, useUpdateAffiliate, getListAffiliatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Copy, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HOLD: "bg-amber-500/10 text-amber-400",
    PAYABLE: "bg-blue-500/10 text-blue-400",
    PAID: "bg-primary/10 text-primary",
    click: "bg-secondary text-muted-foreground",
    signup: "bg-violet-500/10 text-violet-400",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${colors[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export default function AffiliateDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: affiliate, isLoading } = useGetAffiliate(id, { query: { enabled: !!id, queryKey: getGetAffiliateQueryKey(id) } });
  const { data: stats } = useGetAffiliateStats(id, { query: { enabled: !!id } });
  const { data: conversions } = useListConversions({ affiliateId: id });
  const { data: events } = useListEvents({ affiliateId: id });
  const updateAffiliate = useUpdateAffiliate();

  const handleCopyRef = () => {
    if (affiliate) {
      navigator.clipboard.writeText(affiliate.refCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleStatus = () => {
    if (!affiliate) return;
    const newStatus = affiliate.status === "active" ? "suspended" : "active";
    updateAffiliate.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAffiliateQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListAffiliatesQueryKey() });
        toast({ title: `Affiliate ${newStatus}`, description: `${affiliate.name} is now ${newStatus}` });
      },
    });
  };

  if (isLoading) return <div className="p-8 text-xs text-muted-foreground">Loading...</div>;
  if (!affiliate) return <div className="p-8 text-xs text-muted-foreground">Affiliate not found</div>;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          data-testid="button-back"
          onClick={() => setLocation("/affiliates")}
          className="mt-0.5 p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{affiliate.name}</h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
              affiliate.status === "active" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}>
              {affiliate.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{affiliate.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-secondary border border-border px-3 py-1.5 rounded">
            <span className="font-mono text-xs">{affiliate.refCode}</span>
            <button data-testid="button-copy-ref" onClick={handleCopyRef} className="text-muted-foreground hover:text-foreground">
              {copied ? <CheckCircle className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <button
            data-testid="button-toggle-status"
            onClick={toggleStatus}
            disabled={updateAffiliate.isPending}
            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
              affiliate.status === "active"
                ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                : "border-primary/50 text-primary hover:bg-primary/10"
            }`}
          >
            {affiliate.status === "active" ? "Suspend" : "Activate"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Clicks", value: stats?.clicks ?? 0, icon: TrendingUp, color: "text-blue-400" },
          { label: "Signups", value: stats?.signups ?? 0, icon: CheckCircle, color: "text-violet-400" },
          { label: "Conversions", value: stats?.conversions ?? 0, icon: TrendingUp, color: "text-primary" },
          { label: "Total Earnings", value: fmtCurrency(stats?.totalEarnings ?? 0), icon: TrendingUp, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded p-3">
          <p className="text-[10px] uppercase text-amber-400">Hold</p>
          <p className="text-lg font-bold tabular-nums mt-1">{fmtCurrency(stats?.holdAmount ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded p-3">
          <p className="text-[10px] uppercase text-blue-400">Payable</p>
          <p className="text-lg font-bold tabular-nums mt-1">{fmtCurrency(stats?.payableAmount ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded p-3">
          <p className="text-[10px] uppercase text-primary">Paid</p>
          <p className="text-lg font-bold tabular-nums mt-1">{fmtCurrency(stats?.paidAmount ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Recent events */}
        <div className="bg-card border border-border rounded">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Events</p>
          </div>
          <div className="divide-y divide-border">
            {events?.slice(0, 8).map(e => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between" data-testid={`row-event-${e.id}`}>
                <div>
                  <StatusBadge status={e.eventType} />
                  <span className="ml-2 text-xs">{e.appName}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {!events?.length && <p className="px-4 py-4 text-xs text-muted-foreground">No events yet</p>}
          </div>
        </div>

        {/* Conversions */}
        <div className="bg-card border border-border rounded">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversions</p>
          </div>
          <div className="divide-y divide-border">
            {conversions?.slice(0, 8).map(c => (
              <div key={c.id} className="px-4 py-2.5 flex items-center justify-between" data-testid={`row-conversion-${c.id}`}>
                <div>
                  <StatusBadge status={c.status} />
                  <span className="ml-2 text-xs">{c.appName}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tabular-nums text-primary">{fmtCurrency(c.commission)}</p>
                  {c.status === "HOLD" && (
                    <div className="flex items-center gap-0.5 justify-end">
                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                      <p className="text-[10px] text-amber-400">
                        until {new Date(c.holdEndDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!conversions?.length && <p className="px-4 py-4 text-xs text-muted-foreground">No conversions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
