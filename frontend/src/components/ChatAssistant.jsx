import React, { useRef, useState } from "react";
import { askQuestion } from "../api/api.js";
import "./ChatAssistant.css";

const SUGGESTIONS = [
  "How much have I spent on Food this month?",
  "What subscriptions am I not using?",
  "Food Delivery vs Dining Out spending",
  "Show me my travel related spending",
];

function formatINR(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const INTENT_LABEL = {
  subscriptions: "graph · subscription detection",
  compare: "vector · comparison search",
  category_or_merchant: "graph · category rollup",
  semantic: "vector · semantic search",
};

export default function ChatAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      answer:
        "Hi, I'm Nodal. Ask me anything about your spending — I combine a category/subscription graph with semantic search over your transaction history to answer. Try one of the suggestions below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const result = await askQuestion(q);
      setMessages((m) => [...m, { role: "assistant", ...result }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", answer: `Something went wrong reaching the backend: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="chat-wrap">
      <header className="page-header">
        <p className="page-eyebrow">Ask Nodal</p>
        <h1 className="page-title">Query your expenses in plain English</h1>
        <p className="page-subtitle">
          Questions are routed to a graph lookup (categories, subscriptions) or a vector search over
          transaction descriptions depending on intent — hybrid retrieval, not a single search
          strategy.
        </p>
      </header>

      <div className="card chat-card">
        <div className="chat-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              {m.role === "assistant" && m.intent && (
                <span className="pill msg-intent">
                  <span
                    className="pill-dot"
                    style={{ background: m.intent === "subscriptions" ? "var(--accent-amber)" : "var(--accent-teal)" }}
                  />
                  {INTENT_LABEL[m.intent]}
                </span>
              )}
              <div className="msg-bubble">{m.answer ?? m.text}</div>

              {m.supportingData?.transactions?.length > 0 && (
                <div className="evidence-list">
                  {m.supportingData.transactions.slice(0, 6).map((t) => (
                    <div className="evidence-row" key={t._id || t.id}>
                      <span className="evidence-desc">{t.rawDescription || t.text}</span>
                      <span className="evidence-amount mono">{formatINR(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {m.supportingData?.subscriptions?.length > 0 && (
                <div className="evidence-list">
                  {m.supportingData.subscriptions.map((s) => (
                    <div className="evidence-row" key={s._id}>
                      <span className="evidence-desc">
                        {s.name} <span className="text-tertiary">· {s.frequency}</span>
                      </span>
                      <span className="evidence-amount mono">{formatINR(s.avgAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="msg msg-assistant">
              <div className="msg-bubble msg-loading">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}
        </div>

        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="suggestion-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>

        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            className="chat-input"
            placeholder="Ask about a category, merchant, or your subscriptions…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
