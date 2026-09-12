import React, { useEffect, useRef, useState } from "react";

const COLLEGES = [
  "Strategy",
  "Research",
  "Engineering",
  "Security",
  "Design",
  "Data",
  "Operations",
  "Governance",
  "Finance",
  "Science",
  "Legal",
  "Growth",
  "Systems",
  "Evaluation",
];

const palette = ["#d5bd8c", "#91b9a8", "#93a9cf", "#c58d83"];

/** A lightweight, browser-rendered institution map with no external scene asset. */
export default function AgentConstellation() {
  const canvasRef = useRef(null);
  const points = useRef([]);
  const hoveredRef = useRef("");
  const [hovered, setHovered] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    let width = 320;
    let height = 240;
    let time = 0;
    let frame;
    let visible = true;

    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const project = (x, y, z) => {
      const yaw = time * 0.18 + tilt.x * 0.45;
      const pitch = -0.35 + tilt.y * 0.24;
      const xx = x * Math.cos(yaw) + z * Math.sin(yaw);
      const zz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const yy = y * Math.cos(pitch) - zz * Math.sin(pitch);
      const depth = y * Math.sin(pitch) + zz * Math.cos(pitch);
      const perspective = 460 / (460 + depth);
      const scale = Math.min(width / 420, height / 300);
      return [
        width / 2 + xx * perspective * scale,
        height / 2 + yy * perspective * scale,
        depth,
      ];
    };
    const move = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width - 0.5;
      pointer.y = (event.clientY - rect.top) / rect.height - 0.5;
      const match = points.current.find(
        (point) =>
          Math.hypot(
            point.x - (event.clientX - rect.left),
            point.y - (event.clientY - rect.top),
          ) < 18,
      );
      hoveredRef.current = match?.name || "";
      setHovered(hoveredRef.current);
    };
    const leave = () => {
      pointer.x = 0;
      pointer.y = 0;
      hoveredRef.current = "";
      setHovered("");
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);

    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      if (!reduced.matches) time += 0.016;
      tilt.x += (pointer.x - tilt.x) * 0.06;
      tilt.y += (pointer.y - tilt.y) * 0.06;
      ctx.clearRect(0, 0, width, height);

      const halo = ctx.createRadialGradient(
        width / 2,
        height / 2,
        4,
        width / 2,
        height / 2,
        height * 0.58,
      );
      halo.addColorStop(0, "rgba(210, 190, 143, .13)");
      halo.addColorStop(0.56, "rgba(130, 174, 157, .035)");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      const nodes = COLLEGES.map((name, index) => {
        const angle = (index / COLLEGES.length) * Math.PI * 2 - Math.PI / 2;
        const orbit = index % 2 ? 116 : 92;
        const [x, y, depth] = project(
          Math.cos(angle) * orbit,
          Math.sin(angle) * orbit * 0.54,
          Math.sin(angle) * orbit,
        );
        return { name, x, y, depth, index };
      });
      points.current = nodes;
      const center = project(0, 0, 0);

      ctx.lineWidth = 0.6;
      nodes.forEach((node, index) => {
        const next = nodes[(index + 1) % nodes.length];
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(center[0], center[1]);
        ctx.strokeStyle = `rgba(171, 196, 172, ${0.07 + Math.max(0, 1 - Math.abs(node.depth) / 260) * 0.12})`;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = "rgba(210, 194, 151, .08)";
        ctx.stroke();
      });

      nodes
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .forEach((node) => {
          const focus = hoveredRef.current === node.name;
          const pulse = focus
            ? 1.9
            : 1 + Math.sin(time * 2.2 + node.index) * 0.22;
          const radius = (focus ? 6.2 : 3.5) * pulse;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = `${palette[node.index % palette.length]}18`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = palette[node.index % palette.length];
          ctx.shadowColor = palette[node.index % palette.length];
          ctx.shadowBlur = focus ? 18 : 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        });

      const coreRadius = 23 * Math.min(width / 420, height / 300);
      const core = ctx.createRadialGradient(
        center[0] - 7,
        center[1] - 8,
        2,
        center[0],
        center[1],
        coreRadius,
      );
      core.addColorStop(0, "rgba(249, 235, 190, .8)");
      core.addColorStop(0.35, "rgba(195, 186, 145, .22)");
      core.addColorStop(1, "rgba(125, 174, 157, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(center[0], center[1], coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(220, 204, 158, .4)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(center[0], center[1], coreRadius * 0.64, 0, Math.PI * 2);
      ctx.stroke();
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div className="aw-constellation">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive constellation of Aetherion's fourteen colleges"
      />
      <div className="aw-constellation-meta">
        <span>INSTITUTIONAL CONSTELLATION</span>
        <b>{hovered || "Chief of Staff"}</b>
        <small>14 colleges · 74 versioned agents</small>
      </div>
    </div>
  );
}
