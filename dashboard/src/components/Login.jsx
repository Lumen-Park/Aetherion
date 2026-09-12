import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Mail,
  Smartphone,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  LoaderCircle,
  Globe2,
  Sun,
  Moon,
  Pause,
  Play,
  Sparkles,
  Layers3,
  Orbit,
} from "lucide-react";
import { authAPI, apiClient } from "../api/client";
import { identity } from "../api/identity";
import {
  countries,
  normalizePhone,
  regionName,
  suggestedCountry,
} from "../lib/experience";
import useLocalMoment from "../hooks/useLocalMoment";
import CountryPicker from "./CountryPicker";
import GlassSculpture from "./GlassSculpture";
import "./login-glass.css";

const chapters = [
  {
    id: "01",
    icon: Sparkles,
    title: "Start with a conversation.",
    text: "A question, a research brief, an ambitious idea. Your Chief of Staff connects your intent to the right specialist perspectives.",
    label: "ORCHESTRATION",
    cards: ["Your idea", "Chief of Staff", "A considered plan"],
  },
  {
    id: "02",
    icon: Orbit,
    title: "Bring different minds together.",
    text: "Explore 14 colleges and 74 specialist definitions. Research, engineering, creative work and analysis share one conversation workspace.",
    label: "SPECIALIST COLLEGES",
    cards: ["Research", "Engineering", "Creative thinking"],
  },
  {
    id: "03",
    icon: ShieldCheck,
    title: "Keep the final say.",
    text: "Seven advisory judges review the work. Inspect their verdicts, surface disagreement, and make the human decision at the checkpoint.",
    label: "COUNCIL REVIEW",
    cards: ["Seven perspectives", "A traceable verdict", "Your decision"],
  },
];
export default function Login({ onLogin }) {
  const [method, setMethod] = useState("email"),
    [intent, setIntent] = useState("signin");
  const [value, setValue] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  const [country, setCountry] = useState(() => {
    try {
      const saved = localStorage.getItem("aetherion_phone_country");
      if (countries.some((c) => c.code === saved)) return saved;
    } catch {}
    return suggestedCountry(navigator.languages);
  });
  const [regionSource, setRegionSource] = useState("device");
  const [motion, setMotion] = useState(true),
    [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [visible, setVisible] = useState(!document.hidden);
  const page = useRef(null),
    card = useRef(null),
    callback = useRef(onLogin),
    countryTouched = useRef(false),
    lock = useRef(false),
    input = useRef(null);
  const moment = useLocalMoment(),
    moving = motion && !reduced && visible,
    DayIcon = moment.period === "evening" ? Moon : Sun;
  callback.current = onLogin;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => setReduced(media.matches),
      visibility = () => setVisible(!document.hidden);
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let saved;
    try {
      saved = localStorage.getItem("aetherion_phone_country");
    } catch {}
    if (countries.some((item) => item.code === saved)) {
      setRegionSource("saved");
      return;
    }
    fetch(
      (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "") +
        "/api/experience/context",
      { signal: controller.signal, credentials: "same-origin" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (
          !countryTouched.current &&
          countries.some((item) => item.code === data?.country)
        ) {
          setCountry(data.country);
          setRegionSource("network");
        }
      })
      .catch(() => {});
    const timeout = setTimeout(() => controller.abort(), 3500);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => {
    if (sent) input.current?.focus({ preventScroll: true });
  }, [sent]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    page.current
      .querySelectorAll(".gl-reveal")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const setRegion = (next) => {
    countryTouched.current = true;
    setCountry(next);
    setRegionSource("chosen");
    setError("");
    try {
      localStorage.setItem("aetherion_phone_country", next);
    } catch {}
  };
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
    identity.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else if (data.session) {
          try {
            await accept(data.session);
          } catch {
            if (alive)
              setError("Account verification failed. Please sign in again.");
          }
        }
      })
      .catch(() => {
        if (alive)
          setError("Unable to restore your session. Please sign in again.");
      });
    return () => {
      alive = false;
    };
  }, []);
  const requestCode = async (target) => {
    const { error } = await identity.auth.signInWithOtp({
      ...target,
      options: { shouldCreateUser: intent === "signup" },
    });
    if (error) throw error;
    setCode("");
    setCooldown(60);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
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
      const phone =
        method === "phone" && !sent ? normalizePhone(value, country) : null;
      if (!identity)
        throw Error(
          "Account access is not connected yet. Your administrator needs to enable email, SMS and social sign-in.",
        );
      if (sent) {
        const { data, error } = await identity.auth.verifyOtp({
          ...sent.target,
          token: code.trim(),
          type: sent.method === "phone" ? "sms" : "email",
        });
        if (error) throw error;
        if (!data.session)
          throw Error("Verification did not create a session. Please retry.");
        await accept(data.session);
      } else {
        if (cooldown)
          throw Error(
            `Please wait ${cooldown} seconds before requesting another code.`,
          );
        const target = phone
          ? { phone: phone.number }
          : { email: value.trim() };
        await requestCode(target);
        if (phone) setRegion(phone.country);
        setSent({
          target,
          method,
          display: phone ? phone.display : value.trim(),
        });
      }
    } catch (e) {
      setError(
        e.response?.data?.detail ||
          e.message ||
          "Unable to sign in. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const resend = async () => {
    if (cooldown || lock.current || !sent) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await requestCode(sent.target);
      input.current?.focus();
    } catch (e) {
      setError(e.message || "Unable to resend. Please retry.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const social = async (provider) => {
    if (lock.current) return;
    setError("");
    if (!identity) {
      setError("Google and GitHub access are awaiting administrator setup.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const { error } = await identity.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            window.location.origin + import.meta.env.BASE_URL + "workspace",
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e.message || "Unable to connect. Please retry.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const choose = (next) => {
    if (busy) return;
    setMethod(next);
    setValue("");
    setCode("");
    setSent(null);
    setError("");
  };
  return (
    <main
      ref={page}
      className={`gl-login ${moving ? "gl-motion" : "gl-still"}`}
    >
      <div className="gl-aurora" aria-hidden="true" />
      <div className="gl-grid" aria-hidden="true" />
      <header className="gl-header">
        <a href={import.meta.env.BASE_URL} className="gl-wordmark">
          <span>◈</span>
          <b>
            AETHERION<small>AN INSTITUTION FOR YOUR IDEAS</small>
          </b>
        </a>
        <nav aria-label="Introduction">
          <a href="#gl-institution">The institution</a>
          <a href="#gl-access">
            Your workspace <ArrowUpRight size={13} />
          </a>
        </nav>
        <button
          className="gl-motion-toggle"
          onClick={() => setMotion((v) => !v)}
          disabled={reduced}
          aria-pressed={moving}
          aria-label={moving ? "Pause motion" : "Enable motion"}
        >
          {moving ? <Pause size={13} /> : <Play size={13} />}
          <span>
            {reduced
              ? "Reduced motion"
              : moving
                ? "Pause motion"
                : "Enable motion"}
          </span>
        </button>
      </header>
      <div className="gl-hero">
        <section className="gl-stage" aria-label="Aetherion introduction">
          <div className="gl-stage-caption">
            <span className="gl-dot" /> INDEPENDENT MINDS. SHARED AMBITION.
          </div>
          <h1>
            A little curiosity.
            <br />
            <em>A whole new world.</em>
          </h1>
          <p className="gl-intro">
            Your ideas deserve an entire institution.
            <br />
            Meet the workspace that brings it together.
          </p>
          <a className="gl-mobile-entry" href="#gl-access">
            Enter your workspace <ArrowDown size={15} />
          </a>
          <GlassSculpture moving={moving} />
        </section>
        <section
          className="gl-access"
          id="gl-access"
          aria-label="Account access"
        >
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
                <DayIcon size={20} />
              </span>
              <span>
                {moment.time}
                <small>YOUR LOCAL TIME</small>
              </span>
              <i />
            </div>
            {!sent && (
              <p className="gl-greeting">
                {moment.greeting}. {moment.prompt}
              </p>
            )}
            <h2>
              {sent
                ? "A small step.\nThen, possibility."
                : intent === "signup"
                  ? "Make space for\nsomething great."
                  : "Welcome to\nyour next chapter."}
            </h2>
            <p className="gl-subtitle">
              {sent
                ? `Enter the verification code sent to ${sent.display}.`
                : "Your workspace. Your perspective. Your pace."}
            </p>
            {!sent && (
              <>
                <div
                  className="gl-intent"
                  role="group"
                  aria-label="Account action"
                >
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={intent === "signin"}
                    onClick={() => {
                      setIntent("signin");
                      setError("");
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={intent === "signup"}
                    onClick={() => {
                      setIntent("signup");
                      if (method === "key") choose("email");
                      setError("");
                    }}
                  >
                    Create account
                  </button>
                </div>
                <div className="gl-social">
                  <button onClick={() => social("google")} disabled={busy}>
                    <span className="gl-google" aria-hidden="true">
                      G
                    </span>
                    Continue with Google
                  </button>
                  <button
                    aria-label="Continue with GitHub"
                    onClick={() => social("github")}
                    disabled={busy}
                  >
                    <span className="gl-github-label">GitHub</span>
                  </button>
                </div>
                <div className="gl-divider">
                  <span>
                    or{" "}
                    {intent === "signup"
                      ? "create an account with"
                      : "sign in with"}
                  </span>
                </div>
                <div
                  className="gl-tabs"
                  role="group"
                  aria-label="Sign-in method"
                >
                  {[
                    ["email", Mail, "Email"],
                    ["phone", Smartphone, "Phone"],
                    ...(intent === "signin"
                      ? [["key", KeyRound, "Access key"]]
                      : []),
                  ].map(([id, Icon, label]) => (
                    <button
                      type="button"
                      key={id}
                      disabled={busy}
                      aria-pressed={method === id}
                      onClick={() => choose(id)}
                    >
                      <Icon size={14} />
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
                      ? "Workspace access key"
                      : "Email address"}
              </label>
              <div
                className={
                  method === "phone" && !sent ? "gl-phone-field" : undefined
                }
              >
                {method === "phone" && !sent && (
                  <CountryPicker
                    value={country}
                    onChange={setRegion}
                    disabled={busy}
                  />
                )}
                <input
                  ref={input}
                  id="gl-identity"
                  type={
                    sent
                      ? "text"
                      : method === "email"
                        ? "email"
                        : method === "key"
                          ? "password"
                          : "tel"
                  }
                  autoComplete={
                    sent
                      ? "one-time-code"
                      : method === "phone"
                        ? "tel-national"
                        : method === "email"
                          ? "email"
                          : "current-password"
                  }
                  inputMode={
                    sent ? "numeric" : method === "phone" ? "tel" : undefined
                  }
                  pattern={sent ? "[0-9]{6,8}" : undefined}
                  minLength={sent ? 6 : undefined}
                  maxLength={sent ? 8 : method === "phone" ? 40 : 320}
                  disabled={busy}
                  aria-invalid={!!error}
                  aria-describedby="gl-field-note"
                  value={sent ? code : value}
                  onChange={(e) => {
                    if (sent) setCode(e.target.value.replace(/\D/g, ""));
                    else {
                      if (method === "phone") countryTouched.current = true;
                      setValue(e.target.value);
                    }
                    setError("");
                  }}
                  placeholder={
                    sent
                      ? "Enter your code"
                      : method === "phone"
                        ? "Your mobile number"
                        : method === "key"
                          ? "Your administrator-issued key"
                          : "you@example.com"
                  }
                  required
                />
              </div>
              <p className="gl-field-note" id="gl-field-note">
                {sent
                  ? "Keep this page open while you check your code."
                  : method === "phone"
                    ? `${regionName(country)} · ${regionSource === "network" ? "Suggested from your network" : regionSource === "device" ? "Suggested region" : "Your selected region"}. Change anytime.`
                    : method === "key"
                      ? "Use the access key supplied by your administrator."
                      : "We’ll send you a code. One less password to remember."}
              </p>
              {error && (
                <div className="gl-error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="gl-primary"
                disabled={busy || (!sent && cooldown > 0 && method !== "key")}
              >
                {busy && <LoaderCircle className="gl-spinner" size={18} />}
                {busy
                  ? "Connecting…"
                  : sent
                    ? "Verify and continue"
                    : method === "key"
                      ? "Open workspace"
                      : cooldown
                        ? `Send again in ${cooldown}s`
                        : "Send verification code"}
                <ArrowUpRight size={17} />
              </button>
            </form>
            {sent && (
              <div className="gl-code-actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    setSent(null);
                    setCode("");
                    setError("");
                  }}
                >
                  <ChevronLeft size={14} />
                  Change {sent.method}
                </button>
                <button disabled={cooldown > 0 || busy} onClick={resend}>
                  {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            )}
            {!identity && (
              <p className="gl-setup">
                <i /> Account access awaits provider setup.
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
              <ShieldCheck size={13} />
              You’re always in control.
            </div>
          </div>
          <p className="gl-access-caption">
            <Globe2 size={12} /> A global perspective. A personal workspace.
          </p>
        </section>
      </div>
      <a className="gl-scroll-cue" href="#gl-institution">
        <span>THERE’S A WHOLE INSTITUTION BEHIND THE CONVERSATION</span>
        <ArrowDown size={16} />
      </a>
      <section
        className="gl-institution"
        id="gl-institution"
        aria-labelledby="gl-institution-title"
      >
        <div className="gl-section-heading gl-reveal">
          <span className="gl-eyebrow">THOUGHTFULLY CONNECTED</span>
          <h2 id="gl-institution-title">
            One space.
            <br />
            <em>Extraordinary breadth.</em>
          </h2>
          <p>
            Three layers of intelligence, with you at the center.
            <br />
            Explore the structure behind Aetherion.
          </p>
        </div>
        <div className="gl-chapters">
          {chapters.map(({ id, icon: Icon, title, text, label, cards }) => (
            <article className="gl-chapter gl-reveal" key={id}>
              <div className="gl-chapter-head">
                <span>
                  {id} / {label}
                </span>
                <Icon size={20} />
              </div>
              <div className="gl-layer-art" aria-hidden="true">
                {cards.map((item, i) => (
                  <div key={item} style={{ "--layer": i }}>
                    <span>0{i + 1}</span>
                    {item}
                    <i />
                  </div>
                ))}
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="gl-return gl-reveal">
          <Layers3 size={25} />
          <p>
            The next chapter starts
            <br />
            <em>with your first thought.</em>
          </p>
          <a href="#gl-access">
            Enter your workspace <ArrowUpRight size={18} />
          </a>
        </div>
      </section>
      <footer className="gl-footer">
        <a href={import.meta.env.BASE_URL} className="gl-wordmark">
          ◈ AETHERION
        </a>
        <span>HUMAN CURIOSITY. INSTITUTIONAL INTELLIGENCE.</span>
        <span>
          {moment.date} · {moment.zone.replaceAll("_", " ")}
        </span>
      </footer>
    </main>
  );
}
