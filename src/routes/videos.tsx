import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { listNews } from "@/lib/news.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ArchiveGrid, Pager } from "@/components/site/Archive";

const search = z.object({
  format: z.enum(["video", "interview", "documentary"]).optional(),
  page: z.number().int().min(1).optional(),
});
const q = (format: "video" | "interview" | "documentary" | undefined, page: number) =>
  queryOptions({ queryKey: ["videos", format, page], queryFn: () => listNews({ data: { format: format ?? "all-video", page } }) });

const TABS = [
  { v: undefined, l: "All videos" },
  { v: "video", l: "News videos" },
  { v: "interview", l: "Interviews" },
  { v: "documentary", l: "Documentaries" },
] as const;

export const Route = createFileRoute("/videos")({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ format: search.format, page: search.page ?? 1 }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(q(deps.format, deps.page)),
  head: () => ({
    meta: [
      { title: "Videos, Interviews & Documentaries | Serbia 15 Online News" },
      { name: "description", content: "Watch news videos, interviews and documentaries from Serbia 15 Online News — Tashar Al'ummah." },
      { property: "og:title", content: "Serbia 15 Videos" },
      { property: "og:description", content: "News videos, interviews and documentaries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  const s = Route.useSearch();
  const { data } = useSuspenseQuery(q(s.format, s.page ?? 1));
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="border-b-4 border-brand pb-2 font-display text-4xl font-black text-navy">Videos</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link key={t.l} to="." search={{ format: t.v }} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${s.format === t.v ? "border-navy bg-navy text-navy-foreground" : "hover:bg-muted"}`}>
              {t.l}
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <ArchiveGrid items={data.items} emptyTitle="No videos yet" emptyText="Videos, interviews and documentaries will appear here as soon as they are published." />
        </div>
        <Pager page={s.page ?? 1} total={data.total} pageSize={12} search={s} />
      </div>
    </SiteLayout>
  );
}
