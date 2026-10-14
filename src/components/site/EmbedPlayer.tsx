import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { getEmbed } from "@/lib/media";

function Fallback({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline">
      <ExternalLink className="h-4 w-4" /> {label}
    </a>
  );
}

export function EmbedPlayer({ url, title, poster }: { url?: string | null; title: string; poster?: string | null }) {
  const e = getEmbed(url);
  const [videoError, setVideoError] = useState(false);
  if (e.kind === "none" || !url) return null;
  if (e.kind === "file") {
    if (videoError)
      return (
        <div className="flex aspect-video w-full flex-col items-center justify-center bg-navy-deep p-4 text-center text-navy-foreground">
          <p className="font-semibold">This video could not be played here.</p>
          <a href={e.src} target="_blank" rel="noopener noreferrer" className="mt-2 underline">Open the video file</a>
        </div>
      );
    return (
      <video controls playsInline preload="metadata" poster={poster ?? undefined} onError={() => setVideoError(true)} className="aspect-video w-full bg-navy-deep" src={e.src}>
        Your browser cannot play this video.
      </video>
    );
  }
  const isFb = e.kind.startsWith("facebook");
  if (e.kind === "facebook-post" || e.kind === "facebook-page" || e.kind === "facebook-reel") {
    const h = e.kind === "facebook-page" ? 700 : 640;
    const w = e.kind === "facebook-reel" ? 360 : 500;
    return (
      <div className="flex flex-col items-center bg-muted px-2 py-4">
        <iframe
          src={e.src}
          title={title}
          style={{ width: "100%", maxWidth: w, height: h }}
          className="border-0 bg-background"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
        <Fallback url={url} label="Not loading? Watch on Facebook" />
      </div>
    );
  }
  return (
    <div>
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
      <Fallback url={url} label={isFb ? "Video unavailable? Watch on Facebook" : "Open the original video"} />
    </div>
  );
}
