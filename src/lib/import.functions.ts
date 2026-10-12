import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ url: z.string().trim().url().max(1000) });

export type FbKind = "post" | "video" | "reel" | "page";
export type ImportStatus = "imported" | "embed_only" | "failed";

export type ImportResult = {
  status: ImportStatus;
  source: "facebook" | "youtube" | "web";
  fbKind: FbKind | null;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  description: string | null;
  author: string | null;
  postedOn: string | null;
  imageUrl: string | null;
  savedImageUrl: string | null;
  isVideo: boolean;
  method: string | null;
  message: string;
  steps: string[];
};

const FB_HOST = /(^|\.)(facebook\.com|fb\.watch|fb\.com|fb\.me)$/i;
const TRACKING = ["mibextid", "rdid", "share_url", "rdr", "__cft__[0]", "__tn__", "ref", "sfnsn", "s", "app"];

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
const strip = (s: string) => decode(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m = html.match(re);
  const v = m?.[1] ?? m?.[2];
  return v ? decode(v) : null;
}

function clean(u: URL): string {
  const out = new URL(u.toString());
  out.hostname = out.hostname.replace(/^(m|mobile|web|mbasic|touch)\./i, "www.");
  if (out.hostname === "facebook.com") out.hostname = "www.facebook.com";
  for (const k of TRACKING) out.searchParams.delete(k);
  out.hash = "";
  return out.toString();
}

