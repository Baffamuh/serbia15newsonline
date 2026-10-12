import { Link } from "@tanstack/react-router";
import type { NewsCard as Card } from "@/lib/news.functions";
import { EmptyState, NewsCard } from "./NewsCard";

export function Pager({ page, total, pageSize, search }: { page: number; total: number; pageSize: number; search: Record<string, unknown> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      {page > 1 && <Link to="." search={{ ...search, page: page - 1 }} className="rounded-sm border px-4 py-2 font-semibold hover:bg-muted">← Newer</Link>}
      <span className="text-muted-foreground">Page {page} of {pages}</span>
      {page < pages && <Link to="." search={{ ...search, page: page + 1 }} className="rounded-sm border px-4 py-2 font-semibold hover:bg-muted">Older →</Link>}
    </nav>
  );
}

export function ArchiveGrid({ items, emptyTitle, emptyText }: { items: Card[]; emptyTitle: string; emptyText: string }) {
  if (!items.length) return <EmptyState title={emptyTitle} text={emptyText} />;
  return <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{items.map((a) => <NewsCard key={a.id} a={a} />)}</div>;
}

export const FORMATS = [
  { value: "", label: "All" },
  { value: "article", label: "Articles" },
  { value: "video", label: "Videos" },
  { value: "interview", label: "Interviews" },
  { value: "documentary", label: "Documentaries" },
] as const;
