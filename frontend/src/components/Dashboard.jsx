import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { getDashboardSummary } from "../api/api.js";
import "./Dashboard.css";

const COLORS = ["#2DD4BF", "#F5A623", "#7C9BFF", "#F2596B", "#9F7CFF", "#5ECBA1", "#E4C55E"];

function formatINR(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboardSummary()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="empty-state">
        Couldn't reach the backend ({error}). Make sure the API server is running on port 5000 and
        you've run <code>npm run seed</code> at least once.
      </div>
    );
  }
  if (!data) return <div className="empty-state">Loading your spending graph…</div>;

  return (
    <div>
      <header className="page-header">
        <p className="page-eyebrow">Overview</p>
        <h1 className="page-title">Your spending, mapped as a graph</h1>
        <p className="page-subtitle">
          Every transaction links to a merchant, a category, and — where the pattern repeats — a
          subscription. Ask a question in plain English on the <button className="link-btn" onClick={() => onNavigate("chat")}>Ask Nodal</button> tab any time.
        </p>
      </header>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-label">This month</div>
          <div className="stat-value mono">{formatINR(data.totalThisMonth)}</div>
          <div className="stat-sub">{data.totalTransactions} transactions tracked overall</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Recurring / month</div>
          <div className="stat-value mono">{formatINR(data.monthlySubscriptionSpend)}</div>
          <div className="stat-sub">{data.subscriptionCount} active subscriptions detected</div>
        </div>
        <div className="card stat-card stat-card-warn">
          <div className="stat-label">Possibly unused</div>
          <div className="stat-value mono">{data.unusedSubscriptionCount}</div>
          <div className="stat-sub">
            <button className="link-btn" onClick={() => onNavigate("subscriptions")}>review these →</button>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3 className="card-title">Spend by category</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.categoryBreakdown}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.categoryBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatINR(v)}
                  contentStyle={{
                    background: "#20242C",
                    border: "1px solid #2B303B",
                    borderRadius: 8,
                    fontSize: 12.5,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-grid">
            {data.categoryBreakdown.slice(0, 7).map((c, i) => (
              <div className="legend-item" key={c.name}>
                <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="legend-name">{c.name}</span>
                <span className="legend-value mono">{formatINR(c.total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Top merchants</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.topMerchants} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid horizontal={false} stroke="#21252D" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: "#9299AC", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => formatINR(v)}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{
                    background: "#20242C",
                    border: "1px solid #2B303B",
                    borderRadius: 8,
                    fontSize: 12.5,
                  }}
                />
                <Bar dataKey="total" fill="#2DD4BF" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
