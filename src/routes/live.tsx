import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Facebook, Radio } from "lucide-react";
import { SiteLayout, settingsQuery } from "@/components/site/SiteLayout";
import { EmbedPlayer } from "@/components/site/EmbedPlayer";

export const Route = createFileRoute("/live")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  head: () => ({
    meta: [
      { title: "Live TV | Serbia 15 Online News" },
      { name: "description", content: "Watch Serbia 15 Online News — Tashar Al'ummah live broadcasts." },
      { property: "og:title", content: "Serbia 15 Live TV" },
      { property: "og:description", content: "Live broadcasts from Serbia 15 Online News." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { data: s } = useSuspenseQuery(settingsQuery);
  const url = s?.live_stream_url;
  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="flex items-center gap-3 font-display text-4xl font-black text-navy">
          <Radio className="h-8 w-8 text-brand" /> Live TV
        </h1>
        {url ? (
          <section className="mt-6">
            <p className="mb-3 inline-flex items-center gap-2 rounded-sm bg-brand px-2 py-1 text-xs font-black uppercase text-brand-foreground">● Live</p>
            <h2 className="mb-4 font-display text-2xl font-bold">{s?.live_title}</h2>
            <EmbedPlayer url={url} title={s?.live_title ?? "Live stream"} />
          </section>
        ) : (
          <div className="mt-6 rounded-sm bg-navy-deep p-10 text-center text-navy-foreground">
            <Radio className="mx-auto h-12 w-12 opacity-60" />
            <p className="mt-4 font-display text-2xl font-bold">We are not broadcasting right now</p>
            <p className="mx-auto mt-2 max-w-md opacity-80">No live stream is currently available. When Serbia 15 goes live, the broadcast will appear here.</p>
            {s?.facebook_page_url && (
              <a href={s.facebook_page_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 font-semibold text-brand-foreground">
                <Facebook className="h-4 w-4" /> Follow us on Facebook
              </a>
            )}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
