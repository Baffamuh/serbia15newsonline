import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ url: z.string().trim().url().max(500) });

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m = html.match(re);
  const v = m?.[1] ?? m?.[2];
  return v ? decode(v) : null;
}
function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export type ImportResult = {
  ok: boolean;
  source: "facebook" | "youtube" | "web";
  originalUrl: string;
  resolvedUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  savedImageUrl: string | null;
  videoUrl: string | null;
  isVideo: boolean;
  message: string;
};

/** Reads publicly shared preview data (Open Graph tags) for a link. Never invents content. */
export const importFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => schema.parse(d))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Only approved staff can import content.");

    const u = new URL(data.url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Invalid link.");
    const host = u.hostname.toLowerCase();
    const source: ImportResult["source"] = /facebook\.com|fb\.watch|fb\.com/.test(host)
      ? "facebook"
      : /youtube\.com|youtu\.be/.test(host)
        ? "youtube"
        : "web";

    const base: ImportResult = {
      ok: false, source, originalUrl: data.url, resolvedUrl: data.url, title: null, description: null,
      imageUrl: null, savedImageUrl: null, videoUrl: null, isVideo: false, message: "",
    };

    let html = "";
    try {
      const res = await fetch(data.url, {
        redirect: "follow",
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.8",
        },
      });
      base.resolvedUrl = res.url || data.url;
      if (!res.ok) {
        base.message = `The site answered with status ${res.status}. The post may be private, removed, or restricted. Use the embed or enter the story manually.`;
        return base;
      }
      html = (await res.text()).slice(0, 600_000);
    } catch {
      base.message = "Could not reach that link from our server. Use the embed option or enter the story manually.";
      return base;
    }

    const title = meta(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null;
    const description = meta(html, "og:description") ?? meta(html, "description");
    const image = meta(html, "og:image");
    const video = meta(html, "og:video:secure_url") ?? meta(html, "og:video:url") ?? meta(html, "og:video");
    const ogType = meta(html, "og:type") ?? "";

    const loginWall = source === "facebook" && (!title || /^(facebook|log in|log into facebook)/i.test(title.trim()));
    if (loginWall) {
      base.message =
        "Facebook did not share this post's details publicly (it requires login or the post isn't public). You can still publish it as a Facebook embed, or type the story manually.";
      return base;
    }

    base.title = title ? decode(title).trim() : null;
    base.description = description;
    base.imageUrl = image;
    base.videoUrl = video;
    base.isVideo = !!video || /video/i.test(ogType) || /\/videos?\/|\/reel\/|fb\.watch|\/watch|\/share\/v\//i.test(base.resolvedUrl);

    // Copy the preview image into our own storage (social CDN links expire).
    if (image && /^https:\/\//.test(image)) {
      try {
        const img = await fetch(image);
        const type = img.headers.get("content-type") ?? "";
        if (img.ok && /^image\/(jpeg|png|webp|gif)/.test(type)) {
          const buf = await img.arrayBuffer();
          if (buf.byteLength < 10 * 1024 * 1024) {
            const ext = (type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
            const path = `${context.userId}/import-${Date.now()}.${ext}`;
            const up = await context.supabase.storage.from("media").upload(path, buf, { contentType: type });
            if (!up.error) {
              const s = await context.supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
              base.savedImageUrl = s.data?.signedUrl ?? null;
            }
          }
        }
      } catch {
        /* keep original image link */
      }
    }

    base.ok = !!(base.title || base.description || base.imageUrl);
    base.message = base.ok
      ? "Public preview details were retrieved. Please review and edit everything before publishing."
      : "No public details were found at this link. Use the embed option or enter the story manually.";

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      user_email: (context.claims as { email?: string }).email ?? "",
      action: base.ok ? "import_success" : "import_failed",
      entity: "link",
      entity_id: null,
      details: data.url.slice(0, 300),
    });
    return base;
  });
