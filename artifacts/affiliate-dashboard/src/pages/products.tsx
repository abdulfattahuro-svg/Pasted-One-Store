import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Globe, Video, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Package, ExternalLink, Tag, Zap, X, Trophy,
  Key, RefreshCw, Eye, EyeOff, Copy, CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: number; name: string; slug: string; description: string | null;
  websiteUrl: string; landingPageUrl: string | null;
  promoText: string | null; imageUrls: string[];
  videoUrl: string | null; active: boolean;
  category: string;
  commissionType: string | null; commissionValue: number | null;
  recurringEnabled: boolean; recurringPercentage: number | null;
  holdPeriodDays: number | null;
  excludeFromLeaderboard: boolean;
  createdAt: string; updatedAt: string;
};

type ProductAsset = {
  id: number; productId: number; type: string; title: string; fileUrl: string; createdAt: string;
};

const CATEGORY_OPTIONS = [
  { value: "software", label: "SaaS Product", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "mobile_app", label: "Mobile App", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { value: "pwa", label: "PWA", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { value: "course", label: "Course", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "ebook", label: "Ebook", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "subscription", label: "Subscription", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "consulting", label: "Consulting", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  { value: "physical_product", label: "Physical Product", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  { value: "event", label: "Event", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  { value: "offline_service", label: "Offline Service", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { value: "custom", label: "Custom", color: "bg-secondary text-muted-foreground border-border" },
];

const COMMISSION_TYPES = [
  { value: "", label: "Use Global Default" },
  { value: "fixed", label: "Fixed Amount" },
  { value: "percentage", label: "Percentage %" },
  { value: "recurring", label: "Recurring %" },
  { value: "hybrid", label: "Hybrid (Fixed + %)" },
];

const ASSET_TYPES = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "pdf", label: "PDF" },
  { value: "flyer", label: "Flyer" },
  { value: "banner", label: "Banner" },
  { value: "social_post", label: "Social Post" },
];

function categoryInfo(value: string) {
  return CATEGORY_OPTIONS.find(c => c.value === value) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Request failed"); }
  return res.json();
}

const EMPTY_FORM = {
  name: "", slug: "", description: "", websiteUrl: "", landingPageUrl: "",
  promoText: "", imageUrls: "", videoUrl: "", active: true, category: "pwa",
  commissionType: "", commissionValue: "", recurringEnabled: false,
  recurringPercentage: "", holdPeriodDays: "",
  excludeFromLeaderboard: false,
};

type FormState = typeof EMPTY_FORM;

function ProductForm({ initial, onSave, onCancel, isSaving }: {
  initial?: Partial<FormState & { id: number }>;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    ...initial,
    imageUrls: Array.isArray(initial?.imageUrls) ? (initial.imageUrls as unknown as string[]).join("\n") : (initial?.imageUrls ?? ""),
    commissionValue: initial?.commissionValue !== null && initial?.commissionValue !== undefined ? String(initial.commissionValue) : "",
    recurringPercentage: initial?.recurringPercentage !== null && initial?.recurringPercentage !== undefined ? String(initial.recurringPercentage) : "",
    holdPeriodDays: initial?.holdPeriodDays !== null && initial?.holdPeriodDays !== undefined ? String(initial.holdPeriodDays) : "",
    excludeFromLeaderboard: initial?.excludeFromLeaderboard ?? false,
  });
  const set = (k: keyof FormState, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const showFixed = form.commissionType === "fixed" || form.commissionType === "hybrid";
  const showPercent = form.commissionType === "percentage";
  const showRecurring = form.commissionType === "recurring" || form.commissionType === "hybrid";

  return (
    <form onSubmit={e => { e.preventDefault(); if (!form.name || !form.slug || !form.websiteUrl) return; onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Offer Name *</label>
          <input value={form.name} onChange={e => { set("name", e.target.value); if (!initial?.id) set("slug", autoSlug(e.target.value)); }}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="My Course" required />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Slug *</label>
          <input value={form.slug} onChange={e => set("slug", e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="my-course" required />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Category</label>
        <select value={form.category} onChange={e => set("category", e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
          {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Website URL *</label>
          <input value={form.websiteUrl} onChange={e => set("websiteUrl", e.target.value)} type="url"
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="https://example.com" required />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Landing Page URL</label>
          <input value={form.landingPageUrl} onChange={e => set("landingPageUrl", e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="https://example.com/offer" />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Description</label>
        <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="Short description shown to affiliates" />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Promo Text (ready-to-share message)</label>
        <textarea value={form.promoText} onChange={e => set("promoText", e.target.value)} rows={3}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="Ready-to-share message for affiliates..." />
      </div>

      <div className="border border-border rounded-lg p-3 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5"><Zap className="w-3 h-3" /> Commission (overrides global default)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Commission Type</label>
            <select value={form.commissionType} onChange={e => set("commissionType", e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
              {COMMISSION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {(showFixed || showPercent) && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                {showFixed ? "Fixed Amount" : "Percentage (%)"}
              </label>
              <input type="number" min="0" step="0.01" value={form.commissionValue} onChange={e => set("commissionValue", e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder={showFixed ? "5000" : "10"} />
            </div>
          )}
        </div>
        {showRecurring && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Recurring % (per renewal)</label>
              <input type="number" min="0" max="100" step="0.01" value={form.recurringPercentage} onChange={e => set("recurringPercentage", e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="20" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Hold Period (days)</label>
            <input type="number" min="0" value={form.holdPeriodDays} onChange={e => set("holdPeriodDays", e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Global default" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Image URLs (one per line)</label>
        <textarea value={form.imageUrls} onChange={e => set("imageUrls", e.target.value)} rows={2}
          className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="https://example.com/image1.jpg" />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Video URL</label>
        <input value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="https://youtube.com/embed/..." />
      </div>

      {/* Toggles row */}
      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-muted-foreground">Active</span>
          <button type="button" onClick={() => set("active", !form.active)} className={`transition-colors ${form.active ? "text-primary" : "text-muted-foreground"}`}>
            {form.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Exclude from leaderboard</span>
          <button type="button" onClick={() => set("excludeFromLeaderboard", !form.excludeFromLeaderboard)}
            className={`transition-colors ${form.excludeFromLeaderboard ? "text-amber-400" : "text-muted-foreground"}`}>
            {form.excludeFromLeaderboard ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
        </label>
      </div>

      {form.excludeFromLeaderboard && (
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded p-2.5 -mt-2">
          <Trophy className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-400">This offer's clicks and conversions will not count toward affiliate rankings.</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium">
          {isSaving ? "Saving..." : "Save Offer"}
        </button>
      </div>
    </form>
  );
}

function AssetManager({ productId }: { productId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [assetForm, setAssetForm] = useState({ type: "image", title: "", fileUrl: "" });

  const { data: assets = [] } = useQuery<ProductAsset[]>({
    queryKey: ["product-assets", productId],
    queryFn: () => apiFetch(`/products/${productId}/assets`),
  });

  const addAsset = useMutation({
    mutationFn: () => apiFetch(`/products/${productId}/assets`, { method: "POST", body: JSON.stringify(assetForm) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product-assets", productId] }); setShowAdd(false); setAssetForm({ type: "image", title: "", fileUrl: "" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAsset = useMutation({
    mutationFn: (assetId: number) => apiFetch(`/products/${productId}/assets/${assetId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-assets", productId] }),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Marketing Assets ({assets.length})</p>
        <button onClick={() => setShowAdd(s => !s)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
          <Plus className="w-3 h-3" /> Add Asset
        </button>
      </div>

      {showAdd && (
        <div className="bg-background border border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Type</label>
              <select value={assetForm.type} onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50">
                {ASSET_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Title *</label>
              <input value={assetForm.title} onChange={e => setAssetForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Product Banner" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">File URL *</label>
            <input value={assetForm.fileUrl} onChange={e => setAssetForm(f => ({ ...f, fileUrl: e.target.value }))}
              className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="https://example.com/banner.jpg" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button onClick={() => addAsset.mutate()} disabled={!assetForm.title || !assetForm.fileUrl || addAsset.isPending}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {addAsset.isPending ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {assets.length > 0 && (
        <div className="space-y-1">
          {assets.map(asset => (
            <div key={asset.id} className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{asset.type}</span>
              <span className="text-xs flex-1 truncate">{asset.title}</span>
              <a href={asset.fileUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <ExternalLink className="w-3 h-3" />
              </a>
              <button onClick={() => deleteAsset.mutate(asset.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ApiKey = {
  id: number; offerId: number; name: string; apiKey: string;
  environment: string; status: string; lastUsedAt: string | null; createdAt: string;
};

const ENV_COLORS: Record<string, string> = {
  production: "bg-primary/10 text-primary border-primary/20",
  staging: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  development: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

function ApiKeyManager({ productId }: { productId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({ name: "", environment: "production" });
  const [revealedKey, setRevealedKey] = useState<{ id: number; key: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ["api-keys", productId],
    queryFn: () => apiFetch(`/products/${productId}/api-keys`),
  });

  const createKey = useMutation({
    mutationFn: () => apiFetch(`/products/${productId}/api-keys`, {
      method: "POST",
      body: JSON.stringify(newKeyForm),
    }),
    onSuccess: (data: ApiKey) => {
      qc.invalidateQueries({ queryKey: ["api-keys", productId] });
      setRevealedKey({ id: data.id, key: data.apiKey });
      setShowCreate(false);
      setNewKeyForm({ name: "", environment: "production" });
      toast({ title: "API key created", description: "Copy it now — it won't be shown again." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/products/${productId}/api-keys/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys", productId] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${productId}/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys", productId] });
      toast({ title: "API key deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const regenerate = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${productId}/api-keys/${id}/regenerate`, { method: "POST" }),
    onSuccess: (data: ApiKey) => {
      qc.invalidateQueries({ queryKey: ["api-keys", productId] });
      setRevealedKey({ id: data.id, key: data.apiKey });
      toast({ title: "API key regenerated", description: "Copy the new key — it won't be shown again." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Key className="w-3 h-3" /> API Keys ({apiKeys.length})
        </p>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
          <Plus className="w-3 h-3" /> New Key
        </button>
      </div>

      {showCreate && (
        <div className="bg-background border border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Key Name *</label>
              <input value={newKeyForm.name} onChange={e => setNewKeyForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="e.g. Production App" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Environment</label>
              <select value={newKeyForm.environment} onChange={e => setNewKeyForm(f => ({ ...f, environment: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button onClick={() => createKey.mutate()} disabled={!newKeyForm.name.trim() || createKey.isPending}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {createKey.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {revealedKey && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">Copy your key now — it won't be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] font-mono bg-background border border-border rounded px-2 py-1.5 break-all">{revealedKey.key}</code>
            <button onClick={() => copyToClipboard(revealedKey.key, revealedKey.id)}
              className="flex-shrink-0 p-1.5 rounded border border-border text-muted-foreground hover:text-primary transition-colors">
              {copiedId === revealedKey.id ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
        </div>
      )}

      {apiKeys.length > 0 && (
        <div className="space-y-1">
          {apiKeys.map(key => (
            <div key={key.id} className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <Key className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium truncate">{key.name}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${ENV_COLORS[key.environment] ?? "bg-secondary text-muted-foreground border-border"}`}>
                    {key.environment}
                  </span>
                  {key.status === "disabled" && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/20">disabled</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[9px] font-mono text-muted-foreground">{key.apiKey}</code>
                  {key.lastUsedAt && (
                    <span className="text-[9px] text-muted-foreground">· last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => regenerate.mutate(key.id)} disabled={regenerate.isPending}
                  title="Regenerate key" className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button onClick={() => toggleStatus.mutate({ id: key.id, status: key.status === "active" ? "disabled" : "active" })}
                  title={key.status === "active" ? "Disable key" : "Enable key"}
                  className={`p-1.5 rounded hover:bg-accent transition-colors ${key.status === "active" ? "text-primary" : "text-muted-foreground"}`}>
                  {key.status === "active" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteKey.mutate(key.id)}
                  className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {apiKeys.length === 0 && !showCreate && (
        <p className="text-[10px] text-muted-foreground py-1">No API keys yet. Create one to enable programmatic access to this offer.</p>
      )}
    </div>
  );
}

type CommissionRule = {
  id: number;
  offerId: number;
  triggerEvent: string;
  commissionType: string;
  commissionValue: number;
  recurringEnabled: boolean;
  recurringPercentage: number | null;
  isActive: boolean;
  createdAt: string;
};

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  lead_submitted: "Lead Submitted",
  lead_approved: "Lead Approved",
  deal_won: "Deal Won",
  signup: "Signup",
  purchase: "Purchase",
  renewal: "Renewal",
  upgrade: "Upgrade",
};

const TRIGGER_EVENTS = Object.keys(TRIGGER_EVENT_LABELS);

const RULE_COMMISSION_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "percentage", label: "Percentage %" },
  { value: "hybrid", label: "Hybrid (Fixed + %)" },
];

function ruleValueLabel(rule: CommissionRule) {
  if (rule.commissionType === "fixed") return `₦${rule.commissionValue.toLocaleString()}`;
  if (rule.commissionType === "percentage") return `${rule.commissionValue}%`;
  if (rule.commissionType === "hybrid") return `₦${rule.commissionValue.toLocaleString()} + ${rule.recurringPercentage ?? 0}%`;
  return String(rule.commissionValue);
}

function CommissionRuleManager({ offerId }: { offerId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ triggerEvent: "lead_submitted", commissionType: "fixed", commissionValue: "", recurringPercentage: "" });

  const { data: rules = [] } = useQuery<CommissionRule[]>({
    queryKey: ["commission-rules", offerId],
    queryFn: () => apiFetch(`/products/${offerId}/commission-rules`),
  });

  const createRule = useMutation({
    mutationFn: () => apiFetch(`/products/${offerId}/commission-rules`, {
      method: "POST",
      body: JSON.stringify({
        triggerEvent: form.triggerEvent,
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue),
        recurringEnabled: form.commissionType === "hybrid",
        recurringPercentage: form.recurringPercentage ? Number(form.recurringPercentage) : undefined,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rules", offerId] });
      setShowCreate(false);
      setForm({ triggerEvent: "lead_submitted", commissionType: "fixed", commissionValue: "", recurringPercentage: "" });
      toast({ title: "Commission rule added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiFetch(`/products/${offerId}/commission-rules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rules", offerId] });
      setEditingId(null);
      toast({ title: "Rule updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${offerId}/commission-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rules", offerId] });
      toast({ title: "Rule deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const usedEvents = new Set(rules.map(r => r.triggerEvent));
  const availableEvents = TRIGGER_EVENTS.filter(e => !usedEvents.has(e));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Commission Rules ({rules.length})
        </p>
        {availableEvents.length > 0 && (
          <button onClick={() => { setShowCreate(s => !s); setForm(f => ({ ...f, triggerEvent: availableEvents[0] })); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
            <Plus className="w-3 h-3" /> Add Rule
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-background border border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Trigger Event</label>
              <select value={form.triggerEvent} onChange={e => setForm(f => ({ ...f, triggerEvent: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50">
                {availableEvents.map(e => <option key={e} value={e}>{TRIGGER_EVENT_LABELS[e]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Commission Type</label>
              <select value={form.commissionType} onChange={e => setForm(f => ({ ...f, commissionType: e.target.value }))}
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50">
                {RULE_COMMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">
                {form.commissionType === "percentage" ? "Rate (%)" : "Amount (₦)"}
              </label>
              <input type="number" value={form.commissionValue} onChange={e => setForm(f => ({ ...f, commissionValue: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            {form.commissionType === "hybrid" && (
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Bonus Rate (%)</label>
                <input type="number" value={form.recurringPercentage} onChange={e => setForm(f => ({ ...f, recurringPercentage: e.target.value }))}
                  placeholder="e.g. 5"
                  className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button onClick={() => createRule.mutate()} disabled={!form.commissionValue || createRule.isPending}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {createRule.isPending ? "Saving..." : "Add Rule"}
            </button>
          </div>
        </div>
      )}

      {rules.length > 0 && (
        <div className="space-y-1">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
              <Zap className={`w-3 h-3 flex-shrink-0 ${rule.isActive ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                {editingId === rule.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      defaultValue={rule.commissionValue}
                      id={`rule-val-${rule.id}`}
                      className="w-24 bg-card border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`rule-val-${rule.id}`) as HTMLInputElement;
                        updateRule.mutate({ id: rule.id, data: { commissionValue: Number(input.value) } });
                      }}
                      className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium">{TRIGGER_EVENT_LABELS[rule.triggerEvent] ?? rule.triggerEvent}</span>
                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{ruleValueLabel(rule)}</span>
                    {!rule.isActive && <span className="text-[9px] bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded">inactive</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => updateRule.mutate({ id: rule.id, data: { isActive: !rule.isActive } })}
                  title={rule.isActive ? "Disable rule" : "Enable rule"}
                  className={`p-1.5 rounded hover:bg-accent transition-colors ${rule.isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {rule.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}
                  className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => deleteRule.mutate(rule.id)}
                  className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && !showCreate && (
        <p className="text-[10px] text-muted-foreground py-1">No commission rules yet. Add rules to automatically trigger commissions on lead events.</p>
      )}
    </div>
  );
}

function commissionSummary(product: Product) {
  if (!product.commissionType) return "Global default";
  const type = COMMISSION_TYPES.find(c => c.value === product.commissionType)?.label ?? product.commissionType;
  const val = product.commissionValue !== null ? product.commissionValue : null;
  if (product.commissionType === "fixed") return val !== null ? `Fixed ${val}` : type;
  if (product.commissionType === "percentage") return val !== null ? `${val}%` : type;
  if (product.commissionType === "recurring") return product.recurringPercentage !== null ? `${product.recurringPercentage}% recurring` : type;
  if (product.commissionType === "hybrid") return val !== null && product.recurringPercentage !== null ? `${val} + ${product.recurringPercentage}%` : type;
  return type;
}

export default function Products() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: products, isLoading } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => apiFetch("/products") });

  const filtered = products?.filter(p => categoryFilter === "all" || p.category === categoryFilter) ?? [];

  function buildPayload(d: FormState) {
    return {
      ...d,
      imageUrls: d.imageUrls.split("\n").map((s: string) => s.trim()).filter(Boolean),
      commissionType: d.commissionType || null,
      commissionValue: d.commissionValue !== "" ? Number(d.commissionValue) : null,
      recurringEnabled: d.recurringEnabled,
      recurringPercentage: d.recurringPercentage !== "" ? Number(d.recurringPercentage) : null,
      holdPeriodDays: d.holdPeriodDays !== "" ? Number(d.holdPeriodDays) : null,
      landingPageUrl: d.landingPageUrl || null,
      excludeFromLeaderboard: d.excludeFromLeaderboard,
    };
  }

  const createProduct = useMutation({
    mutationFn: (d: FormState) => apiFetch("/products", { method: "POST", body: JSON.stringify(buildPayload(d)) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setShowCreate(false); toast({ title: "Product created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      apiFetch(`/products/${id}`, { method: "PATCH", body: JSON.stringify(buildPayload(data)) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setEditId(null); toast({ title: "Product updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast({ title: "Product deleted" }); },
  });

  const toggleActive = (p: Product) => {
    apiFetch(`/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) })
      .then(() => qc.invalidateQueries({ queryKey: ["products"] }));
  };

  const toggleLeaderboardExclusion = (p: Product) => {
    apiFetch(`/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ excludeFromLeaderboard: !p.excludeFromLeaderboard }) })
      .then(() => qc.invalidateQueries({ queryKey: ["products"] }));
  };

  const usedCategories = new Set(products?.map(p => p.category) ?? []);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Offers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage everything affiliates can promote</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Offer
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[{ value: "all", label: "All" }, ...CATEGORY_OPTIONS.filter(c => c.value === "all" || usedCategories.has(c.value))
          .map(c => ({ value: c.value, label: c.label }))].map(c => (
          <button key={c.value} onClick={() => setCategoryFilter(c.value)}
            className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${categoryFilter === c.value ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            {c.label}
            {c.value !== "all" && products && <span className="ml-1 opacity-60">{products.filter(p => p.category === c.value).length}</span>}
            {c.value === "all" && products && <span className="ml-1 opacity-60">{products.length}</span>}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-primary/20 rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">New Offer</h2>
          <ProductForm onSave={d => createProduct.mutate(d)} onCancel={() => setShowCreate(false)} isSaving={createProduct.isPending} />
        </div>
      )}

      {/* Products list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{products?.length ? "No offers match this filter." : "No offers yet. Add your first offer above."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(product => {
            const cat = categoryInfo(product.category);
            return (
              <div key={product.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {editId === product.id ? (
                  <div className="p-5">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Edit Offer</h2>
                    <ProductForm
                      initial={{ ...product, imageUrls: product.imageUrls.join("\n") as unknown as string }}
                      onSave={d => updateProduct.mutate({ id: product.id, data: d })}
                      onCancel={() => setEditId(null)}
                      isSaving={updateProduct.isPending}
                    />
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${product.active ? "bg-primary" : "bg-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{product.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{product.slug}</span>
                          {product.excludeFromLeaderboard && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              <Trophy className="w-2.5 h-2.5" /> excl. rankings
                            </span>
                          )}
                        </div>
                        {product.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{product.description}</p>}
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{product.websiteUrl}</span>
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{commissionSummary(product)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleLeaderboardExclusion(product)}
                          title={product.excludeFromLeaderboard ? "Include in rankings" : "Exclude from rankings"}
                          className={`p-1.5 rounded hover:bg-accent transition-colors ${product.excludeFromLeaderboard ? "text-amber-400" : "text-muted-foreground"}`}
                        >
                          <Trophy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleActive(product)} className={`p-1.5 rounded hover:bg-accent transition-colors ${product.active ? "text-primary" : "text-muted-foreground"}`}>
                          {product.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setEditId(product.id); setShowCreate(false); }} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteProduct.mutate(product.id)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setExpanded(expanded === product.id ? null : product.id)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground">
                          {expanded === product.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {expanded === product.id && (
                      <div className="border-t border-border px-5 py-4 space-y-4">
                        {product.landingPageUrl && (
                          <div className="flex items-center gap-2 text-xs">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Landing:</span>
                            <a href={product.landingPageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{product.landingPageUrl}</a>
                          </div>
                        )}
                        {product.promoText && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Promo Text</p>
                            <p className="text-xs bg-secondary/50 rounded p-2 whitespace-pre-wrap">{product.promoText}</p>
                          </div>
                        )}
                        {product.imageUrls.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Images ({product.imageUrls.length})</p>
                            <div className="flex gap-2 flex-wrap">
                              {product.imageUrls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="" className="h-16 w-24 object-cover rounded border border-border hover:opacity-80 transition-opacity" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {product.videoUrl && (
                          <div className="flex items-center gap-2 text-xs">
                            <Video className="w-3.5 h-3.5 text-muted-foreground" />
                            <a href={product.videoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{product.videoUrl}</a>
                          </div>
                        )}
                        <AssetManager productId={product.id} />
                        <ApiKeyManager productId={product.id} />
                        <CommissionRuleManager offerId={product.id} />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
