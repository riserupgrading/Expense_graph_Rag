const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
const Merchant = require("../models/Merchant");
const Subscription = require("../models/Subscription");

// GET /api/dashboard/summary
router.get("/summary", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthTxns = await Transaction.find({ date: { $gte: startOfMonth }, type: "debit" });
    const totalThisMonth = monthTxns.reduce((s, t) => s + t.amount, 0);

    const allDebits = await Transaction.find({ type: "debit" }).populate({
      path: "merchant",
      populate: { path: "category" },
    });

    // category-wise breakdown (top-level rollup)
    const byCategory = {};
    for (const t of allDebits) {
      const catName = t.merchant?.category?.name || "Uncategorized";
      byCategory[catName] = (byCategory[catName] || 0) + t.amount;
    }
    const categoryBreakdown = Object.entries(byCategory)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    // top merchants
    const byMerchant = {};
    for (const t of allDebits) {
      const name = t.merchant?.normalizedName || "Unknown";
      byMerchant[name] = (byMerchant[name] || 0) + t.amount;
    }
    const topMerchants = Object.entries(byMerchant)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const subscriptions = await Subscription.find().populate("merchant");
    const unusedCount = subscriptions.filter((s) => s.status === "possibly-unused").length;

    res.json({
      totalThisMonth,
      totalTransactions: allDebits.length,
      categoryBreakdown,
      topMerchants,
      subscriptionCount: subscriptions.length,
      unusedSubscriptionCount: unusedCount,
      monthlySubscriptionSpend: subscriptions.reduce(
        (s, sub) => s + (sub.frequency === "monthly" ? sub.avgAmount : sub.avgAmount / 12),
        0
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/graph  -> small graph payload for the network visualization panel
router.get("/graph", async (req, res) => {
  try {
    const categories = await Category.find();
    const merchants = await Merchant.find().populate("category");
    const subscriptions = await Subscription.find().populate("merchant");

    const nodes = [];
    const edges = [];

    categories.forEach((c) => {
      nodes.push({ id: `cat-${c._id}`, label: c.name, type: "category" });
      if (c.parent) edges.push({ source: `cat-${c.parent}`, target: `cat-${c._id}` });
    });

    merchants.forEach((m) => {
      nodes.push({ id: `mer-${m._id}`, label: m.normalizedName, type: "merchant" });
      if (m.category) edges.push({ source: `mer-${m._id}`, target: `cat-${m.category._id}` });
    });

    subscriptions.forEach((s) => {
      nodes.push({ id: `sub-${s._id}`, label: s.name, type: "subscription", status: s.status });
      if (s.merchant) edges.push({ source: `sub-${s._id}`, target: `mer-${s.merchant._id}` });
    });

    res.json({ nodes, edges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
