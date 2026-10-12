import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];

/** Uploads a staff file to private storage and returns a long-lived signed URL. */
export async function uploadMedia(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error("Only JPG, PNG, WebP, GIF, MP4, WebM or MOV files are allowed.");
  if (file.size > 50 * 1024 * 1024) throw new Error("File is larger than 50 MB.");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const path = `${u.user.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (e2 || !data) throw new Error(e2?.message ?? "Could not create file link.");
  return data.signedUrl;
}

export type Embed =
  | { kind: "youtube"; src: string }
  | { kind: "facebook-video"; src: string }
  | { kind: "facebook-post"; src: string }
  | { kind: "file"; src: string }
  | { kind: "none" };

export function isFacebookUrl(url: string) {
  return /^https?:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.watch|fb\.com)\//i.test(url);
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function getEmbed(url?: string | null): Embed {
  if (!url) return { kind: "none" };
  const yt = youtubeId(url);
  if (yt) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}` };
  if (isFacebookUrl(url)) {
    const enc = encodeURIComponent(url);
    const isVideo = /\/videos?\/|\/watch|fb\.watch|\/reel\/|\/share\/v\/|\/share\/r\//i.test(url);
    return isVideo
      ? { kind: "facebook-video", src: `https://www.facebook.com/plugins/video.php?href=${enc}&show_text=false&width=734` }
      : { kind: "facebook-post", src: `https://www.facebook.com/plugins/post.php?href=${enc}&show_text=true&width=500` };
  }
  if (/^https:\/\//.test(url)) return { kind: "file", src: url };
  return { kind: "none" };
}

export function slugify(s: string) {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
