import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AI_TASKS = {
  headlines: "Improve headline",
  rewrite: "Rewrite / polish article",
  summary: "Write summary",
  intro: "Write introduction",
  seo: "SEO metadata",
  social: "Social captions",
  alert: "Breaking-news alert",
  tags: "Keywords, category & tags",
  to_hausa: "Translate to Hausa",
  to_english: "Translate to English",
  transcript: "Transcript / notes → article",
} as const;
export type AiTask = keyof typeof AI_TASKS;

const RULES = `You are a senior news editor at Serbia 15 Online News — Tashar Al'ummah, a Nigerian news outlet.
Strict rules: Never invent facts, names, numbers, quotes, dates or places that are not in the supplied text. If information is missing, leave it out or write [needs confirmation]. Keep a neutral, factual, BBC-style tone. Output plain text only (no markdown headings, no asterisks).`;

const PROMPTS: Record<AiTask, string> = {
  headlines: "Give 5 alternative headlines (max 90 characters each), one per line, numbered. Accurate, clear, not clickbait.",
  rewrite: "Rewrite the article for clarity, grammar and flow in the same language. Keep every fact and quote unchanged. Paragraphs separated by a blank line.",
  summary: "Write a 1–2 sentence summary (max 300 characters) in the same language.",
  intro: "Write a strong opening paragraph (lede) answering who, what, when, where from the supplied facts only.",
  seo: "Produce: SEO title (max 60 chars), meta description (max 155 chars), URL slug. Label each line.",
  social: "Write: a Facebook caption (2–3 sentences + 3 hashtags), an X/Twitter post (max 260 chars), and a WhatsApp broadcast line. Label each.",
  alert: "Write one urgent breaking-news alert line (max 140 characters), starting with 'BREAKING:'.",
  tags: "Suggest: the best section from [Nigeria, International, Politics, Business, Education, Security, Entertainment, Sports], 5–8 keywords, and 5 tags. Label each line.",
  to_hausa: "Translate the text into Hausa (standard Kano Hausa used in Nigerian news). Keep names, numbers and quotes accurate. Output only the translation.",
  to_english: "Translate the text into English. Keep names, numbers and quotes accurate. Output only the translation.",
  transcript: "Convert the supplied interview transcript or reporter notes into a news article: headline on the first line, then a blank line, then paragraphs. Use only facts and quotes present in the input; quote speakers verbatim. Add [needs confirmation] where something is unclear.",
};

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_staff", { _user_id: ctx.userId });
  if (error || !data) throw new Error("Only newsroom staff can use AI tools.");
}

export const runNewsroomAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    task: z.enum(Object.keys(AI_TASKS) as [AiTask, ...AiTask[]]),
    title: z.string().max(300).default(""),
    text: z.string().max(60_000).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const input = `HEADLINE: ${data.title || "(none)"}\n\nTEXT:\n${data.text || "(none)"}`;
    if (!data.title.trim() && !data.text.trim()) return { ok: false as const, error: "Add a headline or some text first." };
    const { aiText, AiError } = await import("./ai.server");
    try {
      const out = await aiText(`${RULES}\n\nTask: ${PROMPTS[data.task]}`, input);
      await context.supabase.from("activity_log").insert({ user_id: context.userId, action: "ai", entity: "article", details: data.task });
      return { ok: true as const, text: out };
    } catch (e) {
      console.error("AI error", e);
      return { ok: false as const, error: e instanceof AiError ? e.message : "AI request failed. Please try again." };
    }
  });

export const generateThumbnailArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    prompt: z.string().trim().min(3).max(800),
    image: z.string().max(12_000_000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { aiImage, AiError } = await import("./ai.server");
    const p = data.image
      ? `Enhance this news photo for a news thumbnail: ${data.prompt}. Keep the real people, places and events unchanged and realistic — do not add fake people, text or logos. Leave the lower third clean for a headline.`
      : `Editorial news illustration background (no text, no logos, no real identifiable people): ${data.prompt}. Leave the lower third clean for a headline. Photorealistic, neutral lighting.`;
    try {
      const b64 = await aiImage(p, data.image);
      return { ok: true as const, image: `data:image/png;base64,${b64}` };
    } catch (e) {
      console.error("AI image error", e);
      return { ok: false as const, error: e instanceof AiError ? e.message : "Image generation failed." };
    }
  });
