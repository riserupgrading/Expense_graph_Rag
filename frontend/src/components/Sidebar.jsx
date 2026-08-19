import React from "react";
import "./Sidebar.css";

const ICONS = {
  dashboard: "◱",
  chat: "✦",
  transactions: "≣",
  subscriptions: "↻",
  graph: "◈",
};

export default function Sidebar({ active, onNavigate, views }) {
  const keys = Object.keys(views);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <span className="node node-a" />
          <span className="node node-b" />
          <span className="node node-c" />
        </div>
        <div>
          <div className="brand-name">Nodal</div>
          <div className="brand-tagline">expense graph assistant</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-thread" aria-hidden="true" />
        {keys.map((key, i) => (
          <button
            key={key}
            className={`nav-item ${active === key ? "nav-item-active" : ""}`}
            onClick={() => onNavigate(key)}
          >
            <span className="nav-node" />
            <span className="nav-icon">{ICONS[key]}</span>
            <span>{views[key].label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-line">MERN + Graph + Vector RAG</div>
        <div className="footer-line footer-dim">MongoDB · $graphLookup · local embeddings</div>
      </div>
    </aside>
  );
}
