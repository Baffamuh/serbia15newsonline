import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicClient } from "./public-client.server";

export const CARD_FIELDS =
  "id,title,slug,summary,format,publish_at,cover_image_url,video_url,facebook_url,is_featured,is_breaking,is_trending,author_name,category:categories(slug,name)";

export type NewsCard = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  format: "article" | "video" | "interview" | "documentary";
  publish_at: string;
  cover_image_url: string | null;
  video_url: string | null;
  facebook_url: string | null;
  is_featured: boolean;
  is_breaking: boolean;
  is_trending: boolean;
  author_name: string;
  category: { slug: string; name: string } | null;
};

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(60).optional(),
  format: z.enum(["article", "video", "interview", "documentary", "all-video"]).optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(48).default(12),
});

export const listNews = createServerFn({ method: "GET" })
  .inputValidator((d: z.input<typeof listSchema>) => listSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    let catId: string | null = null;
    if (data.category) {
      const { data: c } = await sb.from("categories").select("id").eq("slug", data.category).maybeSingle();
      if (!c) return { items: [] as NewsCard[], total: 0 };
      catId = c.id;
    }
    let q = sb.from("articles").select(CARD_FIELDS, { count: "exact" }).order("publish_at", { ascending: false });
    if (catId) q = q.eq("category_id", catId);
    if (data.format === "all-video") q = q.in("format", ["video", "interview", "documentary"]);
    else if (data.format) q = q.eq("format", data.format);
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ");
      q = q.or(`title.ilike.%${term}%,summary.ilike.%${term}%,body.ilike.%${term}%`);
    }
    const from = (data.page - 1) * data.pageSize;
    const { data: rows, count, error } = await q.range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as unknown as NewsCard[], total: count ?? 0 };
  });

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [latest, breaking, featured, trending, videos, cats] = await Promise.all([
    sb.from("articles").select(CARD_FIELDS).order("publish_at", { ascending: false }).limit(60),
    sb.from("articles").select("id,title,slug").eq("is_breaking", true).order("publish_at", { ascending: false }).limit(6),
    sb.from("articles").select(CARD_FIELDS).eq("is_featured", true).order("publish_at", { ascending: false }).limit(5),
    sb.from("articles").select(CARD_FIELDS).eq("is_trending", true).order("publish_at", { ascending: false }).limit(6),
    sb.from("articles").select(CARD_FIELDS).in("format", ["video", "interview", "documentary"]).order("publish_at", { ascending: false }).limit(8),
    sb.from("categories").select("slug,name").order("sort"),
  ]);
  return {
    latest: (latest.data ?? []) as unknown as NewsCard[],
    breaking: breaking.data ?? [],
    featured: (featured.data ?? []) as unknown as NewsCard[],
    trending: (trending.data ?? []) as unknown as NewsCard[],
    videos: (videos.data ?? []) as unknown as NewsCard[],
    categories: cats.data ?? [],
  };
});

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: a } = await sb
      .from("articles")
      .select(`${CARD_FIELDS},body,source_url,updated_at,category_id,gallery_images`)
      .eq("slug", data.slug)
      .maybeSingle();
    if (!a) return null;
    const row = a as unknown as NewsCard & { body: string; source_url: string | null; updated_at: string; category_id: string | null; gallery_images: string[] };
    let related: NewsCard[] = [];
    if (row.category_id) {
      const { data: r } = await sb
        .from("articles").select(CARD_FIELDS).eq("category_id", row.category_id).neq("id", row.id)
        .order("publish_at", { ascending: false }).limit(4);
      related = (r ?? []) as unknown as NewsCard[];
    }
    return { article: row, related };
  });

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("categories").select("id,slug,name,sort").order("sort");
  return data ?? [];
});

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().rpc("get_public_settings").maybeSingle();
  return data;
});

