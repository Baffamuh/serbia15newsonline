import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Login | Serbia 15 Online News" },
      { name: "description", content: "Sign in or register for the Serbia 15 newsroom." },
      { property: "og:title", content: "Serbia 15 Staff Login" },
      { property: "og:description", content: "Newsroom access for Serbia 15 staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailS = z.string().trim().email("Enter a valid email").max(255);
const passS = z.string().min(8, "Password must be at least 8 characters").max(72);

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const em = emailS.safeParse(email);
    if (!em.success) return toast.error(em.error.issues[0].message);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(em.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("If that email is registered, a password reset link has been sent.");
        return;
      }
      const pw = passS.safeParse(password);
      if (!pw.success) return toast.error(pw.error.issues[0].message);
      if (mode === "up") {
        const nm = z.string().trim().min(2, "Enter your full name").max(100).safeParse(name);
        if (!nm.success) return toast.error(nm.error.issues[0].message);
        const { data, error } = await supabase.auth.signUp({
          email: em.data,
          password: pw.data,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: nm.data } },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email and click the confirmation link to activate your account. An administrator will then approve your newsroom access.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-deep px-4 py-10">
      <div className="w-full max-w-md rounded-sm bg-card p-8 shadow-xl">
        <Link to="/" className="flex flex-col items-center gap-2">
          <img src={logo.url} alt="Serbia 15 Online News" className="h-20 w-20 rounded-full" />
          <span className="font-display text-xl font-black text-navy">Serbia 15 Newsroom</span>
        </Link>
        <h1 className="mt-6 text-center font-display text-2xl font-bold">
          {mode === "in" ? "Staff sign in" : mode === "up" ? "Register as staff" : "Reset password"}
        </h1>
        {notice ? (
          <p className="mt-6 rounded-sm bg-secondary p-4 text-sm">{notice}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "up" && (
              <div><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>
            )}
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
            {mode !== "forgot" && (
              <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} required /></div>
            )}
            <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={busy}>
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
            </Button>
            {mode !== "forgot" && (
              <Button type="button" variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
            )}
          </form>
        )}
        <div className="mt-6 space-y-2 text-center text-sm">
          {mode === "in" ? (
            <>
              <button className="text-primary underline" onClick={() => { setMode("up"); setNotice(null); }}>New staff member? Register</button><br />
              <button className="text-muted-foreground underline" onClick={() => { setMode("forgot"); setNotice(null); }}>Forgot password?</button>
            </>
          ) : (
            <button className="text-primary underline" onClick={() => { setMode("in"); setNotice(null); }}>Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
