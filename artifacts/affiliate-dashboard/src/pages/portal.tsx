import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  TrendingUp, Copy, CheckCircle, Clock, ExternalLink, LogOut,
  ArrowRightLeft, Wallet, Eye, EyeOff, AppWindow, Share2,
  MessageCircle, Facebook, Mail, ChevronDown, ChevronUp, Video,
  Sparkles, DollarSign, Users, Zap, Star, X, Send, XCircle,
  QrCode, MousePointerClick, ShoppingCart, BarChart2, Trophy, Search
} from "lucide-react";
import QRCode from "qrcode";

async function apiPost(path: string, body: object) {
  const res = await fetch(`/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Request failed"), { code: data.code, email: data.email });
  return data;
}
async function apiGet(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Request failed"); }
  return res.json();
}

function fmtCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    PAYABLE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PAID: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${colors[status] ?? "bg-secondary text-muted-foreground border-border"}`}>{status}</span>;
}

type Affiliate = { id: number; name: string; email: string; refCode: string; status: string; signupStatus: string | null; isSelfSignup: boolean; welcomedAt: string | null; createdAt: string; onboardingSubmitted?: boolean; };
type ProgramInfo = { programName: string; programTagline: string; commissionHighlight: string; programDetails: string; approvalMode: string; emailProvider?: string };
type Stats = { clicks: number; signups: number; conversions: number; holdAmount: number; payableAmount: number; paidAmount: number; totalEarnings: number };
type Conversion = { id: number; appName: string; amount: number; commission: number; status: string; conversionDate: string; holdEndDate: string | null };
type Payout = { id: number; amount: number; status: string; createdAt: string; paidAt: string | null };
type Config = { currency: string; leaderboardEnabled?: boolean };
type App = { id: number; name: string; slug: string; description: string | null; websiteUrl: string; promoText: string | null; imageUrls: string[]; videoUrl: string | null; active: boolean; category: string | null; };
type ProductStat = {
  productId: number;
  productSlug: string;
  productName: string;
  productDescription: string | null;
  productCategory: string | null;
  refLink: string;
  clicks: number;
  signups: number;
  conversions: number;
  revenue: number;
  commission: number;
};

type PortalLead = {
  id: number;
  productId: number | null;
  productSlug: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: "new" | "contacted" | "interested" | "won" | "lost";
  source: string;
  createdAt: string;
  product: { id: number; name: string; slug: string } | null;
};

type LeaderboardEntry = {
  rank: number;
  label: string;
  isYou: boolean;
  clicks: number;
  conversions: number;
  commission: number;
};

type LeaderboardData = {
  enabled: boolean;
  totalParticipants: number;
  excludedProducts: string[];
  entries: LeaderboardEntry[];
};

