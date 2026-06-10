import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Copy, CheckCircle, Clock, ExternalLink, LogOut, ArrowRightLeft, Wallet, Eye, EyeOff } from "lucide-react";

const BASE = "";

async function apiPost(path: string, body: object) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Request failed");
  }
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
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${colors[status] ?? "bg-secondary text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

type Affiliate = { id: number; name: string; email: string; refCode: string; status: string; createdAt: string };
type Stats = { clicks: number; signups: number; conversions: number; holdAmount: number; payableAmount: number; paidAmount: number; totalEarnings: number };
type Conversion = { id: number; appName: string; amount: number; commission: number; status: string; conversionDate: string; holdEndDate: string | null };
type Payout = { id: number; amount: number; status: string; createdAt: string; paidAt: string | null };
type Config = { currency: string };

function PortalDashboard({ affiliate, onLogout }: { affiliate: Affiliate; onLogout: () => void }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const qc = useQueryClient();

  const { data: stats } = useQuery<Stats>({ queryKey: ["portal-stats", affiliate.id], queryFn: () => apiGet(`/affiliates/${affiliate.id}/stats`) });
  const { data: conversions } = useQuery<Conversion[]>({ queryKey: ["portal-conversions", affiliate.id], queryFn: () => apiGet(`/conversions?affiliateId=${affiliate.id}`) });
  const { data: payouts } = useQuery<Payout[]>({ queryKey: ["portal-payouts", affiliate.id], queryFn: () => apiGet(`/payouts?affiliateId=${affiliate.id}`) });
  const { data: config } = useQuery<Config>({ queryKey: ["portal-config"], queryFn: () => apiGet("/config") });

  const currency = config?.currency ?? "USD";
  const refLink = `https://onestore.app/?ref=${affiliate.refCode}`;

  const logoutMutation = useMutation({
    mutationFn: () => apiPost("/portal/logout", {}),
    onSuccess: () => { qc.clear(); onLogout(); },
  });

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
          <div className="text-right">
            <p className="text-sm font-semibold">{affiliate.name}</p>
            <p className="text-[10px] text-muted-foreground">{affiliate.email}</p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-accent"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Ref link */}
        <div className="bg-card border border-primary/20 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Your Referral Link</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-mono text-muted-foreground truncate">{refLink}</span>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(refLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
            >
              {linkCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {linkCopied ? "Copied!" : "Copy link"}
            </button>
            <div className="flex items-center gap-1.5 bg-secondary border border-border px-3 py-2 rounded">
              <span className="text-xs font-mono font-bold">{affiliate.refCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(affiliate.refCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-muted-foreground hover:text-foreground">
                {copied ? <CheckCircle className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

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
            <p className="text-[10px] text-muted-foreground mt-1">Pending 14-day review</p>
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
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
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
              {!conversions?.length && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No conversions yet — share your referral link</p>}
            </div>
          </div>

          {/* Payouts */}
          <div className="bg-card border border-border rounded">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payouts</p>
              <span className="text-[10px] text-muted-foreground">{payouts?.length ?? 0} total</span>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
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
              {!payouts?.length && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No payouts issued yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type AuthMode = "login" | "signup";

function AuthForm({ onSuccess }: { onSuccess: (a: Affiliate) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost(mode === "login" ? "/portal/login" : "/portal/signup", { email, password });
      onSuccess(data as Affiliate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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
            {mode === "login" ? "Sign in to view your stats and earnings" : "Set up your affiliate account"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-secondary rounded p-0.5">
          {(["login", "signup"] as AuthMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 text-xs py-1.5 rounded transition-colors font-medium ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "login" ? "Sign in" : "Set up account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
              className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">
              {mode === "signup" ? "Create password" : "Password"}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                className="w-full bg-card border border-border rounded px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/50"
              />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (mode === "login" ? "Signing in..." : "Setting up...") : (mode === "login" ? "Sign in" : "Create account")}
          </button>
        </form>

        {mode === "signup" && (
          <p className="text-[10px] text-center text-muted-foreground">
            Your email must match the one your partner manager registered. Don't have an account? Contact your OneStore partner manager.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Portal() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiGet("/portal/me")
      .then(a => setAffiliate(a as Affiliate))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (affiliate) return <PortalDashboard affiliate={affiliate} onLogout={() => setAffiliate(null)} />;
  return <AuthForm onSuccess={setAffiliate} />;
}
