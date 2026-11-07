import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Facebook } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { listShortLinks } from "@/lib/news.functions";
import { formatDate } from "@/lib/media";

const q = queryOptions({ queryKey: ["short-links"], queryFn: () => listShortLinks(), staleTime: 60_000 });

export const Route = createFileRoute("/n/")({
  head: () => ({
    meta: [
      { title: "Short news links · Gajerun hanyoyi | Serbia 15 Online News" },
      { name: "description", content: "Every Serbia 15 Online News story with a short link ready to share on WhatsApp and Facebook." },
      { property: "og:title", content: "Short news links | Serbia 15 Online News" },
      { property: "og:description", content: "Share Serbia 15 Online News stories instantly with short links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ShortLinksPage,
});

function ShortLinksPage() {
  const { data } = useSuspenseQuery(q);
  const [filter, setFilter] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const rows = data.filter((r) => r.short_code && r.title.toLowerCase().includes(filter.toLowerCase()));
  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="border-l-4 border-brand pl-3 font-display text-3xl font-black text-navy">Gajerun hanyoyi · Short links</h1>
        <p className="mt-2 text-sm text-muted-foreground">Copy or share any story in one tap.</p>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Bincika · Filter stories…" aria-label="Filter stories" className="mt-4 w-full rounded-sm border bg-background px-3 py-2 text-sm" />
        <ul className="mt-4 divide-y rounded-sm border bg-card">
          {rows.map((r) => {
            const url = `${origin}/n/${r.short_code}`;
            return (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {r.category && <span className="font-bold uppercase text-brand">{r.category.name}</span>}
                  <span className="text-muted-foreground">{formatDate(r.publish_at)}</span>
                </div>
                <Link to="/news/$slug" params={{ slug: r.slug }} className="mt-1 block font-display text-lg font-bold leading-snug text-navy hover:underline">{r.title}</Link>
                {r.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded-sm bg-muted px-2 py-1 text-xs">{url.replace(/^https?:\/\//, "")}</code>
                  <button onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))} className="inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-semibold hover:bg-muted"><Copy className="h-3.5 w-3.5" /> Copy</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(r.title + " " + url)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm bg-brand px-2 py-1 text-xs font-semibold text-brand-foreground"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm bg-navy px-2 py-1 text-xs font-semibold text-navy-foreground"><Facebook className="h-3.5 w-3.5" /> Facebook</a>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No stories found.</li>}
        </ul>
      </div>
    </SiteLayout>
  );
}
