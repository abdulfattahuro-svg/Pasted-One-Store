import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  TrendingUp, Copy, CheckCircle, Clock, ExternalLink, LogOut,
  ArrowRightLeft, Wallet, Eye, EyeOff, AppWindow, Share2,
  MessageCircle, Facebook, Mail, ChevronDown, ChevronUp, Video,
  Sparkles, DollarSign, Users, Zap, Star, X, Send
} from "lucide-react";

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

type Affiliate = { id: number; name: string; email: string; refCode: string; status: string; signupStatus: string | null; isSelfSignup: boolean; welcomedAt: string | null; createdAt: string };
type ProgramInfo = { programName: string; programTagline: string; commissionHighlight: string; programDetails: string; approvalMode: string };
type Stats = { clicks: number; signups: number; conversions: number; holdAmount: number; payableAmount: number; paidAmount: number; totalEarnings: number };
type Conversion = { id: number; appName: string; amount: number; commission: number; status: string; conversionDate: string; holdEndDate: string | null };
type Payout = { id: number; amount: number; status: string; createdAt: string; paidAt: string | null };
type Config = { currency: string };
type App = { id: number; name: string; slug: string; description: string | null; websiteUrl: string; promoText: string | null; imageUrls: string[]; videoUrl: string | null; active: boolean };

// ─────────────────────────────────────────────────────────────
// ONBOARDING MODAL — shown once after first approved login
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
        {/* Progress dots */}
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

function AppCard({ app, refCode }: { app: App; refCode: string }) {
  const [expanded, setExpanded] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);
  const refLink = `${app.websiteUrl}${app.websiteUrl.includes("?") ? "&" : "?"}ref=${refCode}`;
  const promoMessage = app.promoText ? `${app.promoText}\n\n${refLink}` : `Check out ${app.name}! ${refLink}`;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AppWindow className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{app.name}</p>
          {app.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{app.description}</p>}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1 min-w-0">
              <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">{refLink}</span>
            </div>
            <CopyButton text={refLink} label="Copy link" />
          </div>
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
            {(app.promoText || app.imageUrls.length > 0 || app.videoUrl) && (
              <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                <Share2 className="w-3 h-3" /> Promo kit {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>
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
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
function PortalDashboard({ affiliate, onLogout }: { affiliate: Affiliate; onLogout: () => void }) {
  const [tab, setTab] = useState<"overview" | "apps">("overview");
  const [copied, setCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!affiliate.welcomedAt);
  const qc = useQueryClient();

  const { data: stats } = useQuery<Stats>({ queryKey: ["portal-stats", affiliate.id], queryFn: () => apiGet(`/affiliates/${affiliate.id}/stats`) });
  const { data: conversions } = useQuery<Conversion[]>({ queryKey: ["portal-conversions", affiliate.id], queryFn: () => apiGet(`/conversions?affiliateId=${affiliate.id}`) });
  const { data: payouts } = useQuery<Payout[]>({ queryKey: ["portal-payouts", affiliate.id], queryFn: () => apiGet(`/payouts?affiliateId=${affiliate.id}`) });
  const { data: config } = useQuery<Config>({ queryKey: ["portal-config"], queryFn: () => apiGet("/config") });
  const { data: apps } = useQuery<App[]>({ queryKey: ["portal-apps"], queryFn: () => apiGet("/apps"), select: a => a.filter((x: App) => x.active) });
  const { data: programInfo } = useQuery<ProgramInfo>({ queryKey: ["portal-program-info"], queryFn: () => apiGet("/portal/program-info") });

  const currency = config?.currency ?? "USD";
  const logoutMutation = useMutation({ mutationFn: () => apiPost("/portal/logout", {}), onSuccess: () => { qc.clear(); onLogout(); } });

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
            {[{ key: "overview", label: "Overview" }, { key: "apps", label: `Promote Apps${apps?.length ? ` (${apps.length})` : ""}` }].map(t => (
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
                  <p className="text-[10px] text-muted-foreground mt-1">14-day review period</p>
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
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Each app below comes with your personal referral link. Share it to earn commissions when people sign up.</p>
              {!apps?.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <AppWindow className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No apps available yet. Check back soon!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apps.map(app => <AppCard key={app.id} app={app} refCode={affiliate.refCode} />)}
                </div>
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
// AUTH FORM
// ─────────────────────────────────────────────────────────────
type AuthScreen = "login" | "signup" | "setup" | "forgot" | "forgot-sent" | "reset" | "verify-sent" | "pending-approval";

function AuthForm({ onSuccess, initialToken, initialVerifyToken }: {
  onSuccess: (a: Affiliate) => void;
  initialToken?: string;
  initialVerifyToken?: string;
}) {
  const [screen, setScreen] = useState<AuthScreen>(
    initialToken ? "reset" : initialVerifyToken ? "verifying" as AuthScreen : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Auto-verify if token in URL
  useEffect(() => {
    if (initialVerifyToken) {
      setLoading(true);
      apiPost("/portal/verify-email", { token: initialVerifyToken })
        .then(d => {
          setVerifyStatus(d.status);
          setLoading(false);
          setLocation("/portal");
          if (d.status === "active") {
            // Session is set, reload /portal/me
            apiGet("/portal/me").then(a => onSuccess(a as Affiliate)).catch(() => {});
          } else {
            setScreen("pending-approval");
          }
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
          setScreen("login");
        });
    }
  }, [initialVerifyToken]);

  if (screen === ("verifying" as AuthScreen)) {
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
        await apiPost("/portal/signup", { name, email, password });
        setPendingEmail(email);
        setScreen("verify-sent");
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

        {/* Tab strip for login/signup/setup */}
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

        {screen === "signup" && (
          <p className="text-[10px] text-center text-muted-foreground">By signing up you agree to our terms. You'll receive a verification email.</p>
        )}
        {screen === "setup" && (
          <p className="text-[10px] text-center text-muted-foreground">Use this tab if your partner manager invited you by email.</p>
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
    return <PortalDashboard affiliate={affiliate} onLogout={() => setAffiliate(null)} />;
  }

  return <AuthForm onSuccess={setAffiliate} initialToken={resetToken} initialVerifyToken={verifyToken} />;
}
