import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { TrendingUp, ExternalLink, AlertCircle } from "lucide-react";

export default function ProductRedirect() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [, setLocation] = useLocation();

  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [productName, setProductName] = useState("");

  useEffect(() => {
    if (!slug) { setStatus("error"); setErrorMsg("No product specified."); return; }

    const search = new URLSearchParams(window.location.search);
    const ref = search.get("ref");

    // Fetch product info so we can redirect even without a ref
    fetch(`/api/products/by-slug/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(async (product) => {
        if (product.error) {
          setStatus("error");
          setErrorMsg("Product not found.");
          return;
        }

        setProductName(product.name ?? slug);

        const destination = product.landingPageUrl || product.websiteUrl;

        if (!destination) {
          setStatus("error");
          setErrorMsg("This product has no destination URL configured.");
          return;
        }

        // Fire tracking if a ref code is present
        if (ref) {
          try {
            await fetch("/api/track/product", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refCode: ref.toUpperCase(), productSlug: slug }),
            });
          } catch {
            // Tracking failure should not block the redirect
          }
        }

        setStatus("redirecting");

        // Small delay so the user sees the redirect screen briefly
        setTimeout(() => {
          window.location.href = destination;
        }, 600);
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Failed to load product. Please try again.");
      });
  }, [slug]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Link not found</h2>
            <p className="text-sm text-muted-foreground mt-2">{errorMsg}</p>
          </div>
          <button
            onClick={() => setLocation("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          {status === "redirecting"
            ? <ExternalLink className="w-7 h-7 text-primary" />
            : <TrendingUp className="w-7 h-7 text-primary animate-pulse" />
          }
        </div>
        <div>
          <h2 className="text-lg font-bold">
            {status === "redirecting" ? "Taking you there..." : "Loading..."}
          </h2>
          {productName && (
            <p className="text-sm text-muted-foreground mt-1">{productName}</p>
          )}
        </div>
        {status === "redirecting" && (
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
