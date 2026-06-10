import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Filter, UserCheck, Phone, Mail, Package, Clock, CheckCircle, XCircle, Users, TrendingUp, AlertCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Lead = {
  id: number;
  affiliateId: number;
  affiliateCode: string;
  productId: number | null;
  productSlug: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: "new" | "contacted" | "interested" | "won" | "lost";
  source: string;
  approvedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  affiliate: { id: number; name: string; email: string } | null;
  product: { id: number; name: string; slug: string } | null;
};

type Product = { id: number; name: string; slug: string; active: boolean };
type Affiliate = { id: number; name: string; email: string; refCode: string };

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Request failed");
  }
  return res.json();
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: AlertCircle },
  contacted: { label: "Contacted", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Phone },
  interested: { label: "Interested", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", icon: TrendingUp },
  won: { label: "Won", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  lost: { label: "Lost", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

const STATUSES = ["new", "contacted", "interested", "won", "lost"] as const;

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  if (!meta) return <span className="text-xs text-muted-foreground">{status}</span>;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${meta.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

function StatusDropdown({ leadId, current, onUpdate }: { leadId: number; current: string; onUpdate: (id: number, status: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        <StatusBadge status={current} />
        <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded shadow-lg py-1 min-w-[140px]">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { onUpdate(leadId, s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2 ${s === current ? "text-primary" : "text-foreground"}`}
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Leads() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterAffiliate, setFilterAffiliate] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = new URLSearchParams();
  if (filterStatus) params.set("status", filterStatus);
  if (filterAffiliate) params.set("affiliateId", filterAffiliate);
  if (filterProduct) params.set("productSlug", filterProduct);
  if (search) params.set("search", search);
  const qs = params.toString();

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["leads", qs],
    queryFn: () => apiFetch(`/leads${qs ? `?${qs}` : ""}`),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });

  const { data: affiliates } = useQuery<Affiliate[]>({
    queryKey: ["affiliates"],
    queryFn: () => apiFetch("/affiliates"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalLeads = leads?.length ?? 0;
  const thisMonth = leads?.filter(l => {
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length ?? 0;
  const wonLeads = leads?.filter(l => l.status === "won").length ?? 0;
  const newLeads = leads?.filter(l => l.status === "new").length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Offline and manually submitted leads</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: totalLeads, icon: Users, color: "text-foreground" },
          { label: "This Month", value: thisMonth, icon: Clock, color: "text-blue-400" },
          { label: "New", value: newLeads, icon: AlertCircle, color: "text-amber-400" },
          { label: "Won", value: wonLeads, icon: CheckCircle, color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
              </div>
              <div className={`p-2 rounded bg-background ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
          className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Products</option>
          {(products ?? []).filter(p => p.active).map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <select
          value={filterAffiliate}
          onChange={e => setFilterAffiliate(e.target.value)}
          className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Affiliates</option>
          {(affiliates ?? []).map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 animate-pulse flex gap-3">
                <div className="h-3 bg-border rounded w-32" />
                <div className="h-3 bg-border rounded w-24" />
                <div className="h-3 bg-border rounded w-20" />
              </div>
            ))}
          </div>
        ) : !leads?.length ? (
          <div className="py-16 text-center">
            <UserCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No leads found</p>
            <p className="text-xs text-muted-foreground mt-1">Affiliates can submit leads from their portal</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2.5">Lead</th>
                <th className="text-left px-4 py-2.5">Contact</th>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5">Affiliate</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold">{lead.fullName}</p>
                    {lead.notes && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate">{lead.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 space-y-0.5">
                    {lead.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-[10px] text-muted-foreground">{lead.email}</p>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-[10px] text-muted-foreground">{lead.phone}</p>
                      </div>
                    )}
                    {!lead.email && !lead.phone && <span className="text-[10px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.product ? (
                      <div className="flex items-center gap-1">
                        <Package className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs">{lead.product.name}</p>
                      </div>
                    ) : lead.productSlug ? (
                      <p className="text-[10px] font-mono text-muted-foreground">{lead.productSlug}</p>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.affiliate ? (
                      <div>
                        <p className="text-xs font-medium">{lead.affiliate.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{lead.affiliateCode}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] font-mono text-muted-foreground">{lead.affiliateCode}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDropdown
                      leadId={lead.id}
                      current={lead.status}
                      onUpdate={(id, status) => updateStatus.mutate({ id, status })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
