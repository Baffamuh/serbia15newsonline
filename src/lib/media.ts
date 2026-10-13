import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024; // matches storage bucket limit
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;

export type UploadProgress = { loaded: number; total: number; retrying?: boolean };
export type UploadOptions = { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal };

/** Uploads a staff file to private storage and returns a long-lived signed URL.
 * Files over 6 MB use resumable chunked uploads (6 MB chunks, automatic retries,
 * resume after page reload/network loss via stored fingerprints). */
export async function uploadMedia(file: File | Blob, opts: UploadOptions = {}, name = "file"): Promise<string> {
  const type = file.type;
  const fname = file instanceof File ? file.name : name;
  if (!ALLOWED.includes(type)) throw new Error("Only JPG, PNG, WebP, GIF, MP4, WebM or MOV files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 5 GB.");
  const { data: s } = await supabase.auth.getSession();
  const session = s.session;
  if (!session) throw new Error("Please sign in again.");
  const safe = fname.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const stamp = file instanceof File && file.size > RESUMABLE_THRESHOLD ? `${file.size}-${file.lastModified}` : `${Date.now()}`;
  const path = `${session.user.id}/${stamp}-${safe}`; // stable for big files so resumes target the same object

  if (file.size <= RESUMABLE_THRESHOLD) {
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: type });
    if (error) throw new Error(error.message);
    opts.onProgress?.({ loaded: file.size, total: file.size });
  } else {
    const { Upload } = await import("tus-js-client");
    await new Promise<void>((resolve, reject) => {
      const up = new Upload(file, {
        endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 2000, 5000, 10000, 20000, 30000, 60000],
        headers: { authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "x-upsert": "true" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024, // required by storage
        metadata: { bucketName: "media", objectName: path, contentType: type, cacheControl: "3600" },
        onError: (e) => reject(new Error(`Upload failed: ${e.message.split("\n")[0]}`)),
        onShouldRetry: () => { opts.onProgress?.({ loaded: 0, total: file.size, retrying: true }); return true; },
        onProgress: (loaded, total) => opts.onProgress?.({ loaded, total }),
        onSuccess: () => resolve(),
      });
      opts.signal?.addEventListener("abort", () => { up.abort(); reject(new Error("Upload cancelled")); });
      // Resume a previous interrupted upload of the same file if one exists.
      up.findPreviousUploads().then((prev) => {
        if (prev[0]) up.resumeFromPreviousUpload(prev[0]);
        up.start();
      });
    });
  }
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (e2 || !data) throw new Error(e2?.message ?? "Could not create file link.");
  return data.signedUrl;
}

export type Embed =
  | { kind: "youtube"; src: string }
  | { kind: "facebook-video"; src: string }
  | { kind: "facebook-reel"; src: string }
  | { kind: "facebook-post"; src: string }
  | { kind: "facebook-page"; src: string }
  | { kind: "file"; src: string }
  | { kind: "none" };

export function isFacebookUrl(url: string) {
  return /^https?:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.watch|fb\.com|fb\.me)\//i.test(url);
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

export function getEmbed(url?: string | null): Embed {
  if (!url) return { kind: "none" };
  const yt = youtubeId(url);
  if (yt) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}` };
  if (isFacebookUrl(url)) {
    const enc = encodeURIComponent(url);
    let path = "";
    try { path = new URL(url).pathname.toLowerCase(); } catch { /* ignore */ }
    if (/\/reels?\/|^\/share\/r\//.test(path))
      return { kind: "facebook-reel", src: `https://www.facebook.com/plugins/video.php?href=${enc}&show_text=false&width=360` };
    if (/\/videos?\/|^\/watch|^\/share\/v\//.test(path) || /fb\.watch/i.test(url))
      return { kind: "facebook-video", src: `https://www.facebook.com/plugins/video.php?href=${enc}&show_text=false&width=734` };
    if (path === "/profile.php" || /^\/p\/[^/]+\/?$/.test(path) || /^\/[^/]+\/?$/.test(path))
      return { kind: "facebook-page", src: `https://www.facebook.com/plugins/page.php?href=${enc}&tabs=timeline&width=500&height=700&small_header=false&adapt_container_width=true&hide_cover=false` };
    return { kind: "facebook-post", src: `https://www.facebook.com/plugins/post.php?href=${enc}&show_text=true&width=500` };
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
