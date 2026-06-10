import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, Globe, Image, Video, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type App = {
  id: number; name: string; slug: string; description: string | null;
  websiteUrl: string; promoText: string | null; imageUrls: string[];
  videoUrl: string | null; active: boolean; createdAt: string;
};

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Request failed"); }
  return res.json();
}

const EMPTY_FORM = { name: "", slug: "", description: "", websiteUrl: "", promoText: "", imageUrls: "", videoUrl: "", active: true };

function AppForm({ initial, onSave, onCancel, isSaving }: {
  initial?: Partial<typeof EMPTY_FORM & { id: number }>;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial, imageUrls: (initial?.imageUrls as unknown as string) ?? "" });
  const set = (k: keyof typeof EMPTY_FORM, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug || !form.websiteUrl) return;
    onSave(form);
  };

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">App Name *</label>
          <input value={form.name} onChange={e => { set("name", e.target.value); if (!initial?.id) set("slug", autoSlug(e.target.value)); }}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="OneTailor" required />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Slug *</label>
          <input value={form.slug} onChange={e => set("slug", e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="onetailor" required />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Website URL *</label>
        <input value={form.websiteUrl} onChange={e => set("websiteUrl", e.target.value)} type="url"
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="https://onetailor.app" required />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Description</label>
        <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="Short description shown to affiliates" />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Promo Text (for affiliates to share)</label>
        <textarea value={form.promoText} onChange={e => set("promoText", e.target.value)} rows={3}
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="Ready-to-share message for affiliates to post on social media..." />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Image URLs (one per line)</label>
        <textarea value={form.imageUrls} onChange={e => set("imageUrls", e.target.value)} rows={2}
          className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Video URL (YouTube, Vimeo, or direct)</label>
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
            {isSaving ? "Saving..." : "Save App"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function Apps() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: apps, isLoading } = useQuery<App[]>({ queryKey: ["apps"], queryFn: () => apiFetch("/apps") });

  const createApp = useMutation({
    mutationFn: (d: typeof EMPTY_FORM) => apiFetch("/apps", { method: "POST", body: JSON.stringify({ ...d, imageUrls: d.imageUrls.split("\n").map(s => s.trim()).filter(Boolean) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["apps"] }); setShowCreate(false); toast({ title: "App created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateApp = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiFetch(`/apps/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, imageUrls: data.imageUrls.split("\n").map(s => s.trim()).filter(Boolean) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["apps"] }); setEditId(null); toast({ title: "App updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteApp = useMutation({
    mutationFn: (id: number) => apiFetch(`/apps/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["apps"] }); toast({ title: "App deleted" }); },
  });

  const toggleActive = (app: App) => {
    apiFetch(`/apps/${app.id}`, { method: "PATCH", body: JSON.stringify({ active: !app.active }) })
      .then(() => qc.invalidateQueries({ queryKey: ["apps"] }));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Apps</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage PWA apps affiliates can promote</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add App
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-primary/20 rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">New App</h2>
          <AppForm onSave={d => createApp.mutate(d)} onCancel={() => setShowCreate(false)} isSaving={createApp.isPending} />
        </div>
      )}

      {/* Apps list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !apps?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No apps yet. Add your first PWA app above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map(app => (
            <div key={app.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {editId === app.id ? (
                <div className="p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Edit App</h2>
                  <AppForm
                    initial={{ ...app, imageUrls: app.imageUrls.join("\n") as unknown as string }}
                    onSave={d => updateApp.mutate({ id: app.id, data: d })}
                    onCancel={() => setEditId(null)}
                    isSaving={updateApp.isPending}
                  />
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 flex items-center gap-3">
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${app.active ? "bg-primary" : "bg-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{app.name}</p>
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{app.slug}</span>
                        {!app.active && <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">inactive</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{app.websiteUrl}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {app.imageUrls.length > 0 && <Image className="w-3.5 h-3.5 text-muted-foreground" />}
                      {app.videoUrl && <Video className="w-3.5 h-3.5 text-muted-foreground" />}
                      <button onClick={() => toggleActive(app)} className={`transition-colors ${app.active ? "text-primary" : "text-muted-foreground"}`}>
                        {app.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => setEditId(app.id)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Delete "${app.name}"?`)) deleteApp.mutate(app.id); }}
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setExpanded(expanded === app.id ? null : app.id)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground">
                        {expanded === app.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {expanded === app.id && (
                    <div className="px-5 pb-4 pt-0 border-t border-border space-y-3">
                      {app.description && <p className="text-xs text-muted-foreground">{app.description}</p>}
                      {app.promoText && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Promo Text</p>
                          <p className="text-xs bg-secondary/50 rounded p-2 whitespace-pre-wrap">{app.promoText}</p>
                        </div>
                      )}
                      {app.imageUrls.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Images ({app.imageUrls.length})</p>
                          <div className="flex gap-2 flex-wrap">
                            {app.imageUrls.map((url, i) => (
                              <img key={i} src={url} alt="" className="h-16 w-24 object-cover rounded border border-border" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ))}
                          </div>
                        </div>
                      )}
                      {app.videoUrl && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Video</p>
                          <a href={app.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{app.videoUrl}</a>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
