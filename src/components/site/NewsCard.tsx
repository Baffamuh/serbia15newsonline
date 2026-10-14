import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PlayCircle, Newspaper } from "lucide-react";
import logo from "@/assets/logo.jpg.asset.json";
import type { NewsCard as Card } from "@/lib/news.functions";
import { formatDate, youtubeId } from "@/lib/media";
import { cn } from "@/lib/utils";

export function thumbOf(a: Card): string | null {
  if (a.cover_image_url) return a.cover_image_url;
  const yt = a.video_url ? youtubeId(a.video_url) : null;
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

const isVideo = (a: Card) => a.format !== "article";

export function Thumb({ a, className, eager }: { a: Card; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : thumbOf(a);
  return (
    <div className={cn("relative aspect-video overflow-hidden bg-muted", className)}>
      {src ? (
        <img src={src} alt="" loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-navy to-navy-deep text-navy-foreground">
          <img src={logo.url} alt="" className="h-12 w-12 rounded-full bg-background opacity-90" />
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest opacity-80">
            {isVideo(a) ? <PlayCircle className="h-3.5 w-3.5" /> : <Newspaper className="h-3.5 w-3.5" />} Serbia 15 Online News
          </span>
        </div>
      )}
      {isVideo(a) && src && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-sm bg-navy-deep/85 px-2 py-1 text-xs font-bold uppercase text-navy-foreground">
          <PlayCircle className="h-3.5 w-3.5" /> {a.format}
        </span>
      )}
    </div>
  );
}

export function Meta({ a }: { a: Card }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <time dateTime={a.publish_at}>{formatDate(a.publish_at)}</time>
      {a.category && (
        <>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span className="font-semibold text-brand">{a.category.name}</span>
        </>
      )}
    </p>
  );
}

export function NewsCard({ a, size = "md" }: { a: Card; size?: "sm" | "md" | "lg" }) {
  return (
    <Link to="/news/$slug" params={{ slug: a.slug }} className="group block border-t-2 border-transparent hover:border-brand">
      <Thumb a={a} eager={size === "lg"} />
      <div className="pt-3">
        <h3
          className={cn(
            "font-display font-bold leading-snug text-foreground group-hover:underline",
            size === "lg" ? "text-2xl md:text-3xl" : size === "sm" ? "text-[15px]" : "text-lg",
          )}
        >
          {a.title}
        </h3>
        {size !== "sm" && a.summary && <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{a.summary}</p>}
        <Meta a={a} />
      </div>
    </Link>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between border-b-2 border-navy pb-1.5">
      <h2 className="relative font-display text-xl font-black uppercase tracking-tight text-navy before:mr-2 before:inline-block before:h-4 before:w-1.5 before:bg-brand">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-sm border border-dashed bg-muted/50 px-6 py-12 text-center">
      <Newspaper className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 font-display text-lg font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
