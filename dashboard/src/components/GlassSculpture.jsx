import React, { useEffect, useRef, useState } from "react";
import { Orbit, ShieldCheck, Sparkles } from "lucide-react";

const perspectives = [
  {
    title: "Chief of Staff",
    icon: Sparkles,
    detail: "One conversation. The right minds, brought together.",
  },
  {
    title: "The Council",
    icon: ShieldCheck,
    detail: "Seven perspectives. One decision you can review.",
  },
  {
    title: "The colleges",
    icon: Orbit,
    detail: "74 specialist definitions across 14 fields of knowledge.",
  },
];
export default function GlassSculpture({ moving }) {
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [visible, setVisible] = useState(true),
    [active, setActive] = useState(0);
  const host = useRef(null),
    model = useRef(null);
  useEffect(() => {
    let alive = true;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting)
        import("@google/model-viewer")
          .then(() => {
            if (alive) setReady(true);
          })
          .catch(() => {
            if (alive) setFailed(true);
          });
    });
    observer.observe(host.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!model.current) return;
    const el = model.current,
      onError = () => setFailed(true);
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, [ready]);
  return (
    <div className="gl-observatory" ref={host} data-perspective={active}>
      <div className="gl-orbital-halo" aria-hidden="true" />
      <div className="gl-orbital-coordinate gl-coordinate-top">
        <span>AE—01</span>
        <span>INSTITUTIONAL CORE</span>
      </div>
      <div className="gl-sculpture" aria-label="Interactive orbital sculpture">
        {ready && !failed ? (
          <model-viewer
            ref={model}
            src={import.meta.env.BASE_URL + "glass-citadel-pearl.glb"}
            alt="A glass core surrounded by three orbital rings and seven Council nodes"
            camera-controls
            auto-rotate={moving && visible ? true : undefined}
            rotation-per-second="10deg"
            shadow-intensity="0"
            environment-image="neutral"
            exposure="1.1"
            camera-orbit={`${active * 50}deg 65deg 110%`}
            interaction-prompt="none"
            touch-action="pan-y"
          />
        ) : (
          <div
            className="gl-css-sculpture"
            role="img"
            aria-label="Glass orbital sculpture"
          >
            <i />
            <i />
            <i />
            <b />
          </div>
        )}
      </div>
      <span className="gl-orbit-tag gl-tag-left">
        <i /> Curiosity, coordinated.
      </span>
      <span className="gl-orbit-tag gl-tag-right">
        <ShieldCheck size={14} /> Human authority
      </span>
      <div className="gl-orbital-coordinate gl-coordinate-bottom">
        <span>DRAG TO EXPLORE</span>
        <span>THREE TIERS · ONE INSTITUTION</span>
      </div>
      <div
        className="gl-perspectives"
        role="group"
        aria-label="Explore the institution"
      >
        {perspectives.map(({ title, icon: Icon }, index) => (
          <button
            type="button"
            key={title}
            aria-pressed={active === index}
            onClick={() => setActive(index)}
          >
            <Icon size={14} />
            {title}
          </button>
        ))}
      </div>
      <p className="gl-perspective-detail" aria-live="polite">
        {perspectives[active].detail}
      </p>
    </div>
  );
}
