import React, { useEffect, useRef } from "react";

/** A lightweight, pointer-responsive projected sculpture; no external assets. */
export default function OrbitalCore({ active = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame,
      time = 0,
      visible = true,
      width = 600,
      height = 320;
    const pointer = { x: 0, y: 0 };
    const drift = { x: 0, y: 0 };
    const particles = Array.from({ length: 44 }, (_, index) => ({
      x: Math.sin(index * 4.17) * 265,
      y: Math.cos(index * 2.73) * 180,
      z: Math.sin(index * 1.31) * 240,
      size: 0.35 + (index % 4) * 0.18,
    }));
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);
    const move = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width - 0.5;
      pointer.y = (e.clientY - r.top) / r.height - 0.5;
    };
    const leave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      if (!media.matches) time += active ? 0.006 : 0.002;
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width / 580, height / 430);
      drift.x += (pointer.x - drift.x) * 0.06;
      drift.y += (pointer.y - drift.y) * 0.06;
      const project = (x, y, z) => {
        const a = -0.43 + drift.y * 0.35,
          b = time + drift.x * 0.4;
        const xx = x * Math.cos(b) + z * Math.sin(b),
          zz = -x * Math.sin(b) + z * Math.cos(b);
        const yy = y * Math.cos(a) - zz * Math.sin(a),
          depth = y * Math.sin(a) + zz * Math.cos(a);
        const p = 620 / (620 + depth);
        return [width / 2 + xx * p * scale, height / 2 + yy * p * scale, depth];
      };
      const glow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        155 * scale,
      );
      glow.addColorStop(0, "rgba(210,185,128,.14)");
      glow.addColorStop(0.55, "rgba(165,143,94,.035)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      for (const particle of particles) {
        const [x, y, depth] = project(particle.x, particle.y, particle.z);
        const alpha = Math.max(0.05, Math.min(0.38, 0.2 - depth / 1700));
        ctx.beginPath();
        ctx.arc(x, y, particle.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(164, 206, 190, ${alpha})`;
        ctx.fill();
      }
      for (let ring = 0; ring < 36; ring++) {
        ctx.beginPath();
        for (let segment = 0; segment <= 160; segment++) {
          const u = (segment / 160) * Math.PI * 2,
            v = (ring / 36) * Math.PI * 2;
          const r = 89 + 26 * Math.cos(v);
          const [x, y] = project(
            r * Math.cos(u),
            26 * Math.sin(v),
            r * Math.sin(u),
          );
          segment ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = `rgba(219,199,149,${0.1 + 0.3 * Math.max(0, Math.sin((ring / 36) * Math.PI * 2))})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        for (let n = 0; n <= 160; n++) {
          const a = (n / 160) * Math.PI * 2,
            r = 158 + ring * 17;
          const [x, y] = project(
            Math.cos(a) * r,
            Math.sin(a) * r * Math.sin(0.6 + ring * 0.8),
            Math.sin(a) * r * Math.cos(0.6 + ring * 0.8),
          );
          n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = "rgba(193,177,141,.17)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      const [coreX, coreY] = project(0, 0, 0);
      const coreRadius = 28 * scale;
      const core = ctx.createRadialGradient(
        coreX - coreRadius * 0.35,
        coreY - coreRadius * 0.4,
        2,
        coreX,
        coreY,
        coreRadius,
      );
      core.addColorStop(0, "rgba(250, 239, 202, .72)");
      core.addColorStop(0.22, "rgba(215, 204, 161, .32)");
      core.addColorStop(0.62, "rgba(126, 174, 157, .12)");
      core.addColorStop(1, "rgba(126, 174, 157, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(239, 225, 183, .35)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreRadius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(155, 203, 186, .28)";
      ctx.beginPath();
      ctx.arc(
        coreX,
        coreY,
        coreRadius * 0.86,
        time * 1.8,
        time * 1.8 + Math.PI * 1.15,
      );
      ctx.stroke();
      for (let n = 0; n < 7; n++) {
        const a = (n / 7) * Math.PI * 2,
          [x, y] = project(
            Math.cos(a) * 176,
            Math.sin(a) * 176 * Math.sin(1.4),
            Math.sin(a) * 176 * Math.cos(1.4),
          );
        ctx.beginPath();
        ctx.arc(x, y, n === 0 ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = n === 0 ? "#d9c395" : "#83b5a0";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, [active]);
  return (
    <canvas
      className="orbital-core"
      ref={ref}
      role="img"
      aria-label="Rotating golden orbital sculpture representing the Council’s seven members"
    />
  );
}
