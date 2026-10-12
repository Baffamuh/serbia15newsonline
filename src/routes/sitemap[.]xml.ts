import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { publicClient } = await import("@/lib/public-client.server");
        const sb = publicClient();
        const origin = new URL(request.url).origin;
        const [a, c] = await Promise.all([
          sb.from("articles").select("slug,updated_at").order("publish_at", { ascending: false }).limit(5000),
          sb.from("categories").select("slug"),
        ]);
        const urls = [
          `${origin}/`, `${origin}/videos`, `${origin}/live`, `${origin}/search`,
          ...(c.data ?? []).map((x) => `${origin}/category/${x.slug}`),
        ].map((u) => `<url><loc>${u}</loc></url>`);
        for (const x of a.data ?? []) {
          urls.push(`<url><loc>${origin}/news/${encodeURIComponent(x.slug)}</loc><lastmod>${new Date(x.updated_at).toISOString()}</lastmod></url>`);
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=600" } });
      },
    },
  },
});
