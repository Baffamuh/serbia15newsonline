const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function friendly(status: number, body: string) {
  if (status === 402) return "AI credits are used up. Add credits in your workspace billing settings.";
  if (status === 429) return "The AI service is busy. Please wait a moment and try again.";
  if (status === 403) return "AI access is blocked for this workspace (limit or policy). An admin must check workspace AI settings.";
  if (status === 401) return "AI is not configured on the server.";
  try { const j = JSON.parse(body); return j?.error?.message ?? j?.message ?? `AI request failed (${status})`; } catch { return `AI request failed (${status})`; }
}

/** Streams a Responses-API call and returns the final text. */
export async function aiText(instructions: string, input: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("AI is not configured on the server.", 401);
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions,
      input,
      reasoning: { effort: "low" },
      store: false,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new AiError(friendly(res.status, await res.text()), res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "", refused = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") out += ev.delta;
          else if (ev.type === "response.refusal.delta") refused += ev.delta;
          else if (ev.type === "error" || ev.type === "response.failed") throw new AiError(ev.error?.message ?? ev.response?.error?.message ?? "AI request failed", 500);
        } catch (e) { if (e instanceof AiError) throw e; }
      }
    }
  }
  if (!out.trim()) throw new AiError(refused || "The AI returned no text. Please adjust the input.", 422);
  return out.trim();
}

/** Generates / edits an image. Returns base64 PNG. */
export async function aiImage(prompt: string, imageDataUrl?: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("AI is not configured on the server.", 401);
  const headers = { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" };
  let res: Response;
  if (imageDataUrl) {
    const m = imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) throw new AiError("Invalid source image", 400);
    const bin = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append("model", "openai/gpt-image-2.5-sunburst");
    fd.append("prompt", prompt);
    fd.append("size", "1536x1024");
    fd.append("image", new Blob([bin], { type: m[1] }), "source.png");
    res = await fetch(`${GATEWAY}/images/edits`, { method: "POST", headers, body: fd });
  } else {
    res = await fetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt, size: "1536x1024", n: 1 }),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new AiError(friendly(res.status, text), res.status);
  const j = JSON.parse(text);
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new AiError("The AI returned no image.", 422);
  return b64;
}
