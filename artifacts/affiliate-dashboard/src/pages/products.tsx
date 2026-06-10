import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Globe, Image, Video, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Package, ExternalLink, FileText, Tag, Zap, X,
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
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Product Name *</label>
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

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-muted-foreground">Active</span>
          <button type="button" onClick={() => set("active", !form.active)} className={`transition-colors ${form.active ? "text-primary" : "text-muted-foreground"}`}>
            {form.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          <button type="submit" disabled={isSaving} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium">
            {isSaving ? "Saving..." : "Save Product"}
          </button>
        </div>
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

function commissionSummary(product: Product, globalCommission?: { type: string; value: string }) {
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

  const usedCategories = new Set(products?.map(p => p.category) ?? []);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Products & Offers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage everything affiliates can promote</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Product
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">New Product</h2>
          <ProductForm onSave={d => createProduct.mutate(d)} onCancel={() => setShowCreate(false)} isSaving={createProduct.isPending} />
        </div>
      )}

      {/* Products list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{products?.length ? "No products match this filter." : "No products yet. Add your first product above."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(product => {
            const cat = categoryInfo(product.category);
            return (
              <div key={product.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {editId === product.id ? (
                  <div className="p-5">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Edit Product</h2>
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
                          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{product.slug}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cat.color}`}>{cat.label}</span>
                          {!product.active && <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">inactive</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{product.websiteUrl}</p>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />{commissionSummary(product)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {product.imageUrls.length > 0 && <Image className="w-3.5 h-3.5 text-muted-foreground" />}
                        {product.videoUrl && <Video className="w-3.5 h-3.5 text-muted-foreground" />}
                        <button onClick={() => toggleActive(product)} className={`transition-colors ${product.active ? "text-primary" : "text-muted-foreground"}`}>
                          {product.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button onClick={() => { setEditId(product.id); setExpanded(null); }} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${product.name}"?`)) deleteProduct.mutate(product.id); }}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setExpanded(expanded === product.id ? null : product.id)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground">
                          {expanded === product.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {expanded === product.id && (
                      <div className="px-5 pb-5 pt-0 border-t border-border space-y-4">
                        {product.description && <p className="text-xs text-muted-foreground pt-3">{product.description}</p>}

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {product.landingPageUrl && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Landing Page</p>
                              <a href={product.landingPageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />{product.landingPageUrl}
                              </a>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Commission</p>
                            <div className="space-y-0.5">
                              <p><span className="text-muted-foreground">Type:</span> {COMMISSION_TYPES.find(c => c.value === (product.commissionType ?? ""))?.label ?? "Global default"}</p>
                              {product.commissionValue !== null && <p><span className="text-muted-foreground">Value:</span> {product.commissionValue}</p>}
                              {product.recurringEnabled && product.recurringPercentage !== null && <p><span className="text-muted-foreground">Recurring:</span> {product.recurringPercentage}%</p>}
                              {product.holdPeriodDays !== null && <p><span className="text-muted-foreground">Hold period:</span> {product.holdPeriodDays} days</p>}
                            </div>
                          </div>
                        </div>

                        {product.promoText && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Promo Text</p>
                            <p className="text-xs bg-secondary/50 rounded p-2 whitespace-pre-wrap">{product.promoText}</p>
                          </div>
                        )}
                        {product.imageUrls.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Images</p>
                            <div className="flex gap-2 flex-wrap">
                              {product.imageUrls.map((url, i) => (
                                <img key={i} src={url} alt="" className="h-16 w-24 object-cover rounded border border-border" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ))}
                            </div>
                          </div>
                        )}
                        {product.videoUrl && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Video</p>
                            <a href={product.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{product.videoUrl}</a>
                          </div>
                        )}

                        <AssetManager productId={product.id} />
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
