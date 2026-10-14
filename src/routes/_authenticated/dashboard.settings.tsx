import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({ component: SettingsPage });

const url = z.string().trim().url("Links must start with https://").or(z.literal(""));
const schema = z.object({
  facebook_page_url: url, youtube_url: url, x_url: url, instagram_url: url, tiktok_url: url,
  org_phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, "Phone may only contain digits, spaces and +"),
  org_whatsapp: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, "WhatsApp number may only contain digits and +"),
  org_email: z.string().trim().email("Enter a valid organisation email").or(z.literal("")),
  org_address: z.string().trim().max(200),
});
type S = z.infer<typeof schema>;
const FIELDS: [keyof S, string, string?][] = [
  ["org_phone", "Newsroom phone", "Organisation contact shown in the footer (not personal details)."],
  ["org_whatsapp", "Newsroom WhatsApp number", "International format, e.g. 2348000000000"],
  ["org_email", "Newsroom email"],
  ["org_address", "Office address / location"],
  ["facebook_page_url", "Facebook page"],
  ["youtube_url", "YouTube channel"],
  ["x_url", "X (Twitter)"],
  ["instagram_url", "Instagram"],
  ["tiktok_url", "TikTok"],
];

function BroadcastControls() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings-admin"], queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).single()).data });
  const [b, setB] = useState({ url: "", title: "", description: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setB({ url: data.live_stream_url ?? "", title: data.live_title, description: data.live_description ?? "" });
  }, [data]);
  async function run(active: boolean) {
    if (active && !/^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.watch|youtube\.com|youtu\.be)\//i.test(b.url.trim()))
      return toast.error("Paste a Facebook Live video link or YouTube live link (https://…)");
    if (active && /facebook\.com\/(share\/[^/]+\/?$|[^/]+\/?$)/i.test(b.url.trim()) && !/\/videos\/|watch|\/live/i.test(b.url))
      return toast.error("That looks like a page or share link. Use the live video's own link (it contains /videos/ or watch).");
    setBusy(true);
    const { error } = await supabase.rpc("set_live_broadcast", { _url: b.url.trim(), _title: b.title.trim(), _description: b.description.trim(), _active: active });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["settings-admin"] });
    toast.success(active ? "Broadcast is live on the site" : "Broadcast ended");
  }
  if (!data) return null;
  return (
    <section className="space-y-4 rounded-sm border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Live broadcast</h2>
        <span className={data.is_live ? "rounded-sm bg-brand px-2 py-1 text-xs font-black uppercase text-brand-foreground" : "rounded-sm bg-muted px-2 py-1 text-xs font-bold uppercase text-muted-foreground"}>
          {data.is_live ? "● Live now" : "Off air"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">The site cannot detect when Facebook goes live, so switch the status here. Changing the link while live switches the featured stream.</p>
      <div><Label htmlFor="bl-url">Facebook Live / YouTube live link</Label><Input id="bl-url" value={b.url} onChange={(e) => setB({ ...b, url: e.target.value })} placeholder="https://www.facebook.com/…/videos/…" /></div>
      <div><Label htmlFor="bl-title">Stream title</Label><Input id="bl-title" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} /></div>
      <div><Label htmlFor="bl-desc">Description</Label><Textarea id="bl-desc" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} rows={3} /></div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run(true)}>{data.is_live ? "Update live stream" : "Go live"}</Button>
        {data.is_live && <Button disabled={busy} variant="outline" onClick={() => run(false)}>End broadcast</Button>}
      </div>
    </section>
  );
}

function SettingsPage() {
  const { isAdmin, isEditor } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings-admin"], queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).single()).data });
  const [f, setF] = useState<S | null>(null);
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    if (data) setF({
      facebook_page_url: data.facebook_page_url ?? "",
      youtube_url: data.youtube_url ?? "", x_url: data.x_url ?? "", instagram_url: data.instagram_url ?? "", tiktok_url: data.tiktok_url ?? "",
      org_phone: data.org_phone ?? "", org_whatsapp: data.org_whatsapp ?? "", org_email: data.org_email ?? "", org_address: data.org_address ?? "",
    });
  }, [data]);
  const loadCats = () => supabase.from("categories").select("id,name,slug").order("sort").then(({ data }) => setCats(data ?? []));
  useEffect(() => { loadCats(); }, []);

  if (!isAdmin) return isEditor ? <div className="max-w-3xl"><BroadcastControls /></div> : <p>Only administrators can change site settings.</p>;
  if (!f) return <p className="text-muted-foreground">Loading…</p>;

  async function save() {
    const p = schema.safeParse(f);
    if (!p.success) return toast.error(p.error.issues[0]?.message ?? "Invalid input");
    const v = Object.fromEntries(Object.entries(p.data).map(([k, x]) => [k, x === "" ? null : x])) as Record<string, string | null>;
    const { error } = await supabase.from("site_settings").update({ ...v, live_title: p.data.live_title, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    await logActivity("update", "settings", "1");
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Settings saved");
  }

  async function addCat() {
    const name = newCat.trim();
    if (name.length < 2 || name.length > 40) return toast.error("Section name must be 2–40 characters");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("categories").insert({ name, slug, sort: cats.length + 1 });
    if (error) return toast.error(error.message);
    await logActivity("create", "category", slug, name);
    setNewCat(""); loadCats();
  }
  async function delCat(id: string, name: string) {
    if (!confirm(`Delete section “${name}”? Stories in it will become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "category", id, name);
    loadCats();
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-4 rounded-sm border bg-card p-5">
        <h1 className="font-display text-3xl font-black text-navy">Site settings</h1>
        {FIELDS.map(([k, label, hint]) => (
          <div key={k}>
            <Label htmlFor={k}>{label}</Label>
            <Input id={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
        ))}
        <Button onClick={save}>Save settings</Button>
      </section>
      <section className="rounded-sm border bg-card p-5">
        <h2 className="font-display text-xl font-bold">News sections</h2>
        <ul className="mt-3 divide-y">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span>{c.name} <span className="text-muted-foreground">/{c.slug}</span></span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delCat(c.id, c.name)}>Delete</Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input placeholder="New section name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button onClick={addCat}>Add</Button>
        </div>
      </section>
    </div>
  );
}
