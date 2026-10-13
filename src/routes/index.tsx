import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getHome, type NewsCard as Card } from "@/lib/news.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { EmptyState, NewsCard, SectionTitle, Meta } from "@/components/site/NewsCard";

const homeQuery = queryOptions({ queryKey: ["home"], queryFn: () => getHome(), staleTime: 30_000 });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Serbia 15 Online News — Tashar Al'ummah | Nigeria & World News" },
      { name: "description", content: "Breaking news, politics, business, security, education, sports, interviews, documentaries and live TV from Serbia 15 Online News — Tashar Al'ummah." },
      { property: "og:title", content: "Serbia 15 Online News — Tashar Al'ummah" },
      { property: "og:description", content: "Breaking news from Nigeria and around the world, videos, interviews and live TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
});

export function BreakingTicker({ items }: { items: { id: string; title: string; slug: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="border-b bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-hidden px-4 py-2 text-sm">
        <span className="shrink-0 rounded-sm bg-brand-foreground px-2 py-0.5 text-xs font-black uppercase tracking-wider text-brand">Breaking</span>
        <div className="flex gap-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          {items.map((b) => (
            <Link key={b.id} to="/news/$slug" params={{ slug: b.slug }} className="font-semibold hover:underline">{b.title}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryBlock({ slug, name, items }: { slug: string; name: string; items: Card[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <SectionTitle action={<Link to="/category/$slug" params={{ slug }} className="text-sm font-semibold text-brand hover:underline">More {name} →</Link>}>{name}</SectionTitle>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 4).map((a) => <NewsCard key={a.id} a={a} size="sm" />)}
      </div>
    </section>
  );
}

function Home() {
  const { data } = useSuspenseQuery(homeQuery);
  const lead = data.featured[0] ?? data.latest[0];
  const side = [...data.featured.slice(1), ...data.latest.filter((a) => a.id !== lead?.id)].slice(0, 4);
  const shown = new Set([lead?.id, ...side.map((s) => s.id)]);
  const latest = data.latest.filter((a) => !shown.has(a.id)).slice(0, 8);

  return (
    <SiteLayout ticker={<BreakingTicker items={data.breaking} />}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="sr-only">Serbia 15 Online News — latest headlines</h1>
        {!lead ? (
          <EmptyState title="No stories published yet" text="Our newsroom is preparing its first reports. Please check back soon, or follow us on Facebook for the latest updates." />
        ) : (
          <>
            <section className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7"><NewsCard a={lead} size="lg" /></div>
              <div className="grid content-start gap-6 sm:grid-cols-2 lg:col-span-5">
                {side.map((a) => <NewsCard key={a.id} a={a} size="sm" />)}
              </div>
            </section>

            <div className="mt-12 grid gap-10 lg:grid-cols-12">
              <section className="lg:col-span-8">
                <SectionTitle action={<Link to="/search" className="text-sm font-semibold text-brand hover:underline">All news →</Link>}>Latest</SectionTitle>
                {latest.length ? (
                  <div className="grid gap-6 sm:grid-cols-2">{latest.map((a) => <NewsCard key={a.id} a={a} />)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground">More stories will appear here as they are published.</p>
                )}
              </section>
              <aside className="lg:col-span-4">
                <SectionTitle>Trending</SectionTitle>
                {data.trending.length ? (
                  <ol className="space-y-4">
                    {data.trending.map((a, i) => (
                      <li key={a.id} className="flex gap-3 border-b pb-4 last:border-0">
                        <span className="font-display text-3xl font-black text-brand">{i + 1}</span>
                        <Link to="/news/$slug" params={{ slug: a.slug }} className="group">
                          <p className="font-display font-bold leading-snug group-hover:underline">{a.title}</p>
                          <Meta a={a} />
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No trending stories selected yet.</p>
                )}
                <Link to="/live" className="mt-8 block rounded-sm bg-navy p-5 text-navy-foreground">
                  <span className="text-xs font-black uppercase tracking-widest text-brand">● Live TV</span>
                  <p className="mt-1 font-display text-xl font-bold">Watch Serbia 15 Online News Live</p>
                  <p className="mt-1 text-sm opacity-80">See our live broadcast when we are on air.</p>
                </Link>
              </aside>
            </div>

            {data.videos.length > 0 && (
              <section className="mt-12 -mx-4 bg-navy-deep px-4 py-8 text-navy-foreground md:rounded-sm">
                <div className="mb-4 flex items-end justify-between border-b border-navy-foreground/20 pb-2">
                  <h2 className="font-display text-xl font-black uppercase">Videos, Interviews & Documentaries</h2>
                  <Link to="/videos" className="text-sm font-semibold text-brand hover:underline">All videos →</Link>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 [&_h3]:text-navy-foreground [&_p]:text-navy-foreground/70">
                  {data.videos.slice(0, 4).map((a) => <NewsCard key={a.id} a={a} size="sm" />)}
                </div>
              </section>
            )}

            {data.categories.map((c) => (
              <CategoryBlock key={c.slug} slug={c.slug} name={c.name} items={data.latest.filter((a) => a.category?.slug === c.slug)} />
            ))}
          </>
        )}
      </div>
    </SiteLayout>
  );
}
