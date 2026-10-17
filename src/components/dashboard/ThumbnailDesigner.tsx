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

const W = 1280, H = 720;
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

  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { let off = false; if (!src) { setPhoto(null); return; } loadImg(src).then((i) => { if (!off) setPhoto(i); }).catch(() => { if (!off) setPhoto(null); }); return () => { off = true; }; }, [src]);
  useEffect(() => { let off = false; loadImg(logo.url).then((i) => { if (!off) setLogoImg(i); }).catch(() => {}); return () => { off = true; }; }, []);

  useEffect(() => {
    const c = canvas.current; if (!c) return; const ctx = c.getContext("2d")!;
    const poly = (pts: [number, number][], col: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
    // photo (full frame)
    if (photo) {
      const s = Math.max(W / photo.width, H / photo.height) * zoom;
      const dw = photo.width * s, dh = photo.height * s;
      ctx.drawImage(photo, (W - dw) * (ox / 100), (H - dh) * (oy / 100), dw, dh);
    }
    // header bar
    poly([[0, 0], [W, 0], [W, 96], [0, 96]], "rgba(8,32,78,0.92)");
    poly([[930, 0], [W, 0], [W, 96], [890, 96]], RED);
    ctx.fillStyle = WHITE;
    ctx.font = "900 34px Archivo, Arial, sans-serif"; ctx.fillText("SERBIA 15 ONLINE NEWS", 130, 50);
    ctx.font = "800 22px Archivo, Arial, sans-serif"; ctx.fillText("TASHAR AL'UMMAH", 130, 80);
    ctx.textAlign = "center"; ctx.font = "900 30px Archivo, Arial, sans-serif"; ctx.fillText("NEWS UPDATE", 1090, 60); ctx.textAlign = "left";
    if (logoImg) {
      ctx.save(); ctx.beginPath(); ctx.arc(64, 64, 54, 0, 7); ctx.fillStyle = WHITE; ctx.fill(); ctx.clip();
      ctx.drawImage(logoImg, 12, 12, 104, 104); ctx.restore();
      ctx.lineWidth = 4; ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.arc(64, 64, 54, 0, 7); ctx.stroke();
    }
    // date badge
    ctx.font = "800 24px Archivo, Arial, sans-serif"; const dw2 = ctx.measureText(date).width + 40;
    poly([[W - dw2 - 50, 120], [W - 30, 120], [W - 30, 162], [W - dw2 - 30, 162]], RED);
    ctx.fillStyle = WHITE; ctx.fillText(date, W - dw2 - 22, 150);
    // headline box (lower third)
    const hx = 40, hy = 430, hw = W - 80, hh = 190;
    ctx.font = "900 26px Archivo, Arial, sans-serif"; const cl = label.toUpperCase(); const cw = ctx.measureText(cl).width + 44;
    poly([[hx, hy - 46], [hx + cw + 24, hy - 46], [hx + cw, hy], [hx, hy]], RED);
    ctx.fillStyle = WHITE; ctx.fillText(cl, hx + 20, hy - 14);
    if (person.trim()) {
      const pn = person.toUpperCase(); const nw = ctx.measureText(pn).width + 44;
      poly([[hx + hw - nw - 20, hy - 46], [hx + hw, hy - 46], [hx + hw, hy], [hx + hw - nw, hy]], WHITE);
      ctx.fillStyle = NAVY; ctx.fillText(pn, hx + hw - nw + 12, hy - 14);
    }
    ctx.fillStyle = "rgba(8,32,78,0.94)"; ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = RED; ctx.fillRect(hx, hy, 12, hh);
    let fs = Math.min(size, 64); let lines: string[] = [];
    for (; fs >= 24; fs -= 2) { ctx.font = `900 ${fs}px Archivo, Arial, sans-serif`; lines = wrap(ctx, text || "Headline", hw - 70); if (lines.length * fs * 1.15 <= hh - 30) break; }
    const lh = fs * 1.15; const y0 = hy + (hh - lines.length * lh) / 2 + fs * 0.88;
    ctx.fillStyle = WHITE; lines.forEach((l, i) => ctx.fillText(l, hx + 36, y0 + i * lh));
    // footer
    poly([[0, 640], [W, 640], [W, H], [0, H]], NAVY);
    poly([[900, 640], [W, 640], [W, H], [870, H]], RED);
    ctx.font = "900 22px Arial, sans-serif"; ctx.textAlign = "center";
    ([["f", 60], ["X", 115], ["▶", 170]] as [string, number][]).forEach(([t, x]) => { ctx.beginPath(); ctx.arc(x, 680, 22, 0, 7); ctx.fillStyle = WHITE; ctx.fill(); ctx.fillStyle = NAVY; ctx.fillText(t, x, 688); });
    ctx.textAlign = "left"; ctx.fillStyle = WHITE; ctx.font = "800 26px Archivo, Arial, sans-serif"; ctx.fillText("|  @Serbia15OnlineNews", 210, 690);
    ctx.textAlign = "center"; ctx.font = "900 28px Archivo, Arial, sans-serif"; ctx.fillText("TASHAR AL'UMMAH", 1080, 690); ctx.textAlign = "left";
  }, [photo, logoImg, text, label, zoom, ox, oy, size, person, date]);

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
      <canvas ref={canvas} width={W} height={H} className="mt-3 mx-auto aspect-video w-full rounded-sm border" aria-label="Thumbnail preview" />
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
      <Button variant="outline" className="mt-3 mr-2" onClick={download}><Download className="h-4 w-4" /> Download PNG (1280×720)</Button>
      <Button className="mt-3 bg-brand text-brand-foreground hover:bg-brand/90" disabled={!!busy} onClick={save}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & use as cover</Button>
    </section>
  );
}
