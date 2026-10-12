import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getCategories, listNews } from "@/lib/news.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ArchiveGrid, FORMATS, Pager } from "@/components/site/Archive";

const search = z.object({
  page: z.number().int().min(1).optional(),
  format: z.enum(["article", "video", "interview", "documentary"]).optional(),
});
const catsQuery = queryOptions({ queryKey: ["categories"], queryFn: () => getCategories(), staleTime: 300_000 });
const listQuery = (slug: string, page: number, format?: "article" | "video" | "interview" | "documentary") =>
  queryOptions({ queryKey: ["cat", slug, page, format], queryFn: () => listNews({ data: { category: slug, page, format } }) });

export const Route = createFileRoute("/category/$slug")({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1, format: search.format }),
  loader: async ({ context, params, deps }) => {
    const cats = await context.queryClient.ensureQueryData(catsQuery);
    const cat = cats.find((c) => c.slug === params.slug);
    if (!cat) throw notFound();
    await context.queryClient.ensureQueryData(listQuery(params.slug, deps.page, deps.format));
    return { name: cat.name };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Section";
    return {
      meta: [
        { title: `${name} News | Serbia 15 Online News` },
        { name: "description", content: `Latest ${name} news, analysis and videos from Serbia 15 Online News — Tashar Al'ummah.` },
        { property: "og:title", content: `${name} News — Serbia 15` },
        { property: "og:description", content: `Latest ${name} stories from Serbia 15 Online News.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const s = Route.useSearch();
  const { name } = Route.useLoaderData();
  const page = s.page ?? 1;
  const { data } = useSuspenseQuery(listQuery(slug, page, s.format));
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="border-b-4 border-brand pb-2 font-display text-4xl font-black text-navy">{name}</h1>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by format">
          {FORMATS.map((f) => (
            <Link
              key={f.value}
              to="."
              search={{ format: f.value || undefined }}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${(s.format ?? "") === f.value ? "border-navy bg-navy text-navy-foreground" : "hover:bg-muted"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <ArchiveGrid items={data.items} emptyTitle={`No ${name} stories yet`} emptyText="Stories in this section will appear here once our newsroom publishes them." />
        </div>
        <Pager page={page} total={data.total} pageSize={12} search={s} />
      </div>
    </SiteLayout>
  );
}