// ─────────────────────────────────────────────────────────────
// QR CODE MODAL
// ─────────────────────────────────────────────────────────────
function QrModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: "#ffffff", light: "#0a0a0a" },
      }).catch(() => {});
    }
  }, [url]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-${title.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="text-[10px] text-muted-foreground">Scan to visit referral link</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex justify-center mb-4">
          <canvas ref={canvasRef} className="rounded-lg border border-border" />
        </div>
        <p className="text-[10px] font-mono text-muted-foreground text-center mb-4 break-all">{url}</p>
        <div className="flex gap-2">
          <button onClick={handleDownload}
            className="flex-1 text-xs bg-primary text-primary-foreground font-semibold py-2 rounded hover:bg-primary/90 transition-colors">
            Download PNG
          </button>
          <button onClick={onClose}
            className="flex-1 text-xs bg-secondary text-foreground font-medium py-2 rounded hover:bg-accent transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING MODAL
// ─────────────────────────────────────────────────────────────
function OnboardingModal({ affiliate, programInfo, onClose }: { affiliate: Affiliate; programInfo: ProgramInfo | undefined; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const qc = useQueryClient();

  const handleDone = async () => {
    await apiPost("/portal/mark-welcomed", {});
    qc.invalidateQueries({ queryKey: ["portal-me"] });
    onClose();
  };

  const steps = [
    {
      icon: <Sparkles className="w-10 h-10 text-primary" />,
      title: `Welcome, ${affiliate.name.split(" ")[0]}! 🎉`,
      body: programInfo?.programDetails ?? "You're now part of an exclusive affiliate program. Share your unique link, and earn real commissions every time someone signs up.",
      cta: "Tell me more →",
    },
    {
      icon: <DollarSign className="w-10 h-10 text-amber-400" />,
      title: programInfo?.commissionHighlight ?? "Earn up to $500 per referral",
      body: "Every successful conversion earns you a commission — automatically tracked, no manual work needed. The more you share, the more you earn. It really is that simple.",
      cta: "How do I share? →",
    },
    {
      icon: <Zap className="w-10 h-10 text-blue-400" />,
      title: "Your link works everywhere",
      body: "Use your referral link on WhatsApp, Facebook, email, your blog — anywhere. We'll give you ready-made messages and promo images so you never start from a blank page.",
      cta: "When do I get paid? →",
    },
    {
      icon: <Wallet className="w-10 h-10 text-primary" />,
      title: "Earnings, on schedule",
      body: "Commissions go through a short review period, then become payable. Your admin handles the payout — you track every dollar right here in your dashboard.",
      cta: "Let's start earning →",
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex gap-1.5 justify-center pt-5 pb-0">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-border"}`} />
          ))}
        </div>
        <div className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg">
              {current.icon}
            </div>
          </div>
          <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
        </div>
        <div className="px-8 pb-8 space-y-2">
          <button
            onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : handleDone()}
            className="w-full bg-primary text-primary-foreground text-sm font-bold py-3 rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            {current.cta}
          </button>
          {step === steps.length - 1 && (
            <button onClick={handleDone} className="w-full text-xs text-muted-foreground py-1.5 hover:text-foreground transition-colors">
              Skip to dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP CARD
// ─────────────────────────────────────────────────────────────
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium">
      {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? "Copied!" : "Copy")}
    </button>
  );
}

function AppCard({ app, refCode, stat, currency }: { app: App; refCode: string; stat?: ProductStat; currency: string }) {
  const [expanded, setExpanded] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // New canonical referral link: /product/{slug}?ref={code}
  const origin = window.location.origin;
  const refLink = stat?.refLink ?? `${origin}/product/${app.slug}?ref=${refCode}`;
  const promoMessage = app.promoText ? `${app.promoText}\n\n${refLink}` : `Check out ${app.name}! ${refLink}`;

  const hasStats = stat && (stat.clicks > 0 || stat.conversions > 0 || stat.commission > 0);

  return (
    <>
      {showQr && <QrModal url={refLink} title={app.name} onClose={() => setShowQr(false)} />}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AppWindow className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{app.name}</p>
              {app.category && <span className="text-[10px] text-muted-foreground capitalize bg-secondary px-1.5 py-0.5 rounded">{app.category.replace(/_/g, " ")}</span>}
              {hasStats && (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                  {stat.clicks} clicks
                </span>
              )}
            </div>
            {app.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{app.description}</p>}

            {/* Referral link display */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1 min-w-0">
                <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">{refLink}</span>
              </div>
              <CopyButton text={refLink} label="Copy link" />
              <button
                onClick={() => setShowQr(true)}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors font-medium"
              >
                <QrCode className="w-3 h-3" /> QR
              </button>
            </div>

            {/* Share + action buttons */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(promoMessage)}`, "_blank")}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors font-medium">
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </button>
              <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`, "_blank")}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 hover:bg-[#1877F2]/20 transition-colors font-medium">
                <Facebook className="w-3 h-3" /> Facebook
              </button>
              <button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Check out ${app.name}`)}&body=${encodeURIComponent(promoMessage)}`, "_blank")}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors font-medium">
                <Mail className="w-3 h-3" /> Email
              </button>
              {stat && (
                <button onClick={() => setShowStats(s => !s)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                  <BarChart2 className="w-3 h-3" /> Stats {showStats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {(app.promoText || app.imageUrls.length > 0 || app.videoUrl) && (
                <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                  <Share2 className="w-3 h-3" /> Promo kit {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Per-product stats panel */}
        {showStats && stat && (
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Your performance for this product</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Clicks", value: stat.clicks, icon: <MousePointerClick className="w-3 h-3 text-blue-400" />, color: "text-blue-400" },
                { label: "Signups", value: stat.signups, icon: <Users className="w-3 h-3 text-violet-400" />, color: "text-violet-400" },
                { label: "Conversions", value: stat.conversions, icon: <ShoppingCart className="w-3 h-3 text-primary" />, color: "text-primary" },
                { label: "Commission", value: fmtCurrency(stat.commission, currency), icon: <DollarSign className="w-3 h-3 text-amber-400" />, color: "text-amber-400" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-background border border-border rounded p-2 text-center">
                  <div className="flex justify-center mb-1">{icon}</div>
                  <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Promo kit */}
        {expanded && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
            {app.promoText && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ready-to-share message</p>
                  <CopyButton text={promoMessage} />
                </div>
                <p className="text-xs bg-secondary/50 rounded p-2 whitespace-pre-wrap leading-relaxed">{app.promoText}</p>
              </div>
            )}
            {app.imageUrls.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Promo images</p>
                  <button onClick={() => setImgExpanded(e => !e)} className="text-[10px] text-primary">{imgExpanded ? "Hide" : `Show ${app.imageUrls.length}`}</button>
                </div>
                {imgExpanded && (
                  <div className="flex gap-2 flex-wrap">
                    {app.imageUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="h-20 w-28 object-cover rounded border border-border hover:opacity-80 transition-opacity" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            {app.videoUrl && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Promo video</p>
                {app.videoUrl.includes("embed") || app.videoUrl.includes("youtube") || app.videoUrl.includes("vimeo") ? (
                  <iframe src={app.videoUrl.includes("watch?v=") ? app.videoUrl.replace("watch?v=", "embed/") : app.videoUrl}
                    className="w-full aspect-video rounded border border-border" allowFullScreen />
                ) : (
                  <a href={app.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Video className="w-3.5 h-3.5" /> Watch video
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PORTAL LEADS TAB
// ─────────────────────────────────────────────────────────────
const LEAD_STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  contacted: { label: "Contacted", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  interested: { label: "Interested", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  won: { label: "Won", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  lost: { label: "Lost", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

function LeadStatusBadge({ status }: { status: string }) {
  const meta = LEAD_STATUS_META[status] ?? { label: status, color: "bg-secondary text-muted-foreground border-border" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
  );
}

function PortalLeadsTab({ affiliate, apps, myLeads, refetchLeads }: {
  affiliate: Affiliate;
  apps: App[];
  myLeads: PortalLead[];
  refetchLeads: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({ fullName: "", phone: "", email: "", productId: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setSubmitError("Name is required"); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await apiPost("/leads", {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        productId: form.productId ? Number(form.productId) : undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({ fullName: "", phone: "", email: "", productId: "", notes: "" });
      setShowForm(false);
      refetchLeads();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit lead");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = myLeads.filter(l => {
    if (filterStatus && l.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return l.fullName.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s) || l.phone?.includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">My Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Submit prospects who expressed interest offline — solar, consulting, real estate, and more.</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground font-semibold px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
        >
          {showForm ? <X className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          {showForm ? "Cancel" : "Submit Lead"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Lead</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Full Name *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full text-xs bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
                className="w-full text-xs bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@email.com"
                className="w-full text-xs bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Product</label>
              <select
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="w-full text-xs bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a product…</option>
                {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="How did you meet? What are they interested in?"
              rows={2}
              className="w-full text-xs bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="text-xs bg-primary text-primary-foreground font-semibold px-4 py-2 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Lead"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-card border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {Object.entries(LEAD_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        {!filtered.length ? (
          <div className="py-12 text-center">
            <Users className="w-7 h-7 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{myLeads.length === 0 ? "No leads yet — submit your first one above!" : "No leads match your filter"}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(lead => (
              <div key={lead.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold">{lead.fullName}</p>
                    <LeadStatusBadge status={lead.status} />
                  </div>
                  {lead.product && (
                    <p className="text-[10px] text-muted-foreground">{lead.product.name}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {lead.email && <p className="text-[10px] text-muted-foreground">{lead.email}</p>}
                    {lead.phone && <p className="text-[10px] text-muted-foreground">{lead.phone}</p>}
                  </div>
                  {lead.notes && <p className="text-[10px] text-muted-foreground italic truncate max-w-xs">{lead.notes}</p>}
                </div>
                <p className="text-[10px] text-muted-foreground flex-shrink-0 text-right">{new Date(lead.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
function PortalDashboard({ affiliate, onLogout }: { affiliate: Affiliate; onLogout: () => void }) {
  const [tab, setTab] = useState<"overview" | "apps" | "leads" | "leaderboard">("overview");
  const [copied, setCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!affiliate.welcomedAt);
  const qc = useQueryClient();

  const { data: stats } = useQuery<Stats>({ queryKey: ["portal-stats", affiliate.id], queryFn: () => apiGet(`/affiliates/${affiliate.id}/stats`) });
  const { data: conversions } = useQuery<Conversion[]>({ queryKey: ["portal-conversions", affiliate.id], queryFn: () => apiGet(`/conversions?affiliateId=${affiliate.id}`) });
  const { data: payouts } = useQuery<Payout[]>({ queryKey: ["portal-payouts", affiliate.id], queryFn: () => apiGet(`/payouts?affiliateId=${affiliate.id}`) });
  const { data: config } = useQuery<Config>({ queryKey: ["portal-config"], queryFn: () => apiGet("/config") });
  const { data: apps } = useQuery<App[]>({ queryKey: ["portal-products"], queryFn: () => apiGet("/products"), select: a => a.filter((x: App) => x.active) });
  const { data: programInfo } = useQuery<ProgramInfo>({ queryKey: ["portal-program-info"], queryFn: () => apiGet("/portal/program-info") });
  const { data: productStats } = useQuery<ProductStat[]>({
    queryKey: ["portal-product-stats", affiliate.id],
    queryFn: () => apiGet(`/affiliates/${affiliate.id}/product-stats`),
    enabled: tab === "apps",
  });
  const { data: leaderboard } = useQuery<LeaderboardData>({
    queryKey: ["portal-leaderboard", affiliate.refCode],
    queryFn: () => apiGet(`/stats/leaderboard?ref=${affiliate.refCode}`),
    enabled: config?.leaderboardEnabled === true && tab === "leaderboard",
  });
  const { data: myLeads, refetch: refetchLeads } = useQuery<PortalLead[]>({
    queryKey: ["portal-leads", affiliate.id],
    queryFn: () => apiGet(`/affiliates/${affiliate.id}/leads`),
    enabled: tab === "leads",
  });

  const currency = config?.currency ?? "USD";
  const logoutMutation = useMutation({ mutationFn: () => apiPost("/portal/logout", {}), onSuccess: () => { qc.clear(); onLogout(); } });

  const productStatMap = new Map<string, ProductStat>(
    (productStats ?? []).map(s => [s.productSlug, s])
  );

  return (
    <>
      {showOnboarding && (
        <OnboardingModal affiliate={affiliate} programInfo={programInfo} onClose={() => setShowOnboarding(false)} />
      )}

      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs font-bold tracking-wider text-foreground uppercase">{programInfo?.programName ?? "OneStore"}</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Affiliate Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-secondary border border-border px-3 py-1.5 rounded">
              <span className="text-xs font-mono font-bold">{affiliate.refCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(affiliate.refCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-muted-foreground hover:text-foreground">
                {copied ? <CheckCircle className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{affiliate.name}</p>
              <p className="text-[10px] text-muted-foreground">{affiliate.email}</p>
            </div>
            <button onClick={() => logoutMutation.mutate()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-accent">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </header>

        <div className="border-b border-border px-6">
          <div className="flex gap-0">
            {[
              { key: "overview", label: "Overview" },
              { key: "apps", label: `Products${apps?.length ? ` (${apps.length})` : ""}` },
              { key: "leads", label: `Leads${myLeads?.length ? ` (${myLeads.length})` : ""}` },
              ...(config?.leaderboardEnabled ? [{ key: "leaderboard", label: "Leaderboard" }] : []),
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className={`text-xs px-4 py-3 border-b-2 transition-colors font-medium ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6">
          {tab === "overview" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Clicks", value: stats?.clicks ?? 0, color: "text-blue-400" },
                  { label: "Signups", value: stats?.signups ?? 0, color: "text-violet-400" },
                  { label: "Conversions", value: stats?.conversions ?? 0, color: "text-primary" },
                  { label: "Total Earnings", value: fmtCurrency(stats?.totalEarnings ?? 0, currency), color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-card border border-border rounded p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded p-4">
                  <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3 h-3 text-amber-400" /><p className="text-[10px] uppercase tracking-wider text-amber-400">On Hold</p></div>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrency(stats?.holdAmount ?? 0, currency)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Review period</p>
                </div>
                <div className="bg-card border border-border rounded p-4">
                  <div className="flex items-center gap-1.5 mb-1"><ArrowRightLeft className="w-3 h-3 text-blue-400" /><p className="text-[10px] uppercase tracking-wider text-blue-400">Payable</p></div>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrency(stats?.payableAmount ?? 0, currency)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Ready to disburse</p>
                </div>
                <div className="bg-card border border-border rounded p-4">
                  <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3 h-3 text-primary" /><p className="text-[10px] uppercase tracking-wider text-primary">Paid Out</p></div>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrency(stats?.paidAmount ?? 0, currency)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Total received</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversions</p>
                    <span className="text-[10px] text-muted-foreground">{conversions?.length ?? 0} total</span>
                  </div>
                  <div className="divide-y divide-border max-h-64 overflow-y-auto">
                    {conversions?.map(c => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <StatusBadge status={c.status} />
                          <p className="text-xs text-muted-foreground mt-1">{c.appName}</p>
                          {c.status === "HOLD" && c.holdEndDate && (
                            <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-amber-400" /><p className="text-[10px] text-amber-400">releases {new Date(c.holdEndDate).toLocaleDateString()}</p></div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums text-primary">{fmtCurrency(c.commission, currency)}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(c.conversionDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    {!conversions?.length && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No conversions yet</p>}
                  </div>
                </div>

                <div className="bg-card border border-border rounded">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payouts</p>
                    <span className="text-[10px] text-muted-foreground">{payouts?.length ?? 0} total</span>
                  </div>
                  <div className="divide-y divide-border max-h-64 overflow-y-auto">
                    {payouts?.map(p => (
                      <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <StatusBadge status={p.status} />
                          <p className="text-[10px] text-muted-foreground mt-1">Requested {new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">{fmtCurrency(p.amount, currency)}</p>
                          {p.paidAt && <p className="text-[10px] text-primary">paid {new Date(p.paidAt).toLocaleDateString()}</p>}
                        </div>
                      </div>
                    ))}
                    {!payouts?.length && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No payouts yet</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : tab === "apps" ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Each product has its own unique referral link. Share it to earn commissions when people sign up or buy.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Your code: <span className="font-mono font-bold text-foreground">{affiliate.refCode}</span> · Links format: <span className="font-mono text-foreground">/product/&#123;slug&#125;?ref={affiliate.refCode}</span></p>
                </div>
              </div>
              {!apps?.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <AppWindow className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No products available yet. Check back soon!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apps.map(app => (
                    <AppCard
                      key={app.id}
                      app={app}
                      refCode={affiliate.refCode}
                      stat={productStatMap.get(app.slug)}
                      currency={currency}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : tab === "leads" ? (
            <PortalLeadsTab affiliate={affiliate} apps={apps ?? []} myLeads={myLeads ?? []} refetchLeads={refetchLeads} />
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold">Affiliate Rankings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See how you rank against all active affiliates. All others are shown anonymously.
                </p>
              </div>

              {!leaderboard ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Loading rankings...</p>
              ) : !leaderboard.enabled ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Leaderboard is not available.</p>
              ) : leaderboard.entries.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No rankings yet. Start earning commissions to appear here!</p>
                </div>
              ) : (
                <>
                  <div className="bg-card border border-border rounded overflow-hidden">
                    <div className="grid grid-cols-[40px_1fr_80px_80px_100px] gap-0 px-4 py-2 border-b border-border bg-secondary/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Affiliate</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Clicks</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Converts</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Earned</span>
                    </div>
                    <div className="divide-y divide-border">
                      {leaderboard.entries.map(entry => (
                        <div
                          key={entry.rank}
                          className={`grid grid-cols-[40px_1fr_80px_80px_100px] gap-0 px-4 py-3 items-center transition-colors ${
                            entry.isYou
                              ? "bg-primary/5 border-l-2 border-l-primary"
                              : "hover:bg-secondary/30"
                          }`}
                        >
                          <span className={`text-sm font-bold tabular-nums ${
                            entry.rank === 1 ? "text-amber-400" :
                            entry.rank === 2 ? "text-slate-300" :
                            entry.rank === 3 ? "text-orange-400" :
                            "text-muted-foreground"
                          }`}>
                            {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-semibold truncate ${entry.isYou ? "text-primary" : "text-muted-foreground"}`}>
                              {entry.label}
                            </span>
                            {entry.isYou && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded flex-shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-xs tabular-nums text-right text-muted-foreground">{entry.clicks.toLocaleString()}</span>
                          <span className="text-xs tabular-nums text-right text-muted-foreground">{entry.conversions.toLocaleString()}</span>
                          <span className={`text-xs tabular-nums text-right font-semibold ${entry.isYou ? "text-primary" : "text-foreground"}`}>
                            {fmtCurrency(entry.commission, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-[10px] text-muted-foreground">
                    <div className="space-y-1">
                      <p>{leaderboard.totalParticipants} affiliate{leaderboard.totalParticipants !== 1 ? "s" : ""} ranked · sorted by commission earned</p>
                      {leaderboard.excludedProducts.length > 0 && (
                        <p>Note: <span className="text-foreground">{leaderboard.excludedProducts.join(", ")}</span> excluded from rankings</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// WAITING STATES
// ─────────────────────────────────────────────────────────────
function PendingVerificationScreen({ email, onResend }: { email: string; onResend: () => void }) {
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    await apiPost("/portal/resend-verification", { email }).catch(() => {});
    setResent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Send className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Check your email</h2>
          <p className="text-sm text-muted-foreground mt-2">We sent a verification link to <strong className="text-foreground">{email}</strong>. Click it to activate your account.</p>
        </div>
        <div className="bg-card border border-border rounded p-4 text-xs text-muted-foreground text-left space-y-1.5">
          <p>✦ Check your spam / junk folder</p>
          <p>✦ The link expires in 24 hours</p>
          <p>✦ Make sure you signed up with the right email</p>
        </div>
        {resent ? (
          <p className="text-xs text-primary flex items-center gap-1.5 justify-center"><CheckCircle className="w-3.5 h-3.5" /> Verification email resent!</p>
        ) : (
          <button onClick={handleResend} disabled={loading} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            {loading ? "Sending..." : "Didn't receive it? Resend"}
          </button>
        )}
        <button onClick={onResend} className="block w-full text-xs text-muted-foreground hover:text-foreground pt-1">← Back to sign in</button>
      </div>
    </div>
  );
}

function PendingApprovalScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
          <Star className="w-7 h-7 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Application received!</h2>
          <p className="text-sm text-muted-foreground mt-2">Your email is verified. Our team is reviewing your application — you'll get an email the moment you're approved.</p>
        </div>
        <div className="bg-card border border-border rounded p-4 text-xs text-muted-foreground text-left space-y-1.5">
          <p>✦ Review typically takes 1–2 business days</p>
          <p>✦ You'll receive an approval email with next steps</p>
          <p>✦ No action needed from you right now</p>
        </div>
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to sign in</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING QUESTIONS (shown after verification with manual approval)
// ─────────────────────────────────────────────────────────────
const ONBOARDING_QUESTIONS = [
  { key: "inspiration", label: "What inspired you to join our affiliate program?" },
  { key: "about_you", label: "Tell us about yourself — who are you and what do you do?" },
  { key: "promotion", label: "How do you plan to share your referral links? (e.g. WhatsApp, Instagram, YouTube, blog)" },
  { key: "belief", label: "Why do you believe in the products you'll be promoting?" },
  { key: "meaning", label: "What would earning your first commission mean to you?" },
];

function OnboardingQuestionsScreen({ affiliate, onDone, onLogout }: {
  affiliate: Affiliate;
  onDone: () => void;
  onLogout: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost("/portal/onboarding", answers);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const answered = Object.values(answers).filter(v => v.trim()).length;
  const canSubmit = answered >= 3;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Star className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold">You're almost in, {affiliate.name.split(" ")[0]}!</h2>
          <p className="text-sm text-muted-foreground">Help us understand you better. Answer at least 3 of the questions below to complete your application — this takes less than 2 minutes.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {ONBOARDING_QUESTIONS.map((q, i) => (
            <div key={q.key} className="bg-card border border-border rounded p-3 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{i + 1}. {q.label}</label>
              <textarea
                value={answers[q.key] ?? ""}
                onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                rows={2}
                placeholder="Your answer..."
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none"
              />
            </div>
          ))}

          {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground">{answered}/5 answered <span className={answered >= 3 ? "text-primary" : ""}>(3 minimum)</span></span>
            <button type="submit" disabled={!canSubmit || loading}
              className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:bg-primary/90 disabled:opacity-40 transition-colors">
              {loading ? "Submitting..." : "Submit application →"}
            </button>
          </div>
        </form>

        <button onClick={onLogout} className="block w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors">← Sign out</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUTH FORM
// ─────────────────────────────────────────────────────────────
type AuthScreen = "login" | "signup" | "setup" | "forgot" | "forgot-sent" | "reset" | "verify-sent" | "pending-approval" | "verifying" | "onboarding-questions";

function AuthForm({ onSuccess, initialToken, initialVerifyToken }: {
  onSuccess: (a: Affiliate) => void;
  initialToken?: string;
  initialVerifyToken?: string;
}) {
  const [screen, setScreen] = useState<AuthScreen>(
    initialToken ? "reset" : initialVerifyToken ? "verifying" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (initialVerifyToken) {
      setLoading(true);
      apiPost("/portal/verify-email", { token: initialVerifyToken })
        .then(() => {
          setLoading(false);
          setLocation("/portal");
          apiGet("/portal/me").then(a => onSuccess(a as Affiliate)).catch(() => setScreen("login"));
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
          setScreen("login");
        });
    }
  }, [initialVerifyToken]);

  if (screen === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto animate-pulse">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{loading ? "Verifying your email..." : error ?? "Redirecting..."}</p>
          {error && <button onClick={() => setScreen("login")} className="text-xs text-primary">Back to sign in</button>}
        </div>
      </div>
    );
  }

  if (screen === "verify-sent") {
    return <PendingVerificationScreen email={pendingEmail} onResend={() => setScreen("login")} />;
  }

  if (screen === "pending-approval") {
    return <PendingApprovalScreen onBack={() => setScreen("login")} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (screen === "login") {
        const data = await apiPost("/portal/login", { email, password });
        onSuccess(data as Affiliate);
      } else if (screen === "signup") {
        const data = await apiPost("/portal/signup", { name, email, password });
        if (data.autoVerified && data.affiliate) {
          onSuccess(data.affiliate as Affiliate);
        } else {
          setPendingEmail(email);
          setScreen("verify-sent");
        }
      } else if (screen === "setup") {
        const data = await apiPost("/portal/setup-account", { email, password });
        onSuccess(data as Affiliate);
      } else if (screen === "forgot") {
        await apiPost("/portal/forgot-password", { email });
        setScreen("forgot-sent");
      } else if (screen === "reset") {
        const data = await apiPost("/portal/reset-password", { token: initialToken, password });
        setLocation("/portal");
        onSuccess(data as Affiliate);
      }
    } catch (err: unknown) {
      const e = err as Error & { code?: string; email?: string };
      if (e.code === "PENDING_VERIFICATION") { setPendingEmail(e.email ?? email); setScreen("verify-sent"); return; }
      if (e.code === "PENDING_APPROVAL") { setScreen("pending-approval"); return; }
      if (e.code === "USE_SETUP_ACCOUNT") { setError(e.message); setScreen("setup"); return; }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (screen === "forgot-sent") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Check your email</h2>
          <p className="text-sm text-muted-foreground">If an account exists for <strong className="text-foreground">{email}</strong>, a reset link has been sent. It expires in 1 hour.</p>
          <button onClick={() => setScreen("login")} className="text-xs text-muted-foreground hover:text-foreground">← Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            {screen === "reset" ? "Reset your password" : screen === "forgot" ? "Forgot password" : "Affiliate Portal"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {screen === "reset" ? "Choose your new password" : screen === "forgot" ? "Enter your email to receive a reset link" : "Sign in or create your affiliate account"}
          </p>
        </div>

        {(screen === "login" || screen === "signup" || screen === "setup") && (
          <div className="flex bg-secondary rounded p-0.5 gap-0.5">
            {(["signup", "login", "setup"] as const).map(s => (
              <button key={s} type="button" onClick={() => { setScreen(s); setError(null); }}
                className={`flex-1 text-[10px] py-1.5 rounded transition-colors font-medium ${screen === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "login" ? "Sign in" : s === "signup" ? "Join free" : "Admin invite"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {screen === "signup" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">Full name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe"
                autoComplete="name" required
                className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50" />
            </div>
          )}

          {screen !== "reset" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                autoComplete="email" required
                className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50" />
            </div>
          )}

          {screen !== "forgot" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">
                {screen === "reset" ? "New password" : screen === "signup" || screen === "setup" ? "Create password" : "Password"}
              </label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={screen !== "login" ? "At least 8 characters" : "••••••••"}
                  autoComplete={screen === "login" ? "current-password" : "new-password"} required
                  className="w-full bg-card border border-border rounded px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50" />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? "..." : screen === "login" ? "Sign in" : screen === "signup" ? "Create account" : screen === "setup" ? "Set up account" : screen === "forgot" ? "Send reset link" : "Set new password"}
          </button>

          {screen === "login" && (
            <button type="button" onClick={() => { setScreen("forgot"); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
              Forgot password?
            </button>
          )}
          {(screen === "forgot" || screen === "reset") && (
            <button type="button" onClick={() => { setScreen("login"); setError(null); }} className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
              ← Back to sign in
            </button>
          )}
        </form>

        {(screen === "login" || screen === "signup") && (
          <div className="bg-secondary/40 border border-border rounded p-3 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Demo credentials</p>
            <p className="text-xs font-mono text-foreground">demo@affiliate.demo</p>
            <p className="text-xs font-mono text-muted-foreground">Password: <span className="text-foreground">demo1234</span></p>
          </div>
        )}

        {screen === "signup" && (
          <p className="text-[10px] text-center text-muted-foreground">By signing up you agree to our terms. You'll receive a verification email if an email server is configured.</p>
        )}
        {screen === "setup" && (
          <p className="text-[10px] text-center text-muted-foreground">Use this tab if your partner manager invited you by email. Enter the email they used.</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
export default function Portal() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [checked, setChecked] = useState(false);
  const [search] = useState(() => new URLSearchParams(window.location.search));
  const resetToken = search.get("reset") ?? undefined;
  const verifyToken = search.get("verify") ?? undefined;

  useEffect(() => {
    if (resetToken || verifyToken) { setChecked(true); return; }
    apiGet("/portal/me")
      .then(a => setAffiliate(a as Affiliate))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-xs text-muted-foreground">Loading...</div></div>;
  }

  if (affiliate && !resetToken && !verifyToken) {
    const logOut = () => { apiPost("/portal/logout", {}); setAffiliate(null); };
    if (affiliate.signupStatus === "pending_approval") {
      if (!affiliate.onboardingSubmitted) {
        return <OnboardingQuestionsScreen
          affiliate={affiliate}
          onDone={() => setAffiliate({ ...affiliate, onboardingSubmitted: true })}
          onLogout={logOut}
        />;
      }
      return <PendingApprovalScreen onBack={logOut} />;
    }
    if (affiliate.signupStatus === "rejected") {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Application not approved</h2>
              <p className="text-sm text-muted-foreground mt-2">Your application wasn't approved at this time. Contact us if you think this is a mistake.</p>
            </div>
            <button onClick={logOut} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Sign out</button>
          </div>
        </div>
      );
    }
    return <PortalDashboard affiliate={affiliate} onLogout={logOut} />;
  }

  return <AuthForm onSuccess={setAffiliate} initialToken={resetToken} initialVerifyToken={verifyToken} />;
}
