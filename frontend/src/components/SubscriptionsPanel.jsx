import React, { useEffect, useState } from "react";
import { getSubscriptions, rescanSubscriptions, markSubscriptionUsed } from "../api/api.js";
import "./SubscriptionsPanel.css";

function formatINR(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function daysSince(d) {
  if (!d) return null;
  return Math.round((Date.now() - new Date(d)) / 86400000);
}

const STATUS_META = {
  active: { label: "Active", color: "var(--accent-teal)" },
  "possibly-unused": { label: "Possibly unused", color: "var(--accent-amber)" },
  cancelled: { label: "Cancelled", color: "var(--text-tertiary)" },
};

export default function SubscriptionsPanel() {
  const [subs, setSubs] = useState(null);
  const [rescanning, setRescanning] = useState(false);

  function load() {
    getSubscriptions().then(setSubs);
  }

  useEffect(load, []);

  async function handleRescan() {
    setRescanning(true);
    await rescanSubscriptions();
    load();
    setRescanning(false);
  }

  async function handleMarkUsed(id) {
    await markSubscriptionUsed(id);
    load();
  }

  const unused = subs?.filter((s) => s.status === "possibly-unused") || [];

  return (
    <div>
      <header className="page-header">
        <p className="page-eyebrow">Graph · recurring payments</p>
        <h1 className="page-title">Subscriptions</h1>
        <p className="page-subtitle">
          Detected by clustering transactions from the same merchant with a regular interval and
          stable amount — no hardcoded list of "known subscription apps".
        </p>
      </header>

      {unused.length > 0 && (
        <div className="card alert-card">
          <div>
            <strong>{unused.length} subscription{unused.length > 1 ? "s" : ""}</strong> look
            possibly unused, still costing{" "}
            <strong className="mono">
              {formatINR(unused.reduce((s, x) => s + x.avgAmount, 0))}
            </strong>{" "}
            per cycle.
          </div>
        </div>
      )}

      <div className="sub-toolbar">
        <button className="btn" onClick={handleRescan} disabled={rescanning}>
          {rescanning ? "Rescanning…" : "↻ Rescan for recurring payments"}
        </button>
      </div>

      <div className="sub-grid">
        {subs?.map((s) => {
          const meta = STATUS_META[s.status] || STATUS_META.active;
          const dSince = daysSince(s.lastUsedDate);
          return (
            <div className="card sub-card" key={s._id}>
              <div className="sub-card-top">
                <div>
                  <div className="sub-name">{s.name}</div>
                  <div className="sub-meta mono">{s.frequency} · {formatINR(s.avgAmount)}</div>
                </div>
                <span className="pill" style={{ borderColor: meta.color }}>
                  <span className="pill-dot" style={{ background: meta.color }} />
                  {meta.label}
                </span>
              </div>
              <div className="sub-usage">
                {dSince === null
                  ? "No usage ever logged"
                  : `Last used ${dSince === 0 ? "today" : `${dSince} days ago`}`}
              </div>
              {s.status === "possibly-unused" && (
                <button className="btn btn-mark" onClick={() => handleMarkUsed(s._id)}>
                  Mark as used today
                </button>
              )}
            </div>
          );
        })}
        {subs && subs.length === 0 && (
          <div className="empty-state">
            No subscriptions detected yet. Run the seed script, then click "Rescan".
          </div>
        )}
      </div>
    </div>
  );
}
