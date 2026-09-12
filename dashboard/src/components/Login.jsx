import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  GitBranch,
  Mail,
  Smartphone,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  LoaderCircle,
} from "lucide-react";
import { authAPI, apiClient } from "../api/client";
import { identity } from "../api/identity";
import "./login-glass.css";

export default function Login({ onLogin }) {
  const [method, setMethod] = useState("email"),
    [value, setValue] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [moving, setMoving] = useState(
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [model, setModel] = useState(false);
  const card = useRef(null),
    callback = useRef(onLogin);
  callback.current = onLogin;
  useEffect(() => {
    import("@google/model-viewer").then(() => setModel(true)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const accept = async (session) => {
    const { data } = await apiClient.post("/auth/identity/exchange", {
      access_token: session.access_token,
    });
    callback.current({
      token: data.access_token,
      workspace: "personal",
      remember: false,
    });
  };
  useEffect(() => {
    if (!identity) return;
    let alive = true;
    identity.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      else if (data.session)
        accept(data.session).catch((e) =>
          setError(
            e.response?.data?.detail ||
              "Account verification failed. Please retry.",
          ),
        );
    });
    return () => {
      alive = false;
    };
  }, []);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (method === "key") {
        const { data } = await authAPI.login({ api_key: value.trim() });
        callback.current({
          token: data.access_token,
          workspace: "personal",
          remember: false,
        });
        return;
      }
      if (!identity)
        throw Error(
          "Account sign-in is awaiting provider setup. You can explore the design preview below.",
        );
      const target =
        method === "phone" ? { phone: value.trim() } : { email: value.trim() };
      if (sent) {
        const { data, error } = await identity.auth.verifyOtp({
          ...target,
          token: code.trim(),
          type: method === "phone" ? "sms" : "email",
        });
        if (error) throw error;
        if (!data.session)
          throw Error("Verification did not create a session. Please retry.");
        await accept(data.session);
      } else {
        const { error } = await identity.auth.signInWithOtp({
          ...target,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setSent(true);
        setCooldown(60);
      }
    } catch (e) {
      setError(
        e.response?.data?.detail ||
          e.message ||
          "Unable to sign in. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const social = async (provider) => {
    setError("");
    if (!identity) {
      setError("Google and GitHub sign-in are awaiting provider setup.");
      return;
    }
    setBusy(true);
    const { error } = await identity.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          window.location.origin + import.meta.env.BASE_URL + "workspace",
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };
  const choose = (next) => {
    setMethod(next);
    setValue("");
    setCode("");
    setSent(false);
    setError("");
  };
  return (
    <main className={`gl-login ${moving ? "gl-motion" : ""}`}>
      <div className="gl-aurora" aria-hidden="true" />
      <div className="gl-grid" aria-hidden="true" />
      <header className="gl-header">
        <a href={import.meta.env.BASE_URL} className="gl-wordmark">
          <span>◈</span> AETHERION <small>INSTITUTIONAL INTELLIGENCE</small>
        </a>
        <button
          className="gl-motion-toggle"
          onClick={() => setMoving((v) => !v)}
          aria-pressed={moving}
        >
          {moving ? "Pause motion" : "Enable motion"}
        </button>
      </header>
      <section className="gl-stage" aria-label="Aetherion introduction">
        <div className="gl-stage-caption">
          <span className="gl-dot" /> A NEW SPACE FOR AMBITION
        </div>
        <div className="gl-sculpture">
          {model ? (
            <model-viewer
              src={import.meta.env.BASE_URL + "glass-citadel.glb"}
              alt="Editable Blender sculpture: glass core, three orbital rings and seven Council nodes"
              camera-controls
              auto-rotate={moving ? true : undefined}
              rotation-per-second="12deg"
              shadow-intensity="0"
              environment-image="neutral"
              exposure="1.4"
              camera-orbit="0deg 75deg 7m"
              interaction-prompt="none"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div
              className="gl-orbit-fallback"
              aria-label="Orbital sculpture loading"
            >
              ◈
            </div>
          )}
        </div>
        <div className="gl-stage-copy">
          <p>Ideas become institutions.</p>
          <h1>
            Your ambition.
            <br />
            <em>A world of intelligence.</em>
          </h1>
          <span>
            A conversation with a whole new perspective.
            <br />A workspace that brings your specialists together.
          </span>
        </div>
        <div className="gl-pill-row">
          <span>14 colleges</span>
          <span>70+ specialist definitions</span>
          <span>Human authority</span>
        </div>
      </section>
      <section className="gl-access">
        <div
          className="gl-card"
          ref={card}
          onPointerMove={(e) => {
            if (!moving || e.pointerType === "touch") return;
            const r = e.currentTarget.getBoundingClientRect();
            card.current.style.setProperty(
              "--px",
              `${((e.clientX - r.left) / r.width) * 100}%`,
            );
            card.current.style.setProperty(
              "--py",
              `${((e.clientY - r.top) / r.height) * 100}%`,
            );
          }}
        >
          <div className="gl-card-top">
            <span className="gl-lock">
              <ShieldCheck size={22} />
            </span>
            <span>YOUR PRIVATE WORKSPACE</span>
          </div>
          <h2>
            {sent
              ? "Check your " + (method === "phone" ? "phone" : "inbox")
              : "Welcome to your next chapter."}
          </h2>
          <p className="gl-subtitle">
            {sent
              ? "Enter the verification code sent to " + value + "."
              : "One account. A constellation of possibilities."}
          </p>
          {!sent && (
            <>
              <div className="gl-social">
                <button onClick={() => social("google")} disabled={busy}>
                  <span className="gl-google">G</span> Google
                </button>
                <button onClick={() => social("github")} disabled={busy}>
                  <GitBranch size={19} /> GitHub
                </button>
              </div>
              <div className="gl-divider">
                <span>or continue with</span>
              </div>
              <div className="gl-tabs" role="group" aria-label="Sign-in method">
                {[
                  ["email", Mail, "Email"],
                  ["phone", Smartphone, "Phone"],
                  ["key", KeyRound, "API key"],
                ].map(([id, Icon, label]) => (
                  <button
                    key={id}
                    aria-pressed={method === id}
                    onClick={() => choose(id)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <form onSubmit={submit}>
            <label htmlFor="gl-identity">
              {sent
                ? "Verification code"
                : method === "phone"
                  ? "Phone number"
                  : method === "key"
                    ? "API key"
                    : "Email address"}
            </label>
            {sent ? (
              <input
                id="gl-identity"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6,8}"
                minLength={6}
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter your code"
                required
                autoFocus
              />
            ) : (
              <input
                id="gl-identity"
                type={
                  method === "email"
                    ? "email"
                    : method === "key"
                      ? "password"
                      : "tel"
                }
                autoComplete={
                  method === "phone"
                    ? "tel"
                    : method === "email"
                      ? "email"
                      : "current-password"
                }
                pattern={method === "phone" ? "\\+[1-9][0-9]{7,14}" : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  method === "phone"
                    ? "+91 98765 43210"
                    : method === "key"
                      ? "Your administrator-issued key"
                      : "you@example.com"
                }
                required
              />
            )}
            <p className="gl-field-note">
              {method === "phone"
                ? "Use international format, without spaces."
                : method === "key"
                  ? "For administrators and existing workspace members."
                  : "A code, not another password to remember."}
            </p>
            {error && (
              <div className="gl-error" role="alert">
                {error}
              </div>
            )}
            <button className="gl-primary" disabled={busy}>
              {busy ? <LoaderCircle className="gl-spinner" size={18} /> : null}
              {busy
                ? "Verifying…"
                : sent
                  ? "Verify and continue"
                  : method === "key"
                    ? "Open workspace"
                    : "Send verification code"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          {sent && (
            <div className="gl-code-actions">
              <button
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
              >
                <ChevronLeft size={14} /> Change {method}
              </button>
              <button
                disabled={cooldown > 0 || busy}
                onClick={(e) => {
                  setSent(false);
                  setCode("");
                }}
              >
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Request another code"}
              </button>
            </div>
          )}
          {!identity && (
            <p className="gl-setup">
              Email, phone, Google and GitHub require administrator setup.
            </p>
          )}
          {import.meta.env.VITE_PUBLIC_DEMO === "true" && (
            <button
              className="gl-demo"
              onClick={() =>
                callback.current({
                  token: "public-demo",
                  workspace: "aetherion-prime",
                  remember: false,
                })
              }
            >
              Explore the design preview <ArrowUpRight size={14} />
            </button>
          )}
          <div className="gl-card-footer">
            <ShieldCheck size={13} /> Your session stays on this device.
          </div>
        </div>
      </section>
      <footer className="gl-footer">
        <span>BUILT FOR THE WAY YOU THINK.</span>
        <span>AETHERION / WORKSPACE 01</span>
      </footer>
    </main>
  );
}
