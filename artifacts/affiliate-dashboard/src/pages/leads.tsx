import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Search, Filter, UserCheck, Phone, Mail, Package, Clock, CheckCircle,
  XCircle, Users, TrendingUp, AlertCircle, ChevronDown, List, LayoutGrid,
  ThumbsUp, ThumbsDown, Milestone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Lead = {
  id: number;
  affiliateId: number;
  affiliateCode: string;
  productId: number | null;
  productSlug: string | null;
  offerName: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  source: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  wonAt: string | null;
  lostAt: string | null;
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

const STATUS_META: Record<string, { label: string; color: string; cardColor: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", cardColor: "border-t-blue-500/60", icon: AlertCircle },
  contacted: { label: "Contacted", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", cardColor: "border-t-amber-500/60", icon: Phone },
  interested: { label: "Interested", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", cardColor: "border-t-violet-500/60", icon: TrendingUp },
  approved: { label: "Approved", color: "bg-sky-500/10 text-sky-400 border-sky-500/20", cardColor: "border-t-sky-500/60", icon: ThumbsUp },
  won: { label: "Won", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", cardColor: "border-t-emerald-500/60", icon: CheckCircle },
  lost: { label: "Lost", color: "bg-red-500/10 text-red-400 border-red-500/20", cardColor: "border-t-red-500/60", icon: XCircle },
  rejected: { label: "Rejected", color: "bg-rose-900/20 text-rose-400 border-rose-500/20", cardColor: "border-t-rose-500/60", icon: ThumbsDown },
};

const STATUSES = ["new", "contacted", "interested", "approved", "won", "lost", "rejected"] as const;

const COLUMNS = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "approved", label: "Approved" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "rejected", label: "Rejected" },
];

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
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
        <StatusBadge status={current} />
        <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded shadow-lg py-1 min-w-[140px]">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { onUpdate(leadId, s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-2 ${s === current ? "text-primary" : "text-foreground"}`}>
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Kanban card (draggable) ──────────────────────────────────
function KanbanCard({ lead, onUpdate, isDraggingOverlay = false }: {
  lead: Lead;
  onUpdate: (id: number, status: string) => void;
  isDraggingOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(lead.id),
    data: { lead },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-card border border-border border-t-2 ${STATUS_META[lead.status]?.cardColor ?? ""} rounded p-3 space-y-2 cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isDragging && !isDraggingOverlay ? "opacity-40" : "hover:shadow-md hover:border-border/80"
      } ${isDraggingOverlay ? "rotate-1 shadow-xl" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-tight">{lead.fullName}</p>
        <Milestone className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
      </div>
      {(lead.email || lead.phone) && (
        <div className="space-y-0.5">
          {lead.email && (
            <div className="flex items-center gap-1">
              <Mail className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground truncate">{lead.email}</p>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground">{lead.phone}</p>
            </div>
          )}
        </div>
      )}
      {(lead.product?.name || lead.offerName) && (
        <div className="flex items-center gap-1">
          <Package className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground truncate">{lead.product?.name ?? lead.offerName}</p>
        </div>
      )}
      {lead.affiliate && (
        <p className="text-[10px] font-mono text-muted-foreground">{lead.affiliate.name}</p>
      )}
      {lead.notes && (
        <p className="text-[10px] text-muted-foreground italic line-clamp-2 border-t border-border pt-1.5">{lead.notes}</p>
      )}
      <div className="flex items-center justify-between pt-0.5 border-t border-border">
        <p className="text-[9px] text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</p>
        <div onClick={e => e.stopPropagation()}>
          <StatusDropdown leadId={lead.id} current={lead.status} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
}

// ─── Kanban column (droppable) ────────────────────────────────
function KanbanColumn({ column, leads, onUpdate, isOver }: {
  column: typeof COLUMNS[number];
  leads: Lead[];
  onUpdate: (id: number, status: string) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const meta = STATUS_META[column.id];
  const Icon = meta?.icon ?? AlertCircle;

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t border-t-2 border-x border-border bg-secondary/50 ${meta?.cardColor ?? ""}`}>
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3 h-3 ${meta?.color.split(" ")[1] ?? "text-muted-foreground"}`} />
          <span className="text-xs font-semibold">{column.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded-full tabular-nums">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-32 p-2 space-y-2 border-x border-b border-border rounded-b transition-colors ${
          isOver ? "bg-primary/5 border-primary/30" : "bg-background/50"
        }`}
      >
        {leads.map(lead => (
          <KanbanCard key={lead.id} lead={lead} onUpdate={onUpdate} />
        ))}
        {leads.length === 0 && (
          <div className={`h-16 rounded border-2 border-dashed flex items-center justify-center transition-colors ${
            isOver ? "border-primary/40 bg-primary/5" : "border-border"
          }`}>
            <p className="text-[10px] text-muted-foreground">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban board ─────────────────────────────────────────────
function KanbanBoard({ leads, onUpdate }: { leads: Lead[]; onUpdate: (id: number, status: string) => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeLead = activeId ? leads.find(l => String(l.id) === activeId) ?? null : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over) return;
    const newStatus = String(over.id);
    if (!STATUSES.includes(newStatus as typeof STATUSES[number])) return;
    const leadId = Number(active.id);
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    onUpdate(leadId, newStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={e => setActiveId(String(e.active.id))}
      onDragOver={e => setOverId(e.over ? String(e.over.id) : null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setOverId(null); }}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            leads={leads.filter(l => l.status === col.id)}
            onUpdate={onUpdate}
            isOver={overId === col.id}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeLead && (
          <KanbanCard lead={activeLead} onUpdate={() => {}} isDraggingOverlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function Leads() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterAffiliate, setFilterAffiliate] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = new URLSearchParams();
  if (filterStatus) params.set("status", filterStatus);
  if (filterAffiliate) params.set("affiliateId", filterAffiliate);
  if (filterProduct) params.set("productSlug", filterProduct);
  const qs = params.toString();

  const { data: allLeads, isLoading } = useQuery<Lead[]>({
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

  const leads = allLeads
    ? (search
        ? allLeads.filter(l => {
            const s = search.toLowerCase();
            return (
              l.fullName.toLowerCase().includes(s) ||
              l.email?.toLowerCase().includes(s) ||
              l.phone?.includes(s) ||
              l.notes?.toLowerCase().includes(s)
            );
          })
        : allLeads)
    : [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleUpdate = (id: number, status: string) => updateStatus.mutate({ id, status });

  const totalLeads = leads.length;
  const approvedLeads = leads.filter(l => l.status === "approved" || l.status === "won").length;
  const wonLeads = leads.filter(l => l.status === "won").length;
  const newLeads = leads.filter(l => l.status === "new").length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">CRM pipeline for offline and API-submitted leads</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary border border-border rounded p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded transition-colors ${view === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded transition-colors ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: totalLeads, icon: Users, color: "text-foreground" },
          { label: "New", value: newLeads, icon: AlertCircle, color: "text-blue-400" },
          { label: "Approved", value: approvedLeads, icon: ThumbsUp, color: "text-sky-400" },
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
          <option value="">All Offers</option>
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

      {isLoading ? (
        <div className="grid grid-cols-4 gap-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 bg-card border border-border rounded animate-pulse" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-24 bg-card border border-border rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : !leads.length ? (
        <div className="py-20 text-center">
          <UserCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">No leads found</p>
          <p className="text-xs text-muted-foreground mt-1">Affiliates submit leads from their portal, or use the public API</p>
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard leads={leads} onUpdate={handleUpdate} />
      ) : (
        <div className="bg-card border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2.5">Lead</th>
                <th className="text-left px-4 py-2.5">Contact</th>
                <th className="text-left px-4 py-2.5">Offer</th>
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
                    ) : lead.offerName ? (
                      <p className="text-xs">{lead.offerName}</p>
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
                    <StatusDropdown leadId={lead.id} current={lead.status} onUpdate={handleUpdate} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[10px] text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
