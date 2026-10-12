import { getEmbed } from "@/lib/media";

export function EmbedPlayer({ url, title, poster }: { url?: string | null; title: string; poster?: string | null }) {
  const e = getEmbed(url);
  if (e.kind === "none") return null;
  if (e.kind === "file") {
    return (
      <video controls playsInline preload="metadata" poster={poster ?? undefined} className="aspect-video w-full bg-navy-deep" src={e.src}>
        Your browser cannot play this video.
      </video>
    );
  }
  if (e.kind === "facebook-post" || e.kind === "facebook-page" || e.kind === "facebook-reel") {
    const h = e.kind === "facebook-page" ? 700 : e.kind === "facebook-reel" ? 640 : 640;
    const w = e.kind === "facebook-reel" ? 360 : 500;
    return (
      <div className="flex justify-center bg-muted py-4">
        <iframe
          src={e.src}
          title={title}
          style={{ width: "100%", maxWidth: w, height: h }}
          className="border-0 bg-background"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="aspect-video w-full bg-navy-deep">
      <iframe
        src={e.src}
        title={title}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
