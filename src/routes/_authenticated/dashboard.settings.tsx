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
  live_stream_url: url, live_title: z.string().trim().min(2).max(120),
  facebook_page_url: url, youtube_url: url, x_url: url, instagram_url: url, tiktok_url: url,
});
type S = z.infer<typeof schema>;
const FIELDS: [keyof S, string, string?][] = [
  ["live_stream_url", "Live stream link", "YouTube live, Facebook live video, or a direct .m3u8/.mp4 stream. Leave empty when not broadcasting."],
  ["live_title", "Live broadcast title"],
  ["facebook_page_url", "Facebook page"],
  ["youtube_url", "YouTube channel"],
  ["x_url", "X (Twitter)"],
  ["instagram_url", "Instagram"],
  ["tiktok_url", "TikTok"],
];

function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings-admin"], queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).single()).data });
  const [f, setF] = useState<S | null>(null);
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    if (data) setF({
      live_stream_url: data.live_stream_url ?? "", live_title: data.live_title, facebook_page_url: data.facebook_page_url ?? "",
      youtube_url: data.youtube_url ?? "", x_url: data.x_url ?? "", instagram_url: data.instagram_url ?? "", tiktok_url: data.tiktok_url ?? "",
    });
  }, [data]);
  const loadCats = () => supabase.from("categories").select("id,name,slug").order("sort").then(({ data }) => setCats(data ?? []));
  useEffect(() => { loadCats(); }, []);

  if (!isAdmin) return <p>Only administrators can change site settings.</p>;
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
