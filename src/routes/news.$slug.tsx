import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, Facebook, MessageCircle } from "lucide-react";
import { getArticle } from "@/lib/news.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { EmbedPlayer } from "@/components/site/EmbedPlayer";
import { NewsCard, SectionTitle, thumbOf } from "@/components/site/NewsCard";
import { formatDate } from "@/lib/media";

const q = (slug: string) => queryOptions({ queryKey: ["article", slug], queryFn: () => getArticle({ data: { slug } }) });

export const Route = createFileRoute("/news/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(q(params.slug));
    if (!d) throw notFound();
    return { title: d.article.title, summary: d.article.summary, image: thumbOf(d.article) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Story unavailable | Serbia 15 Online News" }, { name: "robots", content: "noindex" }] };
    const img = loaderData.image && /^https:\/\//.test(loaderData.image) ? loaderData.image : null;
    return {
      meta: [
        { title: `${loaderData.title} | Serbia 15 Online News` },
        { name: "description", content: loaderData.summary.slice(0, 160) || loaderData.title },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.summary.slice(0, 200) || loaderData.title },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(q(slug));
  if (!data) return null;
  const a = data.article;
  const video = a.video_url ?? (a.format !== "article" ? a.facebook_url : null);
  const fbPostEmbed = !video && a.facebook_url ? a.facebook_url : null;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 py-8">
        {a.category && (
          <Link to="/category/$slug" params={{ slug: a.category.slug }} className="text-sm font-bold uppercase tracking-wider text-brand">{a.category.name}</Link>
        )}
        {a.is_breaking && <span className="ml-3 rounded-sm bg-brand px-2 py-0.5 text-xs font-black uppercase text-brand-foreground">Breaking</span>}
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-navy md:text-5xl">{a.title}</h1>
        {a.summary && <p className="mt-4 text-lg text-muted-foreground">{a.summary}</p>}
        <p className="mt-4 border-y py-3 text-sm text-muted-foreground">
          {a.author_name && <>By <strong className="text-foreground">{a.author_name}</strong> · </>}
          <time dateTime={a.publish_at}>{formatDate(a.publish_at)}</time>
        </p>
        <div className="mt-6">
          {video ? (
            <EmbedPlayer url={video} title={a.title} poster={a.cover_image_url} />
          ) : a.cover_image_url ? (
            <img src={a.cover_image_url} alt={a.title} className="w-full rounded-sm" />
          ) : null}
        </div>
        {a.body && (
          <div className="prose-news mt-8">
            {a.body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
        )}
        {fbPostEmbed && <div className="mt-8"><EmbedPlayer url={fbPostEmbed} title={a.title} /></div>}
        <div className="mt-8 flex flex-wrap gap-2 border-t pt-6">
          {(a.facebook_url || a.source_url) && (
            <a href={a.facebook_url ?? a.source_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-sm font-semibold hover:bg-muted">
              {a.facebook_url ? <Facebook className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />} View original
            </a>
          )}
          <a href={`https://wa.me/?text=${encodeURIComponent(a.title + " " + shareUrl)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground">
            <MessageCircle className="h-4 w-4" /> Share on WhatsApp
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm bg-navy px-3 py-2 text-sm font-semibold text-navy-foreground">
            <Facebook className="h-4 w-4" /> Share on Facebook
          </a>
        </div>
      </article>
      {data.related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4">
          <SectionTitle>Related stories</SectionTitle>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{data.related.map((r) => <NewsCard key={r.id} a={r} size="sm" />)}</div>
        </section>
      )}
    </SiteLayout>
  );
}
