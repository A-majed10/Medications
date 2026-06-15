import React, { useState, useEffect, useRef } from "react";
import { Stethoscope, Loader2, ChevronRight, Mail, Lock, User, GraduationCap } from "lucide-react";
import { api, setToken, GOOGLE_CLIENT_ID } from "./api.js";

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.ui-root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.disp{font-family:'Newsreader',Georgia,serif;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
.pine{background:#15564b;color:#fff;}.pine:hover:not(:disabled){background:#0f3f37;}
.pine:disabled{opacity:.6;cursor:not-allowed;}
.field{transition:border-color .15s,box-shadow .15s;}
.field:focus{outline:none;border-color:#15564b;box-shadow:0 0 0 3px rgba(21,86,75,.12);}
`;

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [facultyCode, setFacultyCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleRef = useRef(null);

  async function finish(promise) {
    setBusy(true); setError("");
    try {
      const { token, user } = await promise;
      setToken(token);
      onAuthed(user);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (mode === "signup") finish(api.signup({ email, password, name, facultyCode }));
    else finish(api.login({ email, password }));
  }

  // Render the official Google button when the GIS script is ready.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (window.google && window.google.accounts && googleRef.current) {
        clearInterval(id);
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => finish(api.google({ credential: resp.credential, facultyCode })),
        });
        window.google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", width: 320 });
      }
      if (tries > 40) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyCode]);

  return (
    <div className="ui-root flex min-h-screen items-center justify-center bg-stone-100 px-4 text-stone-900">
      <style>{STYLE}</style>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-7">
        <div className="flex items-center gap-2.5">
          <span className="pine flex h-9 w-9 items-center justify-center rounded-lg"><Stethoscope className="h-5 w-5" /></span>
          <div className="leading-tight">
            <p className="disp text-lg font-semibold tracking-tight">Hakīm</p>
            <p className="text-xs text-stone-500">OSCE clinical-skills trainer</p>
          </div>
        </div>

        <h1 className="disp mt-6 text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {mode === "login" ? "Sign in to practise and track your progress." : "Track every attempt, score and transcript over time."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <Field icon={User}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="field w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-base" /></Field>
          )}
          <Field icon={Mail}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="field w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-base" /></Field>
          <Field icon={Lock}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Password (min 8 characters)" : "Password"} required className="field w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-base" /></Field>
          {mode === "signup" && (
            <Field icon={GraduationCap}><input value={facultyCode} onChange={(e) => setFacultyCode(e.target.value)} placeholder="Faculty code (optional)" className="field w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-base" /></Field>
          )}

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={busy} className="pine flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === "login" ? "Sign in" : "Create account"}<ChevronRight className="h-5 w-5" /></>}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
            <div ref={googleRef} className="flex justify-center" />
          </>
        )}

        <p className="mt-5 text-center text-sm text-stone-500">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} className="font-semibold text-[#15564b]">
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      {children}
    </div>
  );
}
