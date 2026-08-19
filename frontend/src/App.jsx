import React, { useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ChatAssistant from "./components/ChatAssistant.jsx";
import TransactionsList from "./components/TransactionsList.jsx";
import SubscriptionsPanel from "./components/SubscriptionsPanel.jsx";
import GraphPanel from "./components/GraphPanel.jsx";
import "./App.css";

const VIEWS = {
  dashboard: { label: "Overview", component: Dashboard },
  chat: { label: "Ask Nodal", component: ChatAssistant },
  transactions: { label: "Transactions", component: TransactionsList },
  subscriptions: { label: "Subscriptions", component: SubscriptionsPanel },
  graph: { label: "Knowledge Graph", component: GraphPanel },
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const ActiveView = VIEWS[view].component;

  return (
    <div className="app-shell">
      <Sidebar active={view} onNavigate={setView} views={VIEWS} />
      <main className="app-main">
        <ActiveView onNavigate={setView} />
      </main>
    </div>
  );
}
