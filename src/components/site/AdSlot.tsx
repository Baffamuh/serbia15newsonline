import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/news.functions";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export type AdSlotName = "leaderboard" | "in-article" | "sidebar";

const PLACEHOLDER_H: Record<AdSlotName, string> = {
  leaderboard: "h-[100px] md:h-[120px]",
  "in-article": "h-[280px]",
  sidebar: "h-[420px]",
};

/**
 * Google AdSense unit. When the administrator has saved an AdSense publisher ID
 * in Dashboard → Site settings, a real ad unit renders here; otherwise a clean,
 * clearly labelled "Talla · Advertisement" placeholder keeps the layout stable.
 */
export function AdSlot({ slot, className }: { slot: AdSlotName; className?: string }) {
  const { data: s } = useQuery({ queryKey: ["settings"], queryFn: () => getSettings(), staleTime: 60_000 });
  const clientId = s?.adsense_client_id?.trim() ?? "";
  const slotId =
    (slot === "leaderboard" ? s?.adsense_slot_top : slot === "in-article" ? s?.adsense_slot_article : s?.adsense_slot_sidebar)?.trim() ?? "";

  useEffect(() => {
    if (!clientId || typeof window === "undefined") return;
    if (!document.querySelector("script[data-adsense]")) {
      const el = document.createElement("script");
      el.async = true;
      el.crossOrigin = "anonymous";
      el.dataset.adsense = "1";
      el.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      document.head.appendChild(el);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // The AdSense script has not loaded yet; the unit initialises when it does.
    }
  }, [clientId, slotId]);

  return (
    <aside aria-label="Talla — advertisement" className={cn("w-full", className)}>
      {clientId ? (
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={clientId}
          data-ad-slot={slotId || undefined}
          data-ad-format={slot === "sidebar" ? "vertical" : "auto"}
          data-full-width-responsive="true"
        />
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-sm border border-dashed bg-muted/40 text-center",
            PLACEHOLDER_H[slot],
          )}
        >
          <span className="font-display text-sm font-black uppercase tracking-widest text-muted-foreground/70">Talla</span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">Advertisement space</span>
        </div>
      )}
      <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Talla · Advertisement</p>
    </aside>
  );
}
