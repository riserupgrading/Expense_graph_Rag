const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription");
const UsageLog = require("../models/UsageLog");
const { detectRecurringSubscriptions, flagUnusedSubscriptions } = require("../utils/graphTraversal");

// GET /api/subscriptions
router.get("/", async (req, res) => {
  try {
    const subs = await Subscription.find().populate("merchant").sort({ avgAmount: -1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscriptions/rescan -> re-run the graph-based detection algorithm
router.post("/rescan", async (req, res) => {
  try {
    const created = await detectRecurringSubscriptions();
    await flagUnusedSubscriptions(UsageLog);
    res.json({ message: "Rescan complete", subscriptionsTouched: created.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscriptions/:id/mark-used -> simulate logging a usage event
router.post("/:id/mark-used", async (req, res) => {
  try {
    await UsageLog.create({ subscription: req.params.id, date: new Date() });
    await flagUnusedSubscriptions(UsageLog);
    const sub = await Subscription.findById(req.params.id).populate("merchant");
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
