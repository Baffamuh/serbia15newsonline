import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | Serbia 15" },
      { name: "description", content: "Choose a new password for your Serbia 15 newsroom account." },
      { property: "og:title", content: "Reset password — Serbia 15" },
      { property: "og:description", content: "Reset your Serbia 15 newsroom password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-deep px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-sm bg-card p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return toast.error("Password must be at least 8 characters");
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password: pw });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Password updated");
          navigate({ to: "/dashboard" });
        }}
      >
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <div><Label htmlFor="np">New password</Label><Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </div>
  );
}
