import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import { generateThumbnailArt } from "@/lib/ai.functions";
import { uploadMedia } from "@/lib/media";
import { logActivity } from "@/lib/auth";
import logo from "@/assets/logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const W = 1280, H = 720;
const NAVY = "#14286e", RED = "#d1232a", WHITE = "#ffffff";

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("Could not load image")); i.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines.slice(0, 3);
}

export function ThumbnailDesigner({ headline, category, image, onSaved }: {
  headline: string; category: string; image: string; onSaved: (url: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState(image);
  const [text, setText] = useState(headline);
  const [label, setLabel] = useState(category || "NEWS");
  const [zoom, setZoom] = useState(1);
  const [ox, setOx] = useState(50);
  const [oy, setOy] = useState(50);
  const [pos, setPos] = useState<"bottom" | "top">("bottom");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const gen = useServerFn(generateThumbnailArt);

  useEffect(() => setText(headline), [headline]);
  useEffect(() => setLabel(category || "NEWS"), [category]);
  useEffect(() => { if (image) setSrc(image); }, [image]);

  useEffect(() => {
    let off = false;
    (async () => {
      const c = canvas.current; if (!c) return; const ctx = c.getContext("2d")!;
      ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
      if (src) {
        try {
          const img = await loadImg(src); if (off) return;
          const s = Math.max(W / img.width, H / img.height) * zoom;
          const dw = img.width * s, dh = img.height * s;
          ctx.drawImage(img, (W - dw) * (ox / 100), (H - dh) * (oy / 100), dw, dh);
        } catch { /* keep navy */ }
      }
      const top = pos === "top";
      const g = ctx.createLinearGradient(0, top ? 0 : H, 0, top ? H * 0.6 : H * 0.4);
      g.addColorStop(0, "rgba(10,20,60,0.95)"); g.addColorStop(1, "rgba(10,20,60,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.font = "900 58px Archivo, Arial, sans-serif";
      const lines = wrap(ctx, text || "Headline", W - 120);
      const lh = 66; const blockH = lines.length * lh;
      const y0 = top ? 140 : H - 60 - blockH;
      ctx.font = "800 26px Archivo, Arial, sans-serif";
      const lw = ctx.measureText(label.toUpperCase()).width + 32;
      ctx.fillStyle = RED; ctx.fillRect(60, y0 - 56, lw, 42);
      ctx.fillStyle = WHITE; ctx.fillText(label.toUpperCase(), 76, y0 - 26);
      ctx.font = "900 58px Archivo, Arial, sans-serif";
      lines.forEach((l, i) => ctx.fillText(l, 60, y0 + (i + 1) * lh - 14));
      ctx.fillStyle = RED; ctx.fillRect(0, H - 10, W, 10);
      try {
        const lg = await loadImg(logo.url); if (off) return;
        const ly = top ? H - 130 : 30;
        ctx.save(); ctx.beginPath(); ctx.arc(W - 90, ly + 50, 50, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); ctx.clip();
        ctx.drawImage(lg, W - 140, ly, 100, 100); ctx.restore();
        ctx.font = "800 20px Archivo, Arial, sans-serif"; ctx.fillStyle = WHITE; ctx.textAlign = "right";
        ctx.fillText("SERBIA 15 ONLINE NEWS", W - 155, ly + 58); ctx.textAlign = "left";
      } catch { /* logo optional */ }
    })();
    return () => { off = true; };
  }, [src, text, label, zoom, ox, oy, pos]);

  function pick(file?: File) {
    if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    const r = new FileReader(); r.onload = () => setSrc(String(r.result)); r.readAsDataURL(file);
  }

  async function toDataUrl(u: string) {
    if (u.startsWith("data:")) return u;
    const img = await loadImg(u); const c = document.createElement("canvas");
    const s = Math.min(1, 1536 / Math.max(img.width, img.height));
    c.width = img.width * s; c.height = img.height * s; c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }

  async function ai(mode: "enhance" | "create") {
    if (prompt.trim().length < 3) return toast.error("Describe what you want (at least a few words).");
    if (mode === "enhance" && !src) return toast.error("Add a photo first.");
    setBusy(mode);
    try {
      const r = await gen({ data: { prompt, image: mode === "enhance" ? await toDataUrl(src) : undefined } });
      if (r.ok) { setSrc(r.image); toast.success("AI image ready — review it in the preview."); } else toast.error(r.error);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Image generation failed"); }
    finally { setBusy(null); }
  }

  async function save() {
    setBusy("save");
    try {
      const blob = await new Promise<Blob>((res, rej) => canvas.current!.toBlob((b) => (b ? res(b) : rej(new Error("Could not export (image source blocks export)"))), "image/jpeg", 0.9));
      const url = await uploadMedia(blob, {}, "thumbnail.jpg");
      await logActivity("upload", "thumbnail", null, text.slice(0, 80));
      onSaved(url); toast.success("Thumbnail saved to media and set as cover image");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(null); }
  }

  return (
    <section className="mt-6 rounded-sm border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ImagePlus className="h-5 w-5 text-brand" /> Thumbnail designer</h2>
      <canvas ref={canvas} width={W} height={H} className="mt-3 aspect-video w-full rounded-sm border" aria-label="Thumbnail preview" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="th">Headline on image</Label><Input id="th" value={text} maxLength={120} onChange={(e) => setText(e.target.value)} /></div>
        <div><Label htmlFor="tl">Category label</Label><Input id="tl" value={label} maxLength={24} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><Label>Zoom ({zoom.toFixed(1)}×)</Label><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full" /></div>
        <div><Label>Text position</Label>
          <select value={pos} onChange={(e) => setPos(e.target.value as "top" | "bottom")} className="h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="bottom">Bottom</option><option value="top">Top</option></select></div>
        <div><Label>Crop left ↔ right</Label><input type="range" min={0} max={100} value={ox} onChange={(e) => setOx(+e.target.value)} className="w-full" /></div>
        <div><Label>Crop up ↕ down</Label><input type="range" min={0} max={100} value={oy} onChange={(e) => setOy(+e.target.value)} className="w-full" /></div>
      </div>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-sm border border-dashed px-3 py-2 text-sm hover:bg-muted">
        <ImagePlus className="h-4 w-4" /> Use a different photo
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <div className="mt-3 rounded-sm bg-muted p-3">
        <Label htmlFor="tp">AI image help</Label>
        <Input id="tp" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. brighten, sharpen and improve contrast" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => ai("enhance")}>{busy === "enhance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Enhance this photo</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => ai("create")}>{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create background</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">AI backgrounds are illustrations — never use them to depict real events as photos.</p>
      </div>
      <Button className="mt-3 bg-brand text-brand-foreground hover:bg-brand/90" disabled={!!busy} onClick={save}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & use as cover</Button>
    </section>
  );
}
