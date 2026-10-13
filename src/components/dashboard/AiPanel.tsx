import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AI_TASKS, runNewsroomAI, type AiTask } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Target = "title" | "summary" | "body";
const APPLY: Partial<Record<AiTask, Target>> = { rewrite: "body", summary: "summary", to_hausa: "body", to_english: "body", transcript: "body" };

export function AiPanel({ title, summary, body, onApply }: {
  title: string; summary: string; body: string;
  onApply: (field: Target, value: string) => void;
}) {
  const run = useServerFn(runNewsroomAI);
  const [task, setTask] = useState<AiTask>("headlines");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");

  async function go() {
    setBusy(true); setOut("");
    try {
      const text = task === "transcript" ? notes : [summary, body].filter(Boolean).join("\n\n");
      const r = await run({ data: { task, title, text } });
      if (r.ok) setOut(r.text); else toast.error(r.error);
    } catch (e) { toast.error(e instanceof Error ? e.message : "AI request failed"); }
    finally { setBusy(false); }
  }

  const target = APPLY[task];
  function apply() {
    if (task === "transcript") {
      const [h, ...rest] = out.split(/\n{2,}/);
      if (h && !title) onApply("title", h.replace(/^headline:\s*/i, "").slice(0, 250));
      onApply("body", rest.join("\n\n"));
    } else if (target) onApply(target, target === "summary" ? out.slice(0, 600) : out);
    toast.success("Applied to the draft — review before saving. Your original stays until you save.");
  }

  return (
    <section className="mt-6 rounded-sm border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-5 w-5 text-brand" /> AI newsroom assistant</h2>
      <p className="mt-1 text-sm text-muted-foreground">Works from your headline and text only — it never adds facts. Results are suggestions; nothing is saved or published until you do it.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select aria-label="AI tool" value={task} onChange={(e) => { setTask(e.target.value as AiTask); setOut(""); }} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm">
          {Object.entries(AI_TASKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button onClick={go} disabled={busy} className="bg-navy text-navy-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate</Button>
      </div>
      {task === "transcript" && (
        <Textarea className="mt-2" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste the interview transcript or your field notes here…" />
      )}
      {out && (
        <div className="mt-3">
          <Textarea rows={8} value={out} onChange={(e) => setOut(e.target.value)} aria-label="AI result (editable)" />
          <div className="mt-2 flex flex-wrap gap-2">
            {(target || task === "transcript") && <Button size="sm" onClick={apply}>Use in story</Button>}
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(out); toast.success("Copied"); }}>Copy</Button>
          </div>
        </div>
      )}
    </section>
  );
}