function classify(u: URL): FbKind {
  const p = u.pathname.toLowerCase();
  if (/\/reels?\//.test(p) || /^\/share\/r\//.test(p)) return "reel";
  if (u.hostname.startsWith("fb.watch") || /\/videos?\//.test(p) || p.startsWith("/watch") || /^\/share\/v\//.test(p)) return "video";
  if (/\/posts\/|\/permalink|story\.php|\/photos?\/|photo\.php|\/share\/p\/|\/groups\/.+\/(posts|permalink)/.test(p)) return "post";
  if (p === "/profile.php" || /^\/p\/[^/]+\/?$/.test(p) || /^\/[^/]+\/?$/.test(p)) return "page";
  return "post";
}

/** Follows Facebook share/short links (without logging in) to the canonical URL. */
async function resolveFacebook(input: URL, steps: string[]): Promise<URL> {
  let cur = input;
  for (let i = 0; i < 4; i++) {
    const p = cur.pathname;
    const needsResolve = /^\/share\//.test(p) || cur.hostname.startsWith("fb.watch") || cur.hostname === "fb.me";
    if (!needsResolve) break;
    const res = await fetch(cur.toString(), {
      redirect: "manual",
      headers: { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
    });
    const loc = res.headers.get("location");
    if (!loc) {
      steps.push(`Share link did not redirect (status ${res.status}).`);
      break;
    }
    const next = new URL(loc, cur);
    if (/\/login/.test(next.pathname)) {
      const target = next.searchParams.get("next");
      steps.push("Facebook asked for login while opening the share link.");
      if (target) cur = new URL(target);
      break;
    }
    cur = next;
  }
  return new URL(clean(cur));
}

type OEmbed = { html?: string; author_name?: string; error?: { message?: string; code?: number } };

async function fetchOEmbed(kind: FbKind, url: string, steps: string[]) {
  const endpoint = kind === "page" ? "oembed_page" : kind === "post" ? "oembed_post" : "oembed_video";
  const qs = new URLSearchParams({ url, omitscript: "true" });
  const token =
    process.env["META_ACCESS_TOKEN"] ||
    (process.env["META_APP_ID"] && process.env["META_APP_SECRET"]
      ? `${process.env["META_APP_ID"]}|${process.env["META_APP_SECRET"]}`
      : "");
  if (token) qs.set("access_token", token);
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${endpoint}?${qs}`);
    const body = (await res.json()) as OEmbed;
    if (!res.ok || body.error || !body.html) {
      const msg = body.error?.message ?? `status ${res.status}`;
      console.error(`[fb-import] oEmbed ${endpoint} failed for ${url}: ${msg}`);
      steps.push(`Facebook embed service (${endpoint}) refused: ${msg}${token ? "" : " (no Meta token configured)"}.`);
      return null;
    }
    const html = body.html;
    const quote = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1] ?? "";
    const firstLink = quote.match(/^\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const paras = [...quote.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1] ?? "")).filter(Boolean);
    const posted = quote.match(/Posted by\s*<a[^>]*>([\s\S]*?)<\/a>\s*on\s*([^<]+)/i);
    steps.push(`Facebook embed service (${endpoint}) answered${token ? " using your Meta token" : ""}.`);
    return {
      title: firstLink ? strip(firstLink) : null,
      description: paras.join("\n\n") || null,
      author: posted?.[1] ? strip(posted[1]) : body.author_name ?? null,
      postedOn: posted?.[2] ? strip(posted[2]) : null,
    };
  } catch (e) {
    console.error("[fb-import] oEmbed network error", e);
    steps.push("Could not reach the Facebook embed service.");
    return null;
  }
}

async function fetchOpenGraph(url: string, steps: string[]) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.8",
      },
    });
    if (/\/login/.test(res.url)) {
      steps.push("Public page preview: Facebook redirected to its login page.");
      return null;
    }
    if (!res.ok) {
      steps.push(`Public page preview: status ${res.status}.`);
      return null;
    }
    const html = (await res.text()).slice(0, 600_000);
    const title = meta(html, "og:title");
    if (!title || /^(facebook|log in|log into facebook)/i.test(title.trim())) {
      steps.push("Public page preview: no public details.");
      return null;
    }
    steps.push("Public page preview details found.");
    return {
      title: title.trim(),
      description: meta(html, "og:description"),
      image: meta(html, "og:image"),
      video: meta(html, "og:video:secure_url") ?? meta(html, "og:video"),
      ogType: meta(html, "og:type") ?? "",
    };
  } catch {
    steps.push("Public page preview: link could not be reached.");
    return null;
  }
}

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };
async function saveImage(ctx: Ctx, image: string): Promise<string | null> {
  if (!/^https:\/\//.test(image)) return null;
  try {
    const img = await fetch(image);
    const type = img.headers.get("content-type") ?? "";
    if (!img.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) return null;
    const buf = await img.arrayBuffer();
    if (buf.byteLength > 10 * 1024 * 1024) return null;
    const ext = (type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${ctx.userId}/import-${Date.now()}.${ext}`;
    const up = await ctx.supabase.storage.from("media").upload(path, buf, { contentType: type });
    if (up.error) return null;
    const s = await ctx.supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return s.data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Tells staff whether optional Meta credentials are configured (never reveals values). */
export const getImportConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    metaTokenConfigured: !!(process.env["META_ACCESS_TOKEN"] || (process.env["META_APP_ID"] && process.env["META_APP_SECRET"])),
  }));

/** Imports public details via Facebook's official embed service and public previews. Never invents content. */
export const importFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => schema.parse(d))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Only approved staff can import content.");

    const input = new URL(data.url);
    if (!["http:", "https:"].includes(input.protocol)) throw new Error("Invalid link.");
    const steps: string[] = [];
    const isFb = FB_HOST.test(input.hostname);
    const source: ImportResult["source"] = isFb ? "facebook" : /youtube\.com|youtu\.be/i.test(input.hostname) ? "youtube" : "web";

    const r: ImportResult = {
      status: "failed", source, fbKind: null, originalUrl: data.url, normalizedUrl: data.url,
      title: null, description: null, author: null, postedOn: null, imageUrl: null, savedImageUrl: null,
      isVideo: false, method: null, message: "", steps,
    };

    if (isFb) {
      let canonical: URL;
      try {
        canonical = await resolveFacebook(input, steps);
      } catch {
        canonical = new URL(clean(input));
        steps.push("Could not open the share link; using it as pasted.");
      }
      r.normalizedUrl = canonical.toString();
      r.fbKind = classify(canonical);
      r.isVideo = r.fbKind === "video" || r.fbKind === "reel";

      const oe = await fetchOEmbed(r.fbKind, r.normalizedUrl, steps);
      const og = await fetchOpenGraph(r.normalizedUrl, steps);

      r.title = oe?.title ?? og?.title ?? null;
      r.description = oe?.description ?? og?.description ?? null;
      r.author = oe?.author ?? null;
      r.postedOn = oe?.postedOn ?? null;
      r.imageUrl = og?.image ?? null;
      if (og?.video) r.isVideo = true;

      if (r.title || r.description) {
        r.status = "imported";
        r.method = oe ? "Facebook official embed service" : "Facebook public preview";
        r.message = "Details imported from Facebook. Review and edit before publishing. The Facebook post will also be embedded.";
      } else if (oe) {
        r.status = "embed_only";
        r.method = "Facebook official embed service";
        r.message = "Facebook confirmed this link can be embedded, but it shares no text for it. The embed is attached — please write the headline and description yourself.";
      } else {
        r.status = "embed_only";
        r.message =
          "Facebook would not share this content with our server (it may be private, age-restricted, removed, or need a Meta token). The link is attached as an embed — it will display if the post is public. Please write the headline and description yourself.";
      }
    } else {
      const og = await fetchOpenGraph(data.url, steps);
      if (og) {
        r.status = "imported";
        r.method = "Public page preview";
        r.title = og.title; r.description = og.description; r.imageUrl = og.image;
        r.isVideo = !!og.video || /video/i.test(og.ogType) || source === "youtube";
        r.message = "Details imported. Review and edit before publishing.";
      } else if (source === "youtube") {
        r.status = "embed_only"; r.isVideo = true;
        r.message = "YouTube video attached as an embed. Please write the headline yourself.";
      } else {
        r.message = "No public details were found at this link. Enter the story manually.";
      }
    }

    if (r.imageUrl) r.savedImageUrl = await saveImage(context as unknown as Ctx, r.imageUrl);

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      user_email: (context.claims as { email?: string }).email ?? "",
      action: `import_${r.status}`,
      entity: "link",
      entity_id: null,
      details: r.normalizedUrl.slice(0, 300),
    });
    return r;
  });
