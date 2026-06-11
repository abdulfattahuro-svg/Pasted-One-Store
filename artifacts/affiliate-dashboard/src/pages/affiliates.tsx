import { useState } from "react";
import { useLocation } from "wouter";
import { useListAffiliates, useCreateAffiliate, getListAffiliatesQueryKey } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, UserCheck, UserX, Clock, CheckCircle, XCircle, Bell, ChevronDown, ChevronUp, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
});

type FormData = z.infer<typeof formSchema>;

type PendingAffiliate = {
  id: number;
  name: string;
  email: string;
  refCode: string;
  createdAt: string;
  signupStatus: string | null;
};

type OnboardingAnswer = {
  id: number;
  affiliateId: number;
  questionKey: string;
  question: string;
  answer: string;
  createdAt: string;
};

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, credentials: "include", ...options });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Request failed"); }
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
      status === "active" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
    }`}>
      {status === "active" ? <UserCheck className="w-2.5 h-2.5" /> : <UserX className="w-2.5 h-2.5" />}
      {status}
    </span>
  );
}

function OnboardingAnswersPanel({ affiliateId, name }: { affiliateId: number; name: string }) {
  const { data: answers, isLoading } = useQuery<OnboardingAnswer[]>({
    queryKey: ["onboarding-answers", affiliateId],
    queryFn: () => apiFetch(`/portal/affiliate-onboarding/${affiliateId}`),
  });

  if (isLoading) {
    return <p className="text-[10px] text-muted-foreground px-4 pb-3">Loading answers...</p>;
  }

  if (!answers?.length) {
    return <p className="text-[10px] text-muted-foreground px-4 pb-3 italic">No onboarding answers submitted yet.</p>;
  }

  return (
    <div className="px-4 pb-3 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{name}'s Onboarding Answers</p>
      {answers.map(a => (
        <div key={a.id} className="bg-background border border-border/50 rounded p-2.5">
          <p className="text-[10px] font-semibold text-primary mb-1">{a.question}</p>
          <p className="text-xs text-foreground/80">{a.answer}</p>
        </div>
      ))}
    </div>
  );
}

function PendingApprovalPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: pending, isLoading } = useQuery<PendingAffiliate[]>({
    queryKey: ["pending-affiliates"],
    queryFn: () => apiFetch("/portal/pending-affiliates"),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/portal/approve-affiliate/${id}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-affiliates"] });
      qc.invalidateQueries({ queryKey: getListAffiliatesQueryKey() });
      toast({ title: "Affiliate approved", description: "They've been notified by email." });
    },
    onError: () => toast({ title: "Error", description: "Could not approve affiliate", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/portal/reject-affiliate/${id}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-affiliates"] });
      toast({ title: "Application rejected" });
    },
    onError: () => toast({ title: "Error", description: "Could not reject affiliate", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/affiliates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-affiliates"] });
      qc.invalidateQueries({ queryKey: getListAffiliatesQueryKey() });
      toast({ title: "Affiliate deleted" });
    },
    onError: () => toast({ title: "Error", description: "Could not delete affiliate", variant: "destructive" }),
  });

  if (isLoading || !pending?.length) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
        <Bell className="w-3.5 h-3.5 text-amber-400" />
        <p className="text-xs font-semibold text-amber-400">Pending Approval</p>
        <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">{pending.length}</span>
      </div>
      <div className="divide-y divide-amber-500/10">
        {pending.map(a => (
          <div key={a.id}>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{a.name}</p>
                <p className="text-[10px] text-muted-foreground">{a.email}</p>
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:block">{new Date(a.createdAt).toLocaleDateString()}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors font-medium"
                >
                  {expandedId === a.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Answers
                </button>
                <button
                  onClick={() => approveMutation.mutate(a.id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium disabled:opacity-50"
                >
                  <CheckCircle className="w-3 h-3" /> Approve
                </button>
                <button
                  onClick={() => { if (confirm(`Reject application from ${a.name}?`)) rejectMutation.mutate(a.id); }}
                  disabled={rejectMutation.isPending}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-destructive/5 text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors font-medium disabled:opacity-50"
                >
                  <XCircle className="w-3 h-3" /> Reject
                </button>
                <button
                  onClick={() => { if (confirm(`Permanently delete ${a.name}'s account?`)) deleteMutation.mutate(a.id); }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-destructive/5 text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors font-medium disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {expandedId === a.id && (
              <div className="border-t border-amber-500/10 bg-amber-500/5">
                <OnboardingAnswersPanel affiliateId={a.id} name={a.name} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Affiliates() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: affiliates, isLoading } = useListAffiliates({ search: search || undefined });
  const createAffiliate = useCreateAffiliate();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/affiliates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAffiliatesQueryKey() });
      toast({ title: "Affiliate deleted" });
    },
    onError: () => toast({ title: "Error", description: "Could not delete affiliate", variant: "destructive" }),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = (values: FormData) => {
    createAffiliate.mutate({ data: values }, {
      onSuccess: (newAffiliate) => {
        queryClient.invalidateQueries({ queryKey: getListAffiliatesQueryKey() });
        toast({ title: "Affiliate created", description: `Ref code: ${newAffiliate.refCode}` });
        setOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Could not create affiliate", variant: "destructive" });
      },
    });
  };

  const exportCSV = () => {
    if (!affiliates?.length) return;
    const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["ID", "Name", "Email", "Ref Code", "Status", "Signup Status", "Self Signup", "Joined"];
    const rows = affiliates.map(a => [
      a.id, a.name, a.email, a.refCode, a.status,
      a.signupStatus ?? "", a.isSelfSignup ? "Yes" : "No",
      new Date(a.createdAt).toLocaleDateString(),
    ].map(esc).join(","));
    const csv = [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `affiliates-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Affiliates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{affiliates?.length ?? 0} total in network</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-secondary border border-border rounded hover:bg-accent transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          <button
            data-testid="button-create-affiliate"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            New Affiliate
          </button>
        </div>
      </div>

      {/* Pending approval panel */}
      <PendingApprovalPanel />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          data-testid="input-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or ref code..."
          className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-2.5">Affiliate</th>
              <th className="text-left px-4 py-2.5">Ref Code</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</td></tr>
            )}
            {!isLoading && affiliates?.map(a => (
              <tr
                key={a.id}
                data-testid={`row-affiliate-${a.id}`}
                className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
              >
                <td className="px-4 py-2.5 cursor-pointer" onClick={() => setLocation(`/affiliates/${a.id}`)}>
                  <p className="font-medium text-xs">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.email}</p>
                </td>
                <td className="px-4 py-2.5 cursor-pointer" onClick={() => setLocation(`/affiliates/${a.id}`)}>
                  <span className="font-mono text-[10px] bg-secondary px-2 py-0.5 rounded">{a.refCode}</span>
                </td>
                <td className="px-4 py-2.5 cursor-pointer" onClick={() => setLocation(`/affiliates/${a.id}`)}>
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground cursor-pointer" onClick={() => setLocation(`/affiliates/${a.id}`)}>
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => { if (confirm(`Delete ${a.name}'s account permanently?`)) deleteMutation.mutate(a.id); }}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete affiliate"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !affiliates?.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No affiliates found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add New Affiliate</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">The affiliate will use the "Admin Invite" tab on the portal to set their password.</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Full Name</FormLabel>
                  <FormControl>
                    <Input data-testid="input-name" {...field} placeholder="Marco Diaz" className="text-xs h-8" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Email</FormLabel>
                  <FormControl>
                    <Input data-testid="input-email" {...field} placeholder="marco@example.com" className="text-xs h-8" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <Button
                data-testid="button-submit"
                type="submit"
                disabled={createAffiliate.isPending}
                className="w-full text-xs h-8"
              >
                {createAffiliate.isPending ? "Creating..." : "Create Affiliate"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
