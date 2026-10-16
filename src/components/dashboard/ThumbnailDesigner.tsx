import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, ImagePlus, Save, Download } from "lucide-react";
import { toast } from "sonner";
import { generateThumbnailArt } from "@/lib/ai.functions";
import { uploadMedia } from "@/lib/media";
import { logActivity } from "@/lib/auth";
import logo from "@/assets/logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const W = 1080, H = 1350;
const NAVY = "#08204E", RED = "#D11920", WHITE = "#ffffff";

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("Could not load image")); i.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines.slice(0, 4);
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
  const [size, setSize] = useState(64);
  const [person, setPerson] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; });
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
      const poly = (pts: [number, number][], col: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
      ctx.fillStyle = "#F0F4FA"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(8,32,78,0.07)";
      for (let x = 20; x < W; x += 26) for (let y = 20; y < H; y += 26) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
      // header
      poly([[0, 0], [W, 0], [W, 170], [0, 170]], NAVY);
      poly([[700, 0], [W, 0], [W, 170], [640, 170]], RED);
      poly([[680, 0], [700, 0], [640, 170], [620, 170]], WHITE);
      ctx.fillStyle = WHITE; ctx.textBaseline = "alphabetic";
      ctx.font = "900 40px Archivo, Arial, sans-serif"; ctx.fillText("SERBIA 15 ONLINE NEWS", 180, 82);
      ctx.font = "800 28px Archivo, Arial, sans-serif"; ctx.fillText("TASHAR AL'UMMAH", 180, 124);
      ctx.textAlign = "center"; ctx.font = "900 44px Archivo, Arial, sans-serif"; ctx.fillText("((•))", 870, 78);
      ctx.font = "900 38px Archivo, Arial, sans-serif"; ctx.fillText("NEWS UPDATE", 870, 128); ctx.textAlign = "left";
      // photo
      const px = 50, py = 560, pw = W - 100, ph = 610;
      ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 24); ctx.fillStyle = NAVY; ctx.fill(); ctx.clip();
      if (src) {
        try {
          const img = await loadImg(src); if (off) return;
          const s = Math.max(pw / img.width, ph / img.height) * zoom;
          const dw = img.width * s, dh = img.height * s;
          ctx.drawImage(img, px + (pw - dw) * (ox / 100), py + (ph - dh) * (oy / 100), dw, dh);
        } catch { /* keep navy */ }
      }
      ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 24); ctx.stroke();
      // name strip
      if (person.trim()) {
        ctx.font = "800 34px Archivo, Arial, sans-serif"; const nw = ctx.measureText(person.toUpperCase()).width + 50;
        poly([[W - 50 - nw, py + ph - 140], [W - 50, py + ph - 140], [W - 50, py + ph - 80], [W - 70 - nw, py + ph - 80]], NAVY);
        ctx.fillStyle = WHITE; ctx.fillText(person.toUpperCase(), W - 50 - nw + 20, py + ph - 98);
      }
      // date badge
      ctx.font = "800 32px Archivo, Arial, sans-serif"; const dt = "📅 " + date; const dwid = ctx.measureText(dt).width + 60;
      poly([[px, py + ph - 70], [px + dwid + 30, py + ph - 70], [px + dwid, py + ph], [px, py + ph]], RED);
      ctx.fillStyle = WHITE; ctx.fillText(dt, px + 24, py + ph - 22);
      // headline box
      const hx = 50, hy = 250, hw = W - 100, hh = 280;
      ctx.fillStyle = NAVY; ctx.fillRect(hx, hy, hw, hh); ctx.lineWidth = 4; ctx.strokeStyle = RED; ctx.strokeRect(hx, hy, hw, hh);
      ctx.fillStyle = RED; ctx.fillRect(hx + 24, hy + 34, 12, hh - 68);
      ctx.font = "900 34px Archivo, Arial, sans-serif"; const cl = label.toUpperCase(); const cw = ctx.measureText(cl).width + 60;
      poly([[hx, hy - 60], [hx + cw + 30, hy - 60], [hx + cw, hy], [hx, hy]], RED);
      ctx.fillStyle = WHITE; ctx.fillText(cl, hx + 26, hy - 18);
      let fs = size; let lines: string[] = [];
      for (; fs >= 30; fs -= 2) { ctx.font = `900 ${fs}px Archivo, Arial, sans-serif`; lines = wrap(ctx, text || "Headline", hw - 100); if (lines.length * fs * 1.15 <= hh - 50 && wrap(ctx, text || "", hw - 100).length <= 4) break; }
      const lh = fs * 1.15; const y0 = hy + (hh - lines.length * lh) / 2 + fs * 0.9;
      ctx.fillStyle = WHITE; lines.forEach((l, i) => ctx.fillText(l, hx + 60, y0 + i * lh));
      // footer
      poly([[0, 1200], [W, 1200], [W, H], [0, H]], NAVY);
      poly([[720, 1200], [W, 1200], [W, H], [660, H]], RED);
      ctx.font = "900 26px Arial, sans-serif"; ctx.textAlign = "center";
      ([["f", 70], ["X", 140], ["▶", 210]] as [string, number][]).forEach(([t, x]) => { ctx.beginPath(); ctx.arc(+x, 1275, 28, 0, 7); ctx.fillStyle = WHITE; ctx.fill(); ctx.fillStyle = NAVY; ctx.fillText(String(t), +x, 1285); });
      ctx.textAlign = "left"; ctx.fillStyle = WHITE; ctx.font = "800 30px Archivo, Arial, sans-serif"; ctx.fillText("|  @Serbia15OnlineNews", 260, 1285);
      ctx.textAlign = "center"; ctx.font = "900 36px Archivo, Arial, sans-serif"; ctx.fillText("TASHAR AL'UMMAH", 880, 1288); ctx.textAlign = "left";
      try {
        const lg = await loadImg(logo.url); if (off) return;
        ctx.save(); ctx.beginPath(); ctx.arc(95, 85, 68, 0, 7); ctx.fillStyle = WHITE; ctx.fill(); ctx.clip();
        ctx.drawImage(lg, 31, 21, 128, 128); ctx.restore();
        ctx.lineWidth = 5; ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.arc(95, 85, 68, 0, 7); ctx.stroke();
      } catch { /* logo optional */ }
    })();
    return () => { off = true; };
  }, [src, text, label, zoom, ox, oy, size, person, date]);

  function download() {
    canvas.current?.toBlob((b) => {
      if (!b) return toast.error("Could not export this image");
      const u = URL.createObjectURL(b); const a = document.createElement("a");
      a.href = u; a.download = `serbia15-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 30000);
    }, "image/png");
  }

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
      const blob = await new Promise<Blob>((res, rej) => canvas.current!.toBlob((b) => (b ? res(b) : rej(new Error("Could not export (image source blocks export)"))), "image/png"));
      const url = await uploadMedia(blob, {}, "thumbnail.png");
      await logActivity("upload", "thumbnail", null, text.slice(0, 80));
      onSaved(url); toast.success("Thumbnail saved to media and set as cover image");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(null); }
  }

  return (
    <section className="mt-6 rounded-sm border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ImagePlus className="h-5 w-5 text-brand" /> Thumbnail designer</h2>
      <canvas ref={canvas} width={W} height={H} className="mt-3 mx-auto aspect-[4/5] w-full max-w-md rounded-sm border" aria-label="Thumbnail preview" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="th">Headline on image</Label><Input id="th" value={text} maxLength={120} onChange={(e) => setText(e.target.value)} /></div>
        <div><Label htmlFor="tl">Category label</Label><Input id="tl" value={label} maxLength={24} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><Label>Zoom ({zoom.toFixed(1)}×)</Label><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full" /></div>
        <div><Label>Headline size ({size}px)</Label><input type="range" min={36} max={90} step={2} value={size} onChange={(e) => setSize(+e.target.value)} className="w-full" /></div>
        <div><Label htmlFor="tpn">Person's name (optional)</Label><Input id="tpn" value={person} maxLength={40} onChange={(e) => setPerson(e.target.value)} /></div>
        <div><Label htmlFor="tdt">Date</Label><Input id="tdt" value={date} maxLength={20} onChange={(e) => setDate(e.target.value)} /></div>
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
      <Button variant="outline" className="mt-3 mr-2" onClick={download}><Download className="h-4 w-4" /> Download PNG (1080×1350)</Button>
      <Button className="mt-3 bg-brand text-brand-foreground hover:bg-brand/90" disabled={!!busy} onClick={save}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & use as cover</Button>
    </section>
  );
}
