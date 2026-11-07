import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { resolveShortCode } from "@/lib/news.functions";

export const Route = createFileRoute("/n/$code")({
  loader: async ({ params }) => {
    const slug = await resolveShortCode({ data: { code: params.code } });
    if (!slug) throw notFound();
    throw redirect({ to: "/news/$slug", params: { slug }, statusCode: 301 });
  },
  head: () => ({ meta: [{ title: "Serbia 15 Online News" }, { name: "robots", content: "noindex" }] }),
});
