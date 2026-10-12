import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Eye, Zap, Star, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: ContentList });

type Row = {
  id: string; title: string; slug: string; status: "draft" | "review" | "published"; format: string;
  publish_at: string; is_breaking: boolean; is_featured: boolean; is_trending: boolean; author_name: string; author_id: string | null;
  category: { name: string } | null;
};

function statusLabel(r: Row) {
  if (r.status === "published" && new Date(r.publish_at) > new Date()) return { t: "Scheduled", c: "bg-secondary text-secondary-foreground" };
  if (r.status === "published") return { t: "Published", c: "bg-navy text-navy-foreground" };
  if (r.status === "review") return { t: "In review", c: "bg-accent text-accent-foreground" };
  return { t: "Draft", c: "bg-muted text-muted-foreground" };
}

function ContentList() {
  const { isEditor, session } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("");
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-articles", status, format, q],
    queryFn: async () => {
      let query = supabase
        .from("articles")
        .select("id,title,slug,status,format,publish_at,is_breaking,is_featured,is_trending,author_name,author_id,category:categories(name)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (status) query = query.eq("status", status as Row["status"]);
      if (format) query = query.eq("format", format as "article");
      if (q.trim()) query = query.ilike("title", `%${q.trim().replace(/[%,]/g, "")}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch, label }: { id: string; patch: { status?: Row["status"]; is_breaking?: boolean; is_featured?: boolean; is_trending?: boolean }; label: string }) => {
      const { error } = await supabase.from("articles").update(patch).eq("id", id);
      if (error) throw error;
      await logActivity(label, "article", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-articles"] }); qc.invalidateQueries({ queryKey: ["home"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("articles").delete().eq("id", r.id);
      if (error) throw error;
      await logActivity("delete", "article", r.id, r.title);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-articles"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-black text-navy">Content</h1>
        <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90"><Link to="/dashboard/editor">+ New story</Link></Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input placeholder="Search titles…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background" />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-background px-3 text-sm">
          <option value="">All statuses</option><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published / scheduled</option>
        </select>
        <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-md border bg-background px-3 text-sm">
          <option value="">All formats</option><option value="article">Article</option><option value="video">Video</option><option value="interview">Interview</option><option value="documentary">Documentary</option>
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {error && <p className="text-destructive">{(error as Error).message}</p>}
        {data && data.length === 0 && (
          <div className="rounded-sm border border-dashed bg-card p-10 text-center">
            <p className="font-display text-lg font-bold">No content yet</p>
            <p className="text-sm text-muted-foreground">Create your first story, or import one from a Facebook link.</p>
          </div>
        )}
        {data?.map((r) => {
          const s = statusLabel(r);
          const canEdit = isEditor || r.author_id === session?.user.id;
          return (
            <div key={r.id} className="flex flex-col gap-3 rounded-sm border bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-sm px-2 py-0.5 font-semibold ${s.c}`}>{s.t}</span>
                  <span className="uppercase text-muted-foreground">{r.format}</span>
                  {r.category && <span className="text-brand">{r.category.name}</span>}
                  {r.is_breaking && <span className="font-bold text-brand">BREAKING</span>}
                </div>
                <p className="mt-1 truncate font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.author_name || "—"} · {formatDate(r.publish_at)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {isEditor && r.status !== "published" && (
                  <Button size="sm" onClick={() => update.mutate({ id: r.id, patch: { status: "published" }, label: "publish" })}>Publish</Button>
                )}
                {isEditor && r.status === "published" && (
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, patch: { status: "draft" }, label: "unpublish" })}>Unpublish</Button>
                )}
                {isEditor && (
                  <>
                    <Button size="icon" variant={r.is_breaking ? "default" : "outline"} title="Breaking" aria-label="Toggle breaking" onClick={() => update.mutate({ id: r.id, patch: { is_breaking: !r.is_breaking }, label: "toggle_breaking" })}><Zap className="h-4 w-4" /></Button>
                    <Button size="icon" variant={r.is_featured ? "default" : "outline"} title="Featured" aria-label="Toggle featured" onClick={() => update.mutate({ id: r.id, patch: { is_featured: !r.is_featured }, label: "toggle_featured" })}><Star className="h-4 w-4" /></Button>
                    <Button size="icon" variant={r.is_trending ? "default" : "outline"} title="Trending" aria-label="Toggle trending" onClick={() => update.mutate({ id: r.id, patch: { is_trending: !r.is_trending }, label: "toggle_trending" })}><TrendingUp className="h-4 w-4" /></Button>
                  </>
                )}
                {r.status === "published" && new Date(r.publish_at) <= new Date() && (
                  <Button size="icon" variant="outline" asChild aria-label="View"><Link to="/news/$slug" params={{ slug: r.slug }} target="_blank"><Eye className="h-4 w-4" /></Link></Button>
                )}
                {canEdit && (
                  <Button size="icon" variant="outline" asChild aria-label="Edit"><Link to="/dashboard/editor" search={{ id: r.id }}><Pencil className="h-4 w-4" /></Link></Button>
                )}
                {(isEditor || (canEdit && r.status !== "published")) && (
                  <Button size="icon" variant="outline" aria-label="Delete" onClick={() => confirm(`Delete “${r.title}”?`) && remove.mutate(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
