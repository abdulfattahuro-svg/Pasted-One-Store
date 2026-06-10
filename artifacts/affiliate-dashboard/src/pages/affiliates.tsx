import { useState } from "react";
import { useLocation } from "wouter";
import { useListAffiliates, useCreateAffiliate, getListAffiliatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, UserCheck, UserX } from "lucide-react";
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

export default function Affiliates() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: affiliates, isLoading } = useListAffiliates({ search: search || undefined });
  const createAffiliate = useCreateAffiliate();

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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Affiliates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{affiliates?.length ?? 0} total in network</p>
        </div>
        <button
          data-testid="button-create-affiliate"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3 h-3" />
          New Affiliate
        </button>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</td></tr>
            )}
            {!isLoading && affiliates?.map(a => (
              <tr
                key={a.id}
                data-testid={`row-affiliate-${a.id}`}
                className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
                onClick={() => setLocation(`/affiliates/${a.id}`)}
              >
                <td className="px-4 py-2.5">
                  <p className="font-medium text-xs">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[10px] bg-secondary px-2 py-0.5 rounded">{a.refCode}</span>
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!isLoading && !affiliates?.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">No affiliates found</td></tr>
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
