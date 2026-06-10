import { useState } from "react";
import { useListPayouts, useMarkPayoutPaid, useCreatePayout, useListAffiliates, getListPayoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, Plus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

const formSchema = z.object({
  affiliateId: z.string().min(1, "Select an affiliate"),
  amount: z.string().min(1, "Amount required").refine(v => !isNaN(Number(v)) && Number(v) > 0, "Must be positive"),
});

type FormData = z.infer<typeof formSchema>;

export default function Payouts() {
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: payouts, isLoading } = useListPayouts({ status: (statusFilter as "PENDING" | "PAID") || undefined });
  const { data: affiliates } = useListAffiliates();
  const markPaid = useMarkPayoutPaid();
  const createPayout = useCreatePayout();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { affiliateId: "", amount: "" },
  });

  const handleMarkPaid = (id: number) => {
    markPaid.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPayoutsQueryKey() });
        toast({ title: "Payout marked as paid" });
      },
    });
  };

  const onSubmit = (values: FormData) => {
    createPayout.mutate({ data: { affiliateId: Number(values.affiliateId), amount: Number(values.amount) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPayoutsQueryKey() });
        toast({ title: "Payout created" });
        setOpen(false);
        form.reset();
      },
    });
  };

  const exportCSV = () => {
    if (!payouts) return;
    const headers = "ID,Affiliate ID,Amount,Status,Created,Paid At";
    const rows = payouts.map(p =>
      `${p.id},${p.affiliateId},${p.amount},${p.status},${p.createdAt},${p.paidAt ?? ""}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payouts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Payouts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{payouts?.length ?? 0} records</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="select-status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-card border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
          </select>
          <button
            data-testid="button-export-csv"
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-secondary border border-border rounded hover:bg-accent transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          <button
            data-testid="button-create-payout"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            New Payout
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-2.5">ID</th>
              <th className="text-left px-4 py-2.5">Affiliate</th>
              <th className="text-right px-4 py-2.5">Amount</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Created</th>
              <th className="text-left px-4 py-2.5">Paid At</th>
              <th className="text-right px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</td></tr>
            )}
            {!isLoading && payouts?.map(p => (
              <tr key={p.id} data-testid={`row-payout-${p.id}`} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">#{p.id}</td>
                <td className="px-4 py-2.5 text-xs">
                  {affiliates?.find(a => a.id === p.affiliateId)?.name ?? `Affiliate #${p.affiliateId}`}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-primary">{fmtCurrency(p.amount)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                    p.status === "PAID" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  {p.status === "PENDING" && (
                    <button
                      data-testid={`button-mark-paid-${p.id}`}
                      onClick={() => handleMarkPaid(p.id)}
                      disabled={markPaid.isPending}
                      className="flex items-center gap-1 ml-auto text-[10px] px-2 py-1 bg-primary/10 text-primary border border-primary/30 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-2.5 h-2.5" />
                      Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && !payouts?.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No payouts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Create Payout</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="affiliateId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Affiliate</FormLabel>
                  <FormControl>
                    <select {...field} data-testid="select-affiliate"
                      className="w-full text-xs bg-background border border-border rounded px-3 py-2 h-8 focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Select affiliate...</option>
                      {affiliates?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Amount (USD)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-amount" {...field} placeholder="500" type="number" className="text-xs h-8" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <Button data-testid="button-submit" type="submit" disabled={createPayout.isPending} className="w-full text-xs h-8">
                {createPayout.isPending ? "Creating..." : "Create Payout"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
