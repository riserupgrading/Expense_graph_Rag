import React, { useEffect, useMemo, useState } from "react";
import { getGraphData } from "../api/api.js";
import "./GraphPanel.css";

const TYPE_COLOR = {
  category: "#7C9BFF",
  merchant: "#2DD4BF",
  subscription: "#F5A623",
};

const COLUMN_X = { category: 90, merchant: 420, subscription: 750 };

export default function GraphPanel() {
  const [data, setData] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    getGraphData().then(setData);
  }, []);

  const layout = useMemo(() => {
    if (!data) return null;
    const byType = { category: [], merchant: [], subscription: [] };
    data.nodes.forEach((n) => byType[n.type]?.push(n));

    const positions = {};
    Object.entries(byType).forEach(([type, nodes]) => {
      const height = Math.max(nodes.length * 46, 300);
      nodes.forEach((n, i) => {
        positions[n.id] = {
          x: COLUMN_X[type],
          y: 40 + (i + 0.5) * (height / nodes.length),
        };
      });
    });

    const maxHeight = Math.max(
      ...Object.values(byType).map((nodes) => Math.max(nodes.length * 46, 300))
    );

    return { byType, positions, height: maxHeight + 60 };
  }, [data]);

  if (!data || !layout) return <div className="empty-state">Loading graph…</div>;

  const isDimmed = (nodeId) => hovered && hovered !== nodeId && !isNeighbor(nodeId);

  function isNeighbor(nodeId) {
    if (!hovered) return false;
    return data.edges.some(
      (e) => (e.source === hovered && e.target === nodeId) || (e.target === hovered && e.source === nodeId)
    );
  }

  return (
    <div>
      <header className="page-header">
        <p className="page-eyebrow">Graph layer</p>
        <h1 className="page-title">Knowledge graph</h1>
        <p className="page-subtitle">
          Category → Merchant → Subscription relationships, the same structure the backend
          traverses with MongoDB's <code>$graphLookup</code> to answer rollup questions. Hover a
          node to trace its connections.
        </p>
      </header>

      <div className="card graph-card">
        <div className="graph-legend">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <span key={type} className="pill">
              <span className="pill-dot" style={{ background: color }} />
              {type}
            </span>
          ))}
        </div>

        <div className="graph-scroll">
          <svg width={860} height={layout.height} className="graph-svg">
            {data.edges.map((e, i) => {
              const s = layout.positions[e.source];
              const t = layout.positions[e.target];
              if (!s || !t) return null;
              const dimmed =
                hovered && hovered !== e.source && hovered !== e.target;
              return (
                <path
                  key={i}
                  d={`M ${s.x + 60} ${s.y} C ${(s.x + t.x) / 2} ${s.y}, ${(s.x + t.x) / 2} ${t.y}, ${t.x - 60} ${t.y}`}
                  fill="none"
                  stroke={dimmed ? "#22262F" : "#3A404C"}
                  strokeWidth={1.2}
                />
              );
            })}

            {data.nodes.map((n) => {
              const pos = layout.positions[n.id];
              if (!pos) return null;
              const color = TYPE_COLOR[n.type];
              const dimmed = isDimmed(n.id);
              const isUnused = n.status === "possibly-unused";
              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="graph-node"
                  opacity={dimmed ? 0.25 : 1}
                >
                  <rect
                    x={-58}
                    y={-14}
                    width={116}
                    height={28}
                    rx={14}
                    fill="#1B1F27"
                    stroke={isUnused ? "#F5A623" : color}
                    strokeWidth={isUnused ? 1.6 : 1}
                    strokeDasharray={isUnused ? "3 2" : "0"}
                  />
                  <circle cx={-46} cy={0} r={4} fill={color} />
                  <text x={-36} y={4} fontSize={10.5} fill="#EDEFF3" fontFamily="Inter, sans-serif">
                    {n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
