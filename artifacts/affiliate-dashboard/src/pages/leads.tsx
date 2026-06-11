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
  ThumbsUp, ThumbsDown, Milestone, Eye, X, Edit2, DollarSign,
  History, Activity, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"];

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
  expectedValue: string | null;
  closedDealValue: string | null;
  actualRevenue: string | null;
  payoutAmount: string | null;
  currency: string;
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

type EnrichedLead = Lead & {
  affiliate: { id: number; name: string; email: string; refCode: string } | null;
  history: Array<{
    id: number;
    previousStatus: string | null;
    newStatus: string;
    changedBy: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  commissions: Array<{
    id: number;
    paymentId: string;
    conversionType: string | null;
    commission: number;
    amount: number;
    status: string;
    conversionDate: string;
  }>;
};

type Product = { id: number; name: string; slug: string; active: boolean };
type Affiliate = { id: number; name: string; email: string; refCode: string };

function fmtDealValue(value: string | null | undefined, currency = "NGN"): string | null {
  if (!value) return null;
  const n = Number(value);
  if (isNaN(n) || n === 0) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency,
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

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

const COMMISSION_STATUS_COLORS: Record<string, string> = {
  HOLD: "text-amber-400",
  PAYABLE: "text-blue-400",
  PAID: "text-emerald-400",
};

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

// ─── Lead Detail Drawer ────────────────────────────────────────────────────
function LeadDetailDrawer({ leadId, onClose, onSaved }: {
  leadId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingValues, setEditingValues] = useState(false);
  const [editForm, setEditForm] = useState({
    expectedValue: "", closedDealValue: "", actualRevenue: "", payoutAmount: "",
    currency: "NGN", notes: "",
  });

  const { data: lead, isLoading } = useQuery<EnrichedLead>({
    queryKey: ["lead-detail", leadId],
    queryFn: () => apiFetch(`/leads/${leadId}`),
    onSuccess: (data: EnrichedLead) => {
      setEditForm({
        expectedValue: data.expectedValue ?? "",
        closedDealValue: data.closedDealValue ?? "",
        actualRevenue: data.actualRevenue ?? "",
        payoutAmount: data.payoutAmount ?? "",
        currency: data.currency ?? "NGN",
        notes: data.notes ?? "",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof editForm) =>
      apiFetch(`/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedValue: values.expectedValue || null,
          closedDealValue: values.closedDealValue || null,
          actualRevenue: values.actualRevenue || null,
          payoutAmount: values.payoutAmount || null,
          currency: values.currency,
          notes: values.notes || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      setEditingValues(false);
      toast({ title: "Lead updated" });
      onSaved();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      toast({ title: "Status updated" });
      onSaved();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalCommission = (lead?.commissions ?? []).reduce((s, c) => s + c.commission, 0);
  const hasValues = lead && (lead.expectedValue || lead.closedDealValue || lead.actualRevenue || lead.payoutAmount);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-background border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{lead?.fullName ?? "Loading…"}</p>
              {lead && (
                <p className="text-[10px] text-muted-foreground">
                  Lead #{lead.id} · {new Date(lead.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-card border border-border rounded animate-pulse" />
            ))}
          </div>
        ) : !lead ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Lead not found</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Status controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_META[lead.status] && (() => {
                const meta = STATUS_META[lead.status];
                const Icon = meta.icon;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border ${meta.color}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                );
              })()}
              <p className="text-[10px] text-muted-foreground">Move to:</p>
              {STATUSES.filter(s => s !== lead.status).map(s => (
                <button
                  key={s}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent text-muted-foreground transition-colors disabled:opacity-40"
                >
                  {STATUS_META[s]?.label ?? s}
                </button>
              ))}
            </div>

            {/* Lead Info */}
            <section className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lead Information</p>
              <div className="bg-card border border-border rounded p-3 space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs">{lead.email}</p>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs">{lead.phone}</p>
                  </div>
                )}
                {(lead.product?.name || lead.offerName) && (
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs">{lead.product?.name ?? lead.offerName}</p>
                  </div>
                )}
                {lead.affiliate && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs">
                      {lead.affiliate.name}
                      {(lead.affiliate as { refCode?: string }).refCode && (
                        <span className="font-mono text-muted-foreground ml-1">
                          ({(lead.affiliate as { refCode: string }).refCode})
                        </span>
                      )}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground capitalize">{lead.source.replace(/_/g, " ")}</p>
                </div>
                {lead.approvedAt && (
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-3 h-3 text-sky-400 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">Approved {new Date(lead.approvedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {lead.wonAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">Won {new Date(lead.wonAt).toLocaleDateString()}</p>
                  </div>
                )}
                {lead.rejectedAt && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Rejected {new Date(lead.rejectedAt).toLocaleDateString()}
                      {lead.rejectedReason && ` — ${lead.rejectedReason}`}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Deal Values */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Deal Values
                </p>
                <button
                  onClick={() => {
                    if (editingValues) {
                      setEditForm({
                        expectedValue: lead.expectedValue ?? "",
                        closedDealValue: lead.closedDealValue ?? "",
                        actualRevenue: lead.actualRevenue ?? "",
                        payoutAmount: lead.payoutAmount ?? "",
                        currency: lead.currency ?? "NGN",
                        notes: lead.notes ?? "",
                      });
                    }
                    setEditingValues(v => !v);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  {editingValues ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingValues ? (
                <div className="bg-card border border-border rounded p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {(["expectedValue", "closedDealValue", "actualRevenue", "payoutAmount"] as const).map(key => {
                      const labels: Record<string, string> = {
                        expectedValue: "Expected Value",
                        closedDealValue: "Closed Deal Value",
                        actualRevenue: "Revenue",
                        payoutAmount: "Payout Amount",
                      };
                      return (
                        <div key={key}>
                          <label className="text-[10px] text-muted-foreground block mb-1">{labels[key]}</label>
                          <input
                            type="number"
                            value={editForm[key]}
                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder="0"
                            min="0"
                            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Currency</label>
                      <select
                        value={editForm.currency}
                        onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Internal notes about this deal…"
                      className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                  <button
                    onClick={() => saveMutation.mutate(editForm)}
                    disabled={saveMutation.isPending}
                    className="text-xs bg-primary text-primary-foreground font-semibold px-3 py-1.5 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saveMutation.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              ) : (
                <div className="bg-card border border-border rounded p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Expected Value", value: fmtDealValue(lead.expectedValue, lead.currency), color: "text-violet-400" },
                      { label: "Closed Deal Value", value: fmtDealValue(lead.closedDealValue, lead.currency), color: "text-emerald-400" },
                      { label: "Revenue", value: fmtDealValue(lead.actualRevenue, lead.currency), color: "text-primary" },
                      { label: "Payout Amount", value: fmtDealValue(lead.payoutAmount, lead.currency), color: "text-amber-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className={`text-sm font-bold tabular-nums ${value ? color : "text-muted-foreground/50"}`}>
                          {value ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <p className="text-[10px] text-muted-foreground">Currency: <span className="font-mono font-semibold text-foreground">{lead.currency}</span></p>
                    {!hasValues && <p className="text-[10px] text-muted-foreground italic">No deal values set — click Edit to add</p>}
                  </div>
                  {lead.notes && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Notes</p>
                      <p className="text-xs text-muted-foreground italic">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Commissions */}
            {lead.commissions.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Commissions Triggered</p>
                  <span className="text-[10px] font-bold text-primary tabular-nums">
                    {fmtDealValue(String(totalCommission), lead.currency) ?? `${lead.currency} ${totalCommission.toLocaleString()}`} total
                  </span>
                </div>
                <div className="bg-card border border-border rounded divide-y divide-border overflow-hidden">
                  {lead.commissions.map(c => (
                    <div key={c.id} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium capitalize">{(c.conversionType ?? "commission").replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(c.conversionDate).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold tabular-nums text-primary">
                          +{fmtDealValue(String(c.commission), lead.currency) ?? c.commission.toLocaleString()}
                        </p>
                        <span className={`text-[10px] font-semibold ${COMMISSION_STATUS_COLORS[c.status] ?? "text-muted-foreground"}`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Status Timeline */}
            {lead.history.length > 0 && (
              <section className="space-y-2 pb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <History className="w-3 h-3" /> Status Timeline
                </p>
                <div className="space-y-0">
                  {[...lead.history].reverse().map((h, i, arr) => (
                    <div key={h.id} className="flex items-start gap-2">
                      <div className="flex flex-col items-center pt-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i === arr.length - 1 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        {i < arr.length - 1 && <div className="w-px flex-1 bg-border min-h-4 mt-0.5" />}
                      </div>
                      <div className="pb-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {h.previousStatus && (
                            <>
                              <span className="text-[10px] text-muted-foreground capitalize">{h.previousStatus}</span>
                              <span className="text-[10px] text-muted-foreground">→</span>
                            </>
                          )}
                          <span className="text-[10px] font-semibold capitalize">{h.newStatus}</span>
                          {h.changedBy && <span className="text-[10px] text-muted-foreground">by {h.changedBy}</span>}
                        </div>
                        {h.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">{h.notes}</p>}
                        <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(h.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban card ──────────────────────────────────────────────────────────
function KanbanCard({ lead, onUpdate, onOpen, isDraggingOverlay = false }: {
  lead: Lead;
  onUpdate: (id: number, status: string) => void;
  onOpen: (id: number) => void;
  isDraggingOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(lead.id),
    data: { lead },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const dealLabel = fmtDealValue(lead.closedDealValue ?? lead.expectedValue, lead.currency);

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
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onOpen(lead.id); }}
          className="p-0.5 rounded hover:bg-accent transition-colors flex-shrink-0"
          title="View details"
        >
          <Eye className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </button>
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
      {dealLabel && (
        <div className="flex items-center gap-1">
          <DollarSign className="w-2.5 h-2.5 text-primary flex-shrink-0" />
          <p className="text-[10px] font-semibold text-primary">{dealLabel}</p>
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

// ─── Kanban column ────────────────────────────────────────────────────────
function KanbanColumn({ column, leads, onUpdate, onOpen, isOver }: {
  column: typeof COLUMNS[number];
  leads: Lead[];
  onUpdate: (id: number, status: string) => void;
  onOpen: (id: number) => void;
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
          <KanbanCard key={lead.id} lead={lead} onUpdate={onUpdate} onOpen={onOpen} />
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

// ─── Kanban board ─────────────────────────────────────────────────────────
function KanbanBoard({ leads, onUpdate, onOpen }: {
  leads: Lead[];
  onUpdate: (id: number, status: string) => void;
  onOpen: (id: number) => void;
}) {
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
            onOpen={onOpen}
            isOver={overId === col.id}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeLead && (
          <KanbanCard lead={activeLead} onUpdate={() => {}} onOpen={() => {}} isDraggingOverlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function Leads() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterAffiliate, setFilterAffiliate] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);
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
  const totalPipeline = leads.reduce((s, l) => s + (l.expectedValue ? Number(l.expectedValue) : 0), 0);
  const closedValue = leads.filter(l => l.status === "won").reduce((s, l) => s + (l.closedDealValue ? Number(l.closedDealValue) : 0), 0);

  const handleCsvExport = () => {
    window.open("/api/leads/export", "_blank");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">CRM pipeline for offline and API-submitted leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCsvExport}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-secondary border border-border rounded hover:bg-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
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
      </div>

      {/* Stats — row 1: counts */}
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

      {/* Stats — row 2: deal values */}
      {(totalPipeline > 0 || closedValue > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pipeline</p>
                <p className="text-xl font-bold mt-1 tabular-nums text-violet-400">
                  {fmtDealValue(String(totalPipeline), leads[0]?.currency ?? "NGN") ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">expected value</p>
              </div>
              <div className="p-2 rounded bg-background text-violet-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Closed Revenue</p>
                <p className="text-xl font-bold mt-1 tabular-nums text-emerald-400">
                  {fmtDealValue(String(closedValue), leads[0]?.currency ?? "NGN") ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">from won leads</p>
              </div>
              <div className="p-2 rounded bg-background text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
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
        <KanbanBoard leads={leads} onUpdate={handleUpdate} onOpen={setOpenLeadId} />
      ) : (
        <div className="bg-card border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2.5">Lead</th>
                <th className="text-left px-4 py-2.5">Contact</th>
                <th className="text-left px-4 py-2.5">Offer</th>
                <th className="text-left px-4 py-2.5">Affiliate</th>
                <th className="text-right px-4 py-2.5">Deal Value</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr
                  key={lead.id}
                  className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
                  onClick={() => setOpenLeadId(lead.id)}
                >
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
                  <td className="px-4 py-3 text-right">
                    {fmtDealValue(lead.closedDealValue ?? lead.expectedValue, lead.currency) ? (
                      <div>
                        <p className="text-xs font-semibold text-primary tabular-nums">
                          {fmtDealValue(lead.closedDealValue ?? lead.expectedValue, lead.currency)}
                        </p>
                        {lead.closedDealValue ? (
                          <p className="text-[9px] text-emerald-400">closed</p>
                        ) : (
                          <p className="text-[9px] text-muted-foreground">expected</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
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

      {openLeadId && (
        <LeadDetailDrawer
          leadId={openLeadId}
          onClose={() => setOpenLeadId(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        />
      )}
    </div>
  );
}
