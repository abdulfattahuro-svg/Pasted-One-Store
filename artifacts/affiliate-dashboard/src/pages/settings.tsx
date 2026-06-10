import { useGetConfig, useUpdateConfig, getGetConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Eye, EyeOff, Copy, CheckCircle, Mail, Server, Globe, Shield, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "MXN", label: "MXN — Mexican Peso" },
  { code: "NGN", label: "NGN — Nigerian Naira" },
];

const formSchema = z.object({
  commissionType: z.enum(["fixed", "percentage"]),
  commissionValue: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid number"),
  holdDays: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid number"),
  currency: z.string().min(1),
  approvalMode: z.enum(["auto", "manual"]),
  programName: z.string().optional(),
  programTagline: z.string().optional(),
  commissionHighlight: z.string().optional(),
  programDetails: z.string().optional(),
  emailProvider: z.enum(["console", "smtp", "resend"]),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  resendApiKey: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Settings() {
  const { data: config, isLoading } = useGetConfig();
  const updateConfig = useUpdateConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    values: config ? {
      commissionType: config.commissionType as "fixed" | "percentage",
      commissionValue: String(config.commissionValue),
      holdDays: String(config.holdDays),
      currency: config.currency ?? "USD",
      approvalMode: (config as { approvalMode?: string }).approvalMode as "auto" | "manual" ?? "auto",
      programName: (config as { programName?: string }).programName ?? "",
      programTagline: (config as { programTagline?: string }).programTagline ?? "",
      commissionHighlight: (config as { commissionHighlight?: string }).commissionHighlight ?? "",
      programDetails: (config as { programDetails?: string }).programDetails ?? "",
      emailProvider: (config as { emailProvider?: string }).emailProvider as "console" | "smtp" | "resend" ?? "console",
      smtpHost: (config as { smtpHost?: string }).smtpHost ?? "",
      smtpPort: String((config as { smtpPort?: number }).smtpPort ?? 587),
      smtpUser: (config as { smtpUser?: string }).smtpUser ?? "",
      smtpPass: "",
      smtpFrom: (config as { smtpFrom?: string }).smtpFrom ?? "",
      resendApiKey: "",
    } : {
      commissionType: "fixed", commissionValue: "500", holdDays: "14", currency: "USD",
      approvalMode: "auto", programName: "", programTagline: "", commissionHighlight: "", programDetails: "",
      emailProvider: "console", smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", smtpFrom: "", resendApiKey: "",
    },
  });

  const emailProvider = form.watch("emailProvider");

  const onSubmit = (values: FormData) => {
    const payload: Record<string, unknown> = {
      commissionType: values.commissionType,
      commissionValue: Number(values.commissionValue),
      holdDays: Number(values.holdDays),
      currency: values.currency,
      approvalMode: values.approvalMode,
      programName: values.programName,
      programTagline: values.programTagline,
      commissionHighlight: values.commissionHighlight,
      programDetails: values.programDetails,
      emailProvider: values.emailProvider,
    };
    if (values.emailProvider === "smtp") {
      payload.smtpHost = values.smtpHost;
      payload.smtpPort = Number(values.smtpPort) || 587;
      payload.smtpUser = values.smtpUser;
      payload.smtpFrom = values.smtpFrom;
      if (values.smtpPass) payload.smtpPass = values.smtpPass;
    }
    if (values.emailProvider === "resend") {
      if (values.resendApiKey) payload.resendApiKey = values.resendApiKey;
      payload.smtpFrom = values.smtpFrom;
    }

    updateConfig.mutate({ data: payload as Parameters<typeof updateConfig.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConfigQueryKey() });
        toast({ title: "Settings saved" });
      },
      onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> API Key</h2>
        <p className="text-xs text-muted-foreground mb-3">Use this key in the <code className="bg-secondary px-1 rounded">X-API-KEY</code> header for all API requests.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-secondary border border-border rounded px-3 py-2 gap-2">
            <span className="font-mono text-xs flex-1" data-testid="text-api-key">
              {showApiKey ? config?.apiKey : "•".repeat(Math.min(config?.apiKey?.length ?? 32, 40))}
            </span>
          </div>
          <button data-testid="button-toggle-api-key" onClick={() => setShowApiKey(s => !s)} className="p-2 rounded border border-border hover:bg-accent transition-colors text-muted-foreground">
            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button data-testid="button-copy-api-key" onClick={handleCopyApiKey} className="p-2 rounded border border-border hover:bg-accent transition-colors text-muted-foreground">
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Program Info */}
          <div className="bg-card border border-border rounded p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Program Info</h2>
            <p className="text-xs text-muted-foreground -mt-2">Shown in the affiliate portal and onboarding.</p>

            <FormField control={form.control} name="programName" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Program Name</FormLabel>
                <FormControl><Input {...field} placeholder="OneStore Affiliate Program" className="text-xs h-8" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="programTagline" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Tagline</FormLabel>
                <FormControl><Input {...field} placeholder="Earn real money sharing apps you believe in." className="text-xs h-8" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="commissionHighlight" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Commission Highlight</FormLabel>
                <FormControl><Input {...field} placeholder="Earn up to $500 per referral" className="text-xs h-8" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="programDetails" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Program Details (shown in welcome modal)</FormLabel>
                <FormControl>
                  <textarea {...field} rows={3} placeholder="Describe your affiliate program..." className="w-full bg-background border border-input rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                </FormControl>
              </FormItem>
            )} />
          </div>

          {/* Commission & Approval */}
          <div className="bg-card border border-border rounded p-5 space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Commission & Approval</h2>

            <FormField control={form.control} name="approvalMode" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Affiliate Approval Mode</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    {(["auto", "manual"] as const).map(mode => (
                      <button key={mode} type="button" onClick={() => field.onChange(mode)}
                        className={`flex-1 text-xs py-2 rounded border transition-colors ${field.value === mode ? "bg-primary/10 border-primary text-primary font-semibold" : "border-border text-muted-foreground hover:bg-accent"}`}>
                        {mode === "auto" ? "Auto-approve" : "Manual review"}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <p className="text-[10px] text-muted-foreground">{field.value === "auto" ? "New signups are activated immediately after email verification." : "New signups require admin approval before they can access the portal."}</p>
              </FormItem>
            )} />

            <FormField control={form.control} name="commissionType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Commission Type</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    {(["fixed", "percentage"] as const).map(type => (
                      <button key={type} type="button" data-testid={`button-commission-type-${type}`} onClick={() => field.onChange(type)}
                        className={`flex-1 text-xs py-2 rounded border transition-colors capitalize ${field.value === type ? "bg-primary/10 border-primary text-primary font-semibold" : "border-border text-muted-foreground hover:bg-accent"}`}>
                        {type === "fixed" ? "Fixed Amount" : "Percentage"}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="commissionValue" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Commission Value {commissionType === "fixed" ? "(amount)" : "(%)"}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{commissionType === "fixed" ? "$" : "%"}</span>
                    <Input data-testid="input-commission-value" {...field} type="number" className="pl-7 text-xs h-8" />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="holdDays" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Hold Period (Days)</FormLabel>
                <FormControl><Input data-testid="input-hold-days" {...field} type="number" className="text-xs h-8" /></FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Display Currency</FormLabel>
                <FormControl>
                  <select data-testid="select-currency" {...field} className="w-full bg-background border border-input rounded px-3 py-1.5 text-xs h-8 focus:outline-none focus:ring-1 focus:ring-ring">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* Email Configuration */}
          <div className="bg-card border border-border rounded p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Configuration</h2>

            <FormField control={form.control} name="emailProvider" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Email Provider</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    {(["console", "smtp", "resend"] as const).map(p => (
                      <button key={p} type="button" onClick={() => field.onChange(p)}
                        className={`flex-1 text-xs py-2 rounded border transition-colors capitalize ${field.value === p ? "bg-primary/10 border-primary text-primary font-semibold" : "border-border text-muted-foreground hover:bg-accent"}`}>
                        {p === "console" ? "Dev (None)" : p === "smtp" ? "SMTP" : "Resend"}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )} />

            {emailProvider === "console" && (
              <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded p-3">
                <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300/80 space-y-1">
                  <p className="font-medium text-amber-400">No email server configured</p>
                  <p>Emails are logged to the console only. Affiliate signups are <strong>auto-verified</strong> so the system still works. Configure SMTP or Resend to send real emails.</p>
                </div>
              </div>
            )}

            {emailProvider === "smtp" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="smtpHost" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">SMTP Host</FormLabel>
                      <FormControl><Input {...field} placeholder="smtp.gmail.com" className="text-xs h-8" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="smtpPort" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Port</FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="587" className="text-xs h-8" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="smtpUser" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">SMTP Username</FormLabel>
                    <FormControl><Input {...field} placeholder="you@example.com" className="text-xs h-8" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="smtpPass" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">SMTP Password (leave blank to keep existing)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type={showSmtpPass ? "text" : "password"} placeholder="••••••••" className="text-xs h-8 pr-9" />
                        <button type="button" onClick={() => setShowSmtpPass(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showSmtpPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="smtpFrom" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">From Address</FormLabel>
                    <FormControl><Input {...field} placeholder="Affiliate Program <noreply@example.com>" className="text-xs h-8" /></FormControl>
                  </FormItem>
                )} />
              </div>
            )}

            {emailProvider === "resend" && (
              <div className="space-y-3">
                <FormField control={form.control} name="resendApiKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Resend API Key (leave blank to keep existing)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type={showResendKey ? "text" : "password"} placeholder="re_••••••••" className="text-xs h-8 pr-9" />
                        <button type="button" onClick={() => setShowResendKey(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showResendKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="smtpFrom" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">From Address</FormLabel>
                    <FormControl><Input {...field} placeholder="Affiliate Program <noreply@yourdomain.com>" className="text-xs h-8" /></FormControl>
                  </FormItem>
                )} />
                <p className="text-[10px] text-muted-foreground">Get your API key at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-primary underline">resend.com</a>. Free tier includes 3,000 emails/month.</p>
              </div>
            )}
          </div>

          <Button data-testid="button-save-settings" type="submit" disabled={updateConfig.isPending} className="text-xs h-8">
            {updateConfig.isPending ? "Saving..." : "Save All Settings"}
          </Button>
        </form>
      </Form>

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
