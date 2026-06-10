import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  TrendingUp, Copy, CheckCircle, Clock, ExternalLink, LogOut,
  ArrowRightLeft, Wallet, Eye, EyeOff, AppWindow, Share2,
  MessageCircle, Facebook, Mail, ChevronDown, ChevronUp, Video
} from "lucide-react";

async function apiPost(path: string, body: object) {
  const res = await fetch(`/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
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

type Affiliate = { id: number; name: string; email: string; refCode: string; status: string; createdAt: string };
type Stats = { clicks: number; signups: number; conversions: number; holdAmount: number; payableAmount: number; paidAmount: number; totalEarnings: number };
type Conversion = { id: number; appName: string; amount: number; commission: number; status: string; conversionDate: string; holdEndDate: string | null };
type Payout = { id: number; amount: number; status: string; createdAt: string; paidAt: string | null };
type Config = { currency: string };
type App = { id: number; name: string; slug: string; description: string | null; websiteUrl: string; promoText: string | null; imageUrls: string[]; videoUrl: string | null; active: boolean };

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
    >
      {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? "Copied!" : "Copy")}
    </button>
  );
}

function AppCard({ app, refCode }: { app: App; refCode: string }) {
  const [expanded, setExpanded] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);
  const refLink = `${app.websiteUrl}${app.websiteUrl.includes("?") ? "&" : "?"}ref=${refCode}`;
  const promoMessage = app.promoText
    ? `${app.promoText}\n\n${refLink}`
    : `Check out ${app.name}! ${refLink}`;

  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(promoMessage)}`, "_blank");
  const shareFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`, "_blank");
  const shareEmail = () => window.open(`mailto:?subject=${encodeURIComponent(`Check out ${app.name}`)}&body=${encodeURIComponent(promoMessage)}`, "_blank");

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AppWindow className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{app.name}</p>
          {app.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{app.description}</p>}
          {/* Ref link row */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1 min-w-0">
              <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">{refLink}</span>
            </div>
            <CopyButton text={refLink} label="Copy link" />
          </div>
          {/* Share buttons */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <button onClick={shareWhatsApp} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors font-medium">
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </button>
            <button onClick={shareFacebook} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 hover:bg-[#1877F2]/20 transition-colors font-medium">
              <Facebook className="w-3 h-3" /> Facebook
            </button>
            <button onClick={shareEmail} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors font-medium">
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
  );
}

function PortalDashboard({ affiliate, onLogout }: { affiliate: Affiliate; onLogout: () => void }) {
  const [tab, setTab] = useState<"overview" | "apps">("overview");
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data: stats } = useQuery<Stats>({ queryKey: ["portal-stats", affiliate.id], queryFn: () => apiGet(`/affiliates/${affiliate.id}/stats`) });
  const { data: conversions } = useQuery<Conversion[]>({ queryKey: ["portal-conversions", affiliate.id], queryFn: () => apiGet(`/conversions?affiliateId=${affiliate.id}`) });
  const { data: payouts } = useQuery<Payout[]>({ queryKey: ["portal-payouts", affiliate.id], queryFn: () => apiGet(`/payouts?affiliateId=${affiliate.id}`) });
  const { data: config } = useQuery<Config>({ queryKey: ["portal-config"], queryFn: () => apiGet("/config") });
  const { data: apps } = useQuery<App[]>({ queryKey: ["portal-apps"], queryFn: () => apiGet("/apps"), select: a => a.filter((x: App) => x.active) });

  const currency = config?.currency ?? "USD";
  const logoutMutation = useMutation({ mutationFn: () => apiPost("/portal/logout", {}), onSuccess: () => { qc.clear(); onLogout(); } });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs font-bold tracking-wider text-foreground uppercase">OneStore</p>
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
          <div className="text-right">
            <p className="text-sm font-semibold">{affiliate.name}</p>
            <p className="text-[10px] text-muted-foreground">{affiliate.email}</p>
          </div>
          <button onClick={() => logoutMutation.mutate()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-accent">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-0">
          {[{ key: "overview", label: "Overview" }, { key: "apps", label: `Promote Apps${apps?.length ? ` (${apps.length})` : ""}` }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`text-xs px-4 py-3 border-b-2 transition-colors font-medium ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {tab === "overview" ? (
          <div className="space-y-5">
            {/* Stats */}
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

            {/* Earnings breakdown */}
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
              {/* Conversions */}
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

              {/* Payouts */}
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
  );
}

type AuthMode = "login" | "signup" | "forgot" | "forgot-sent";

function AuthForm({ onSuccess, initialToken }: { onSuccess: (a: Affiliate) => void; initialToken?: string }) {
  const [mode, setMode] = useState<AuthMode>(initialToken ? "reset" as AuthMode : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && mode !== "reset") return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const data = await apiPost("/portal/login", { email, password });
        onSuccess(data as Affiliate);
      } else if (mode === "signup") {
        const data = await apiPost("/portal/signup", { email, password });
        onSuccess(data as Affiliate);
      } else if (mode === "forgot") {
        await apiPost("/portal/forgot-password", { email });
        setMode("forgot-sent" as AuthMode);
      } else if (mode === ("reset" as AuthMode)) {
        const data = await apiPost("/portal/reset-password", { token: initialToken, password });
        setLocation("/portal");
        onSuccess(data as Affiliate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (mode === ("forgot-sent" as AuthMode)) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Check your email</h2>
          <p className="text-sm text-muted-foreground">If an account exists for <strong>{email}</strong>, a reset link has been sent. It expires in 1 hour.</p>
          <button onClick={() => setMode("login")} className="text-xs text-primary hover:underline">Back to sign in</button>
        </div>
      </div>
    );
  }

  const isReset = mode === ("reset" as AuthMode);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h1 className="text-lg font-bold tracking-tight">OneStore Affiliate Portal</h1>
          <p className="text-xs text-muted-foreground">
            {isReset ? "Choose your new password" : mode === "forgot" ? "Enter your email to receive a reset link" : mode === "login" ? "Sign in to view your stats and earnings" : "Set up your affiliate account"}
          </p>
        </div>

        {!isReset && mode !== "forgot" && (
          <div className="flex bg-secondary rounded p-0.5">
            {(["login", "signup"] as AuthMode[]).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 text-xs py-1.5 rounded transition-colors font-medium ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "login" ? "Sign in" : "Set up account"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isReset && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                autoComplete="email" autoFocus required
                className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50" />
            </div>
          )}

          {(mode === "login" || mode === "signup" || isReset) && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">
                {isReset ? "New password" : mode === "signup" ? "Create password" : "Password"}
              </label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "signup" || isReset ? "At least 8 characters" : "••••••••"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"} required
                  className="w-full bg-card border border-border rounded px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50" />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? "..." : isReset ? "Set new password" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}
          </button>

          {mode === "login" && (
            <button type="button" onClick={() => { setMode("forgot"); setError(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => { setMode("login"); setError(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
              Back to sign in
            </button>
          )}
        </form>

        {mode === "signup" && (
          <p className="text-[10px] text-center text-muted-foreground">Your email must match the one your partner manager registered.</p>
        )}
      </div>
    </div>
  );
}

export default function Portal() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [checked, setChecked] = useState(false);
  const [search] = useState(() => new URLSearchParams(window.location.search));
  const resetToken = search.get("reset") ?? undefined;

  useEffect(() => {
    if (resetToken) { setChecked(true); return; }
    apiGet("/portal/me")
      .then(a => setAffiliate(a as Affiliate))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [resetToken]);

  if (!checked) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-xs text-muted-foreground">Loading...</div></div>;
  if (affiliate && !resetToken) return <PortalDashboard affiliate={affiliate} onLogout={() => setAffiliate(null)} />;
  return <AuthForm onSuccess={setAffiliate} initialToken={resetToken} />;
}
