import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { FB_HOST, classify, clean, fetchOEmbed, fetchOpenGraph, resolveFacebook, saveImage, type Ctx } from "./fb-import.server";

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
