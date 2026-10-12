import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Facebook, Link2, Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importFromLink, type ImportResult } from "@/lib/import.functions";
import { logActivity, useAuth } from "@/lib/auth";
import { getEmbed, slugify, uploadMedia } from "@/lib/media";
import { EmbedPlayer } from "@/components/site/EmbedPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard/editor")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  component: Editor,
});

type Format = "article" | "video" | "interview" | "documentary";
type Status = "draft" | "review" | "published";
const empty = {
  title: "", summary: "", body: "", category_id: "", format: "article" as Format, status: "draft" as Status,
  publish_at: "", cover_image_url: "", video_url: "", facebook_url: "", source_url: "",
  is_breaking: false, is_featured: false, is_trending: false,
};
type Form = typeof empty;

const formSchema = z.object({
  title: z.string().trim().min(3, "Headline is too short").max(250),
  summary: z.string().trim().max(600),
  body: z.string().max(100_000),
  video_url: z.string().trim().url("Video link must be a full https:// link").or(z.literal("")),
  facebook_url: z.string().trim().url("Facebook link must be a full https:// link").or(z.literal("")),
  source_url: z.string().trim().url("Source link must be a full https:// link").or(z.literal("")),
  cover_image_url: z.string().trim().url().or(z.literal("")),
});

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Editor() {
  const { id } = Route.useSearch();
  const { isEditor, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const runImport = useServerFn(importFromLink);
  const [f, setF] = useState<Form>(empty);
  const [slug, setSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: cats } = useQuery({
    queryKey: ["categories-staff"],
    queryFn: async () => (await supabase.from("categories").select("id,name").order("sort")).data ?? [],
  });

  useEffect(() => {
    if (!id) { setF(empty); setSlug(null); return; }
    supabase.from("articles").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) return toast.error("Story not found or you don't have access.");
      setSlug(data.slug);
      setF({
        title: data.title, summary: data.summary, body: data.body, category_id: data.category_id ?? "",
        format: data.format, status: data.status, publish_at: toLocalInput(data.publish_at),
        cover_image_url: data.cover_image_url ?? "", video_url: data.video_url ?? "", facebook_url: data.facebook_url ?? "",
        source_url: data.source_url ?? "", is_breaking: data.is_breaking, is_featured: data.is_featured, is_trending: data.is_trending,
      });
    });
  }, [id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function doImport() {
    const u = z.string().trim().url().safeParse(link);
    if (!u.success) return toast.error("Paste a full link starting with https://");
    setImporting(true);
    setResult(null);
    try {
      const r = await runImport({ data: { url: u.data } });
      setResult(r);
      const isFb = r.source === "facebook";
      setF((p) => ({
        ...p,
        title: p.title || r.title || "",
        summary: p.summary || (r.description ?? "").slice(0, 600),
        body: p.body || r.description || "",
        cover_image_url: p.cover_image_url || r.savedImageUrl || r.imageUrl || "",
        facebook_url: isFb ? r.originalUrl : p.facebook_url,
        video_url: !isFb && r.source === "youtube" ? r.originalUrl : p.video_url,
        source_url: r.source === "web" ? r.originalUrl : p.source_url,
        format: r.isVideo && p.format === "article" ? "video" : p.format,
      }));
      r.ok ? toast.success("Details imported — please review") : toast.warning("Import not available for this link");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function useAsEmbed() {
    const u = z.string().trim().url().safeParse(link);
    if (!u.success) return toast.error("Paste a full link first");
    const isFb = /facebook\.com|fb\.watch/.test(u.data);
    if (isFb) set("facebook_url", u.data);
    else set("video_url", u.data);
    const isVid = /\/videos?\/|\/reel\/|fb\.watch|\/watch|youtu|\/share\/v\//i.test(u.data);
    if (isVid && f.format === "article") set("format", "video");
    toast.success("Link attached as an embed. Add a headline and save.");
  }

  async function onUpload(kind: "cover_image_url" | "video_url", file?: File) {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadMedia(file);
      set(kind, url);
      await logActivity("upload", "media", null, file.name);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function save(nextStatus?: Status) {
    const parsed = formSchema.safeParse(f);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    const status = nextStatus ?? f.status;
    if (status === "published" && !f.body.trim() && !f.video_url && !f.facebook_url && !f.summary.trim())
      return toast.error("Add story text, a summary or a video before publishing.");
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", session!.user.id).maybeSingle();
    const payload = {
      title: parsed.data.title,
      summary: parsed.data.summary,
      body: f.body,
      category_id: f.category_id || null,
      format: f.format,
      status,
      publish_at: f.publish_at ? new Date(f.publish_at).toISOString() : new Date().toISOString(),
      cover_image_url: f.cover_image_url || null,
      video_url: f.video_url || null,
      facebook_url: f.facebook_url || null,
      source_url: f.source_url || null,
      is_breaking: f.is_breaking, is_featured: f.is_featured, is_trending: f.is_trending,
    };
    let err, savedId = id;
    if (id) {
      ({ error: err } = await supabase.from("articles").update(payload).eq("id", id));
    } else {
      const res = await supabase.from("articles").insert({
        ...payload, slug: slugify(parsed.data.title), author_id: session!.user.id, author_name: prof?.full_name || session!.user.email || "",
      }).select("id,status").single();
      err = res.error; savedId = res.data?.id;
      if (res.data && status === "published" && res.data.status !== "published") toast.info("Sent for editor review — only editors can publish.");
    }
    setSaving(false);
    if (err) return toast.error(err.message);
    await logActivity(id ? "update" : "create", "article", savedId, `${status}: ${parsed.data.title}`);
    qc.invalidateQueries();
    toast.success(status === "published" ? (new Date(payload.publish_at) > new Date() ? "Scheduled" : "Published") : "Saved");
    navigate({ to: "/dashboard" });
  }

  const embed = getEmbed(f.video_url || f.facebook_url);

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl font-black text-navy">{id ? "Edit story" : "New story"}</h1>

      <section className="mt-6 rounded-sm border-2 border-navy bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Facebook className="h-5 w-5 text-navy" /> Import from Facebook, YouTube or a web link</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paste a public Facebook post, video, reel or page link. We read the details Facebook shares publicly. If none are shared, attach it as an embed instead.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.facebook.com/…" inputMode="url" />
          <Button onClick={doImport} disabled={importing} className="bg-navy text-navy-foreground">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Import details</Button>
          <Button variant="outline" onClick={useAsEmbed}>Use as embed</Button>
        </div>
        {result && (
          <div className={`mt-3 flex gap-2 rounded-sm p-3 text-sm ${result.ok ? "bg-secondary" : "bg-accent text-accent-foreground"}`}>
            {result.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
            <div>
              <p>{result.message}</p>
              {!result.ok && result.source === "facebook" && (
                <Button size="sm" variant="outline" className="mt-2" onClick={useAsEmbed}>Attach as Facebook embed</Button>
              )}
            </div>
          </div>
        )}
      </section>

      <Tabs defaultValue="edit" className="mt-6">
        <TabsList><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
        <TabsContent value="edit" className="space-y-4 rounded-sm border bg-card p-4 sm:p-5">
          <div><Label htmlFor="t">Headline *</Label><Input id="t" value={f.title} maxLength={250} onChange={(e) => set("title", e.target.value)} /></div>
          <div><Label htmlFor="s">Summary</Label><Textarea id="s" rows={2} maxLength={600} value={f.summary} onChange={(e) => set("summary", e.target.value)} /></div>
          <div><Label htmlFor="b">Story text</Label><Textarea id="b" rows={12} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Separate paragraphs with a blank line." /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="c">Section</Label>
              <select id="c" value={f.category_id} onChange={(e) => set("category_id", e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">— None —</option>
                {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="fm">Format</Label>
              <select id="fm" value={f.format} onChange={(e) => set("format", e.target.value as Format)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="article">Article</option><option value="video">Video</option><option value="interview">Interview</option><option value="documentary">Documentary</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pa">Publish date & time</Label>
              <Input id="pa" type="datetime-local" value={f.publish_at} onChange={(e) => set("publish_at", e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Future time = scheduled. Empty = now.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Cover image</Label>
              {f.cover_image_url && <img src={f.cover_image_url} alt="" className="mb-2 aspect-video w-full rounded-sm object-cover" />}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed p-3 text-sm hover:bg-muted">
                {uploading === "cover_image_url" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload image
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => onUpload("cover_image_url", e.target.files?.[0])} />
              </label>
              {f.cover_image_url && <button className="mt-1 text-xs text-destructive underline" onClick={() => set("cover_image_url", "")}>Remove image</button>}
            </div>
            <div className="space-y-3">
              <div><Label htmlFor="v">Video link (YouTube, Facebook video or uploaded file)</Label><Input id="v" value={f.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://…" /></div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed p-3 text-sm hover:bg-muted">
                {uploading === "video_url" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload video (max 50 MB)
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => onUpload("video_url", e.target.files?.[0])} />
              </label>
              <div><Label htmlFor="fb">Facebook post link (embedded & “View original”)</Label><Input id="fb" value={f.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} placeholder="https://www.facebook.com/…" /></div>
              <div><Label htmlFor="src">Other source link</Label><Input id="src" value={f.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" /></div>
            </div>
          </div>

          {isEditor ? (
            <div className="flex flex-wrap gap-6 rounded-sm bg-muted p-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_breaking} onCheckedChange={(v) => set("is_breaking", v)} /> Breaking news</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_featured} onCheckedChange={(v) => set("is_featured", v)} /> Featured on homepage</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_trending} onCheckedChange={(v) => set("is_trending", v)} /> Trending</label>
            </div>
          ) : (
            <p className="rounded-sm bg-muted p-3 text-sm text-muted-foreground">As a reporter, your stories go to editors for review before publishing.</p>
          )}
        </TabsContent>
        <TabsContent value="preview" className="rounded-sm border bg-card p-4 sm:p-8">
          <h2 className="font-display text-3xl font-black text-navy">{f.title || "Headline"}</h2>
          {f.summary && <p className="mt-3 text-lg text-muted-foreground">{f.summary}</p>}
          <div className="mt-4">
            {embed.kind !== "none" ? <EmbedPlayer url={f.video_url || f.facebook_url} title={f.title} poster={f.cover_image_url} /> : f.cover_image_url && <img src={f.cover_image_url} alt="" className="w-full rounded-sm" />}
          </div>
          <div className="prose-news mt-6">{f.body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t bg-muted/90 py-3 backdrop-blur">
        <Button variant="outline" disabled={saving} onClick={() => save("draft")}>Save draft</Button>
        {isEditor ? (
          <Button disabled={saving} className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={() => save("published")}>
            {f.publish_at && new Date(f.publish_at) > new Date() ? "Schedule" : "Publish now"}
          </Button>
        ) : (
          <Button disabled={saving} className="bg-navy text-navy-foreground" onClick={() => save("review")}>Submit for review</Button>
        )}
        {slug && f.status === "published" && <Button variant="ghost" asChild><a href={`/news/${slug}`} target="_blank" rel="noreferrer">View live</a></Button>}
      </div>
    </div>
  );
}
