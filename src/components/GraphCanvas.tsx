"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TYPE_LIST } from "@/lib/types";

export interface GraphNode {
  id: string;
  type: string;
  title: string;
}
export interface GraphEdge {
  source: string;
  target: string;
  kind: "connection" | "project";
}

const COLORS: Record<string, string> = {
  decision: "#fbbf24",
  lesson: "#34d399",
  aha: "#e879f9",
  question: "#38bdf8",
  project: "#a78bfa",
};

const W = 1000;
const H = 680;

export function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const router = useRouter();
  const n = nodes.length;

  const index = useMemo(() => {
    const m = new Map<string, number>();
    nodes.forEach((nd, i) => m.set(nd.id, i));
    return m;
  }, [nodes]);

  const degree = useMemo(() => {
    const d = new Array(n).fill(0);
    for (const e of edges) {
      const s = index.get(e.source);
      const t = index.get(e.target);
      if (s != null) d[s]++;
      if (t != null) d[t]++;
    }
    return d;
  }, [edges, index, n]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    nodes.forEach((nd) => map.set(nd.id, new Set()));
    for (const e of edges) {
      map.get(e.source)?.add(e.target);
      map.get(e.target)?.add(e.source);
    }
    return map;
  }, [edges, nodes]);

  // Physics lives in a ref (mutated every frame); rendering reads a state
  // snapshot the loop publishes, so we never read a ref during render.
  const sim = useRef({ x: [] as number[], y: [] as number[], vx: [] as number[], vy: [] as number[] });
  const pinned = useRef<number | null>(null);
  const alpha = useRef(1);
  const raf = useRef<number | null>(null);

  const [coords, setCoords] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ mode: "pan" | "node"; i?: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);

  const publish = () => setCoords({ x: [...sim.current.x], y: [...sim.current.y] });

  // Initialize positions on a ring with jitter.
  useEffect(() => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / Math.max(1, n)) * Math.PI * 2;
      x[i] = W / 2 + Math.cos(ang) * 180 + (Math.random() - 0.5) * 40;
      y[i] = H / 2 + Math.sin(ang) * 180 + (Math.random() - 0.5) * 40;
    }
    sim.current = { x, y, vx: new Array(n).fill(0), vy: new Array(n).fill(0) };
    alpha.current = 1;
    // The animation loop publishes coordinates to state on its first tick.
  }, [n]);

  // Simulation loop.
  useEffect(() => {
    if (n === 0) return;
    function tick() {
      const p = sim.current;
      const a = alpha.current;
      if (a > 0.004) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            let dx = p.x[i] - p.x[j];
            let dy = p.y[i] - p.y[j];
            const d2 = dx * dx + dy * dy || 0.01;
            const rep = 9000 / d2;
            const d = Math.sqrt(d2);
            dx /= d;
            dy /= d;
            p.vx[i] += dx * rep * a;
            p.vy[i] += dy * rep * a;
            p.vx[j] -= dx * rep * a;
            p.vy[j] -= dy * rep * a;
          }
        }
        for (const e of edges) {
          const s = index.get(e.source);
          const t = index.get(e.target);
          if (s == null || t == null) continue;
          const dx = p.x[t] - p.x[s];
          const dy = p.y[t] - p.y[s];
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const target = e.kind === "project" ? 90 : 130;
          const fk = ((d - target) / d) * 0.05 * a;
          p.vx[s] += dx * fk;
          p.vy[s] += dy * fk;
          p.vx[t] -= dx * fk;
          p.vy[t] -= dy * fk;
        }
        for (let i = 0; i < n; i++) {
          if (pinned.current === i) {
            p.vx[i] = 0;
            p.vy[i] = 0;
            continue;
          }
          p.vx[i] += (W / 2 - p.x[i]) * 0.002 * a;
          p.vy[i] += (H / 2 - p.y[i]) * 0.002 * a;
          p.vx[i] *= 0.82;
          p.vy[i] *= 0.82;
          p.x[i] += p.vx[i];
          p.y[i] += p.vy[i];
        }
        alpha.current = a * 0.985;
        setCoords({ x: [...p.x], y: [...p.y] });
      }
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [edges, index, n]);

  const reheat = () => {
    alpha.current = Math.max(alpha.current, 0.5);
  };

  function onPointerDown(e: React.PointerEvent, i?: number) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    moved.current = false;
    if (i != null) {
      pinned.current = i;
      drag.current = { mode: "node", i, sx: e.clientX, sy: e.clientY, ox: sim.current.x[i], oy: sim.current.y[i] };
      reheat();
    } else {
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
      setPanning(true);
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    if (d.mode === "pan") {
      setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    } else if (d.mode === "node" && d.i != null) {
      sim.current.x[d.i] = d.ox + dx / view.k;
      sim.current.y[d.i] = d.oy + dy / view.k;
      publish();
    }
  }
  function onPointerUp() {
    if (drag.current?.mode === "node") pinned.current = null;
    drag.current = null;
    setPanning(false);
  }
  function onWheel(e: React.WheelEvent) {
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setView((v) => ({ ...v, k: Math.min(3, Math.max(0.35, v.k * factor)) }));
  }

  const cx = coords.x;
  const cy = coords.y;
  const hoverNeighbors = hover ? neighbors.get(hover) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-800/80 px-4 py-2 text-xs text-zinc-500">
        {TYPE_LIST.map((t) => (
          <span key={t.type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[t.type] }} />
            {t.label}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setView((v) => ({ ...v, k: Math.max(0.35, v.k * 0.85) }))}
            className="grid h-7 w-7 place-items-center rounded border border-zinc-700 text-base leading-none hover:text-zinc-300"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.18) }))}
            className="grid h-7 w-7 place-items-center rounded border border-zinc-700 text-base leading-none hover:text-zinc-300"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => {
              setView({ x: 0, y: 0, k: 1 });
              reheat();
            }}
            className="rounded border border-zinc-700 px-2 py-1 hover:text-zinc-300"
          >
            reset
          </button>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[68vh] w-full touch-none select-none"
        style={{ cursor: panning ? "grabbing" : "grab" }}
        onPointerDown={(e) => onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map((e, i) => {
            const s = index.get(e.source);
            const t = index.get(e.target);
            if (s == null || t == null || cx[s] == null || cx[t] == null) return null;
            const lit = hover != null && (e.source === hover || e.target === hover);
            return (
              <line
                key={i}
                x1={cx[s]}
                y1={cy[s]}
                x2={cx[t]}
                y2={cy[t]}
                stroke={lit ? "#a78bfa" : "#3f3f46"}
                strokeWidth={lit ? 2 : 1}
                strokeDasharray={e.kind === "project" ? "4 4" : undefined}
                opacity={hover != null && !lit ? 0.25 : 0.7}
              />
            );
          })}
          {nodes.map((nd, i) => {
            if (cx[i] == null) return null;
            const r = 7 + Math.min(degree[i] * 2.5, 14);
            const dim = hover != null && hover !== nd.id && !hoverNeighbors?.has(nd.id);
            const isHover = hover === nd.id;
            return (
              <g
                key={nd.id}
                transform={`translate(${cx[i]} ${cy[i]})`}
                style={{ cursor: "pointer" }}
                opacity={dim ? 0.3 : 1}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPointerDown(e, i);
                }}
                onPointerEnter={() => setHover(nd.id)}
                onPointerLeave={() => setHover((h) => (h === nd.id ? null : h))}
                onClick={() => {
                  if (!moved.current) router.push(`/entry/${nd.id}`);
                }}
              >
                <circle r={r} fill={COLORS[nd.type] ?? "#a1a1aa"} stroke="#09090b" strokeWidth={2} />
                {(isHover || view.k > 1.4 || degree[i] >= 3) && (
                  <text
                    y={r + 13}
                    textAnchor="middle"
                    fontSize={12}
                    fill={isHover ? "#fafafa" : "#a1a1aa"}
                    style={{ pointerEvents: "none" }}
                  >
                    {nd.title.length > 26 ? nd.title.slice(0, 26) + "…" : nd.title}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
