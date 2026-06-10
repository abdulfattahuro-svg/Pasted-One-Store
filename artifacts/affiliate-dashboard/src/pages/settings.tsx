import { useGetConfig, useUpdateConfig, getGetConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Eye, EyeOff, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  commissionType: z.enum(["fixed", "percentage"]),
  commissionValue: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid number"),
  holdDays: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid number"),
});

type FormData = z.infer<typeof formSchema>;

export default function Settings() {
  const { data: config, isLoading } = useGetConfig();
  const updateConfig = useUpdateConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    values: config ? {
      commissionType: config.commissionType as "fixed" | "percentage",
      commissionValue: String(config.commissionValue),
      holdDays: String(config.holdDays),
    } : { commissionType: "fixed", commissionValue: "500", holdDays: "14" },
  });

  const onSubmit = (values: FormData) => {
    updateConfig.mutate({ data: {
      commissionType: values.commissionType,
      commissionValue: Number(values.commissionValue),
      holdDays: Number(values.holdDays),
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConfigQueryKey() });
        toast({ title: "Settings saved" });
      },
    });
  };

  const handleCopyApiKey = () => {
    if (config?.apiKey) {
      navigator.clipboard.writeText(config.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <div className="p-8 text-xs text-muted-foreground">Loading...</div>;

  const commissionType = form.watch("commissionType");

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Global affiliate network configuration</p>
      </div>

      {/* API Key */}
      <div className="bg-card border border-border rounded p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">API Key</h2>
        <p className="text-xs text-muted-foreground mb-3">Use this key in the <code className="bg-secondary px-1 rounded">X-API-KEY</code> header for all API requests.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-secondary border border-border rounded px-3 py-2 gap-2">
            <span className="font-mono text-xs flex-1" data-testid="text-api-key">
              {showApiKey ? config?.apiKey : "•".repeat(Math.min(config?.apiKey?.length ?? 32, 40))}
            </span>
          </div>
          <button
            data-testid="button-toggle-api-key"
            onClick={() => setShowApiKey(s => !s)}
            className="p-2 rounded border border-border hover:bg-accent transition-colors text-muted-foreground"
          >
            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            data-testid="button-copy-api-key"
            onClick={handleCopyApiKey}
            className="p-2 rounded border border-border hover:bg-accent transition-colors text-muted-foreground"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Commission config */}
      <div className="bg-card border border-border rounded p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Commission Configuration</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="commissionType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Commission Type</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    {(["fixed", "percentage"] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        data-testid={`button-commission-type-${type}`}
                        onClick={() => field.onChange(type)}
                        className={`flex-1 text-xs py-2 rounded border transition-colors capitalize ${
                          field.value === type
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {type === "fixed" ? "Fixed Amount" : "Percentage"}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="commissionValue" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  Commission Value {commissionType === "fixed" ? "(USD)" : "(%)"}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {commissionType === "fixed" ? "$" : "%"}
                    </span>
                    <Input
                      data-testid="input-commission-value"
                      {...field}
                      type="number"
                      className="pl-7 text-xs h-8"
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="holdDays" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Hold Period (Days)</FormLabel>
                <FormControl>
                  <Input data-testid="input-hold-days" {...field} type="number" className="text-xs h-8" />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <Button data-testid="button-save-settings" type="submit" disabled={updateConfig.isPending} className="text-xs h-8">
              {updateConfig.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </Form>
      </div>

      {/* API Docs */}
      <div className="bg-card border border-border rounded p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">API Endpoints</h2>
        <div className="space-y-2 font-mono text-[10px] text-muted-foreground">
          {[
            ["POST", "/api/events/click", "Track referral click"],
            ["POST", "/api/events/signup", "First-touch attribution"],
            ["POST", "/api/conversions", "Record payment conversion"],
            ["GET", "/api/stats/dashboard", "Dashboard summary"],
            ["POST", "/api/cron/release-holds", "Release expired holds"],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${method === "GET" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"}`}>{method}</span>
              <code className="text-foreground">{path}</code>
              <span className="text-muted-foreground">— {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
