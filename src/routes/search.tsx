import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { getCategories, listNews } from "@/lib/news.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ArchiveGrid, FORMATS, Pager } from "@/components/site/Archive";

const fmt = z.enum(["article", "video", "interview", "documentary"]);
const search = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(60).optional(),
  format: fmt.optional(),
  page: z.number().int().min(1).optional(),
});
type S = z.infer<typeof search>;
const q = (s: S) =>
  queryOptions({
    queryKey: ["search", s],
    queryFn: () => listNews({ data: { q: s.q, category: s.category, format: s.format, page: s.page ?? 1 } }),
  });
const catsQuery = queryOptions({ queryKey: ["categories"], queryFn: () => getCategories(), staleTime: 300_000 });

export const Route = createFileRoute("/search")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([context.queryClient.ensureQueryData(q(deps)), context.queryClient.ensureQueryData(catsQuery)]);
  },
  head: () => ({
    meta: [
      { title: "Search & News Archive | Serbia 15 Online News" },
      { name: "description", content: "Search the Serbia 15 Online News archive of articles, videos, interviews and documentaries." },
      { property: "og:title", content: "News Archive — Serbia 15 Online News" },
      { property: "og:description", content: "Search every story and video published by Serbia 15 Online News." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [text, setText] = useState(s.q ?? "");
  const { data } = useSuspenseQuery(q(s));
  const { data: cats } = useSuspenseQuery(catsQuery);
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-4xl font-black text-navy">News archive</h1>
        <form
          className="mt-4 flex max-w-2xl"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { ...s, q: text.trim() || undefined, page: undefined } });
          }}
        >
          <label htmlFor="archive-q" className="sr-only">Search</label>
          <input id="archive-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="Search headlines and stories…" className="w-full rounded-l-sm border border-input px-4 py-3" />
          <button className="rounded-r-sm bg-brand px-5 font-semibold text-brand-foreground">Search</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            aria-label="Category"
            value={s.category ?? ""}
            onChange={(e) => navigate({ search: { ...s, category: e.target.value || undefined, page: undefined } })}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All sections</option>
            {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Format">
            {FORMATS.map((f) => (
              <Link key={f.value} to="." search={{ ...s, format: (f.value || undefined) as S["format"], page: undefined }}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${(s.format ?? "") === f.value ? "border-navy bg-navy text-navy-foreground" : "hover:bg-muted"}`}>
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{data.total} result{data.total === 1 ? "" : "s"}{s.q ? ` for “${s.q}”` : ""}</p>
        <div className="mt-4">
          <ArchiveGrid items={data.items} emptyTitle="Nothing found" emptyText="Try different words or remove a filter." />
        </div>
        <Pager page={s.page ?? 1} total={data.total} pageSize={12} search={s} />
      </div>
    </SiteLayout>
  );
}
