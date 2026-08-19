import React, { useEffect, useState } from "react";
import { getTransactions } from "../api/api.js";
import "./TransactionsList.css";

function formatINR(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TransactionsList() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    getTransactions({ page, limit }).then(setData);
  }, [page]);

  return (
    <div>
      <header className="page-header">
        <p className="page-eyebrow">Ledger</p>
        <h1 className="page-title">All transactions</h1>
        <p className="page-subtitle">
          Every row links to a normalized merchant and category — the raw statement text is kept
          alongside it, which is what the vector search matches against.
        </p>
      </header>

      <div className="card" style={{ padding: 0 }}>
        <table className="txn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Merchant</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data?.transactions.map((t) => (
              <tr key={t._id}>
                <td className="mono td-dim">{formatDate(t.date)}</td>
                <td className="td-desc">{t.rawDescription}</td>
                <td>{t.merchant?.normalizedName || "—"}</td>
                <td>
                  <span className="cat-chip">{t.merchant?.category?.name || "Uncategorized"}</span>
                </td>
                <td className="mono" style={{ textAlign: "right" }}>{formatINR(t.amount)}</td>
              </tr>
            ))}
            {data && data.transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No transactions yet — run <code>npm run seed</code> in the backend folder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span className="mono page-indicator">
            Page {data.page} of {Math.max(1, Math.ceil(data.total / limit))}
          </span>
          <button
            className="btn"
            disabled={page * limit >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
