const mongoose = require("mongoose");
const Category = require("../models/Category");
const Merchant = require("../models/Merchant");
const Transaction = require("../models/Transaction");
const Subscription = require("../models/Subscription");

/**
 * GRAPH LAYER
 * -----------
 * Categories form a small tree (Food -> Food Delivery, Dining Out) and
 * Transactions link out to Merchant -> Category. We use MongoDB's
 * $graphLookup (a genuine recursive graph traversal operator, same family
 * of operation Neo4j's Cypher does with variable-length paths) to answer
 * questions like "total spend on Food INCLUDING every sub-category",
 * instead of hardcoding category trees in application code.
 */

// Recursively find a category + all its descendant categories
async function getCategoryWithDescendants(categoryId) {
  const results = await Category.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
    {
      $graphLookup: {
        from: "categories",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parent",
        as: "descendants",
      },
    },
  ]);
  if (!results.length) return [];
  const root = results[0];
  return [root._id, ...root.descendants.map((d) => d._id)];
}

// Total spend for a category name, rolled up across its sub-categories
async function categorySpendRollup(categoryName, sinceDate = null) {
  const category = await Category.findOne({
    name: new RegExp(`^${categoryName}$`, "i"),
  });
  if (!category) return null;

  const categoryIds = await getCategoryWithDescendants(category._id);
  const merchants = await Merchant.find({ category: { $in: categoryIds } }).select("_id");
  const merchantIds = merchants.map((m) => m._id);

  const match = { merchant: { $in: merchantIds }, type: "debit" };
  if (sinceDate) match.date = { $gte: sinceDate };

  const txns = await Transaction.find(match).populate("merchant");
  const total = txns.reduce((s, t) => s + t.amount, 0);

  return { category: category.name, total, count: txns.length, transactions: txns };
}

/**
 * RECURRING SUBSCRIPTION DETECTION
 * ---------------------------------
 * Rule-based pattern detector: for every merchant, look at the gaps
 * between consecutive transaction dates and the variance in amount.
 * If the gaps cluster around ~7 days (weekly) or ~30 days (monthly) and
 * the amount barely changes, we treat it as a recurring subscription and
 * materialize a Subscription graph node linking back to every
 * contributing Transaction: (Transaction) -[:PART_OF]-> (Subscription)
 */
async function detectRecurringSubscriptions() {
  const merchants = await Merchant.find();
  const created = [];

  for (const merchant of merchants) {
    const txns = await Transaction.find({ merchant: merchant._id, type: "debit" }).sort({ date: 1 });
    if (txns.length < 3) continue;

    const gaps = [];
    for (let i = 1; i < txns.length; i++) {
      const days = (txns[i].date - txns[i - 1].date) / (1000 * 60 * 60 * 24);
      gaps.push(days);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    const amounts = txns.map((t) => t.amount);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariance =
      amounts.reduce((s, a) => s + Math.abs(a - avgAmount), 0) / amounts.length / avgAmount;

    let frequency = null;
    if (avgGap >= 5 && avgGap <= 9) frequency = "weekly";
    else if (avgGap >= 25 && avgGap <= 35) frequency = "monthly";
    else if (avgGap >= 350 && avgGap <= 380) frequency = "yearly";

    if (frequency && amountVariance < 0.15) {
      const lastTxn = txns[txns.length - 1];
      let sub = await Subscription.findOne({ merchant: merchant._id });
      if (!sub) {
        sub = await Subscription.create({
          name: merchant.normalizedName,
          merchant: merchant._id,
          frequency,
          avgAmount: Math.round(avgAmount),
          lastChargedDate: lastTxn.date,
        });
      } else {
        sub.avgAmount = Math.round(avgAmount);
        sub.lastChargedDate = lastTxn.date;
        await sub.save();
      }
      await Transaction.updateMany(
        { _id: { $in: txns.map((t) => t._id) } },
        { $set: { subscription: sub._id } }
      );
      created.push(sub);
    }
  }
  return created;
}

/**
 * "Possibly unused" flagging: a subscription is still being charged
 * but has no usage-log activity in the last N days.
 */
async function flagUnusedSubscriptions(UsageLog, unusedThresholdDays = 45) {
  const subs = await Subscription.find({ status: { $ne: "cancelled" } });
  const now = new Date();

  for (const sub of subs) {
    const lastUsage = await UsageLog.findOne({ subscription: sub._id }).sort({ date: -1 });
    sub.lastUsedDate = lastUsage ? lastUsage.date : null;
    const daysSinceUse = lastUsage
      ? (now - lastUsage.date) / (1000 * 60 * 60 * 24)
      : Infinity;
    sub.status = daysSinceUse > unusedThresholdDays ? "possibly-unused" : "active";
    await sub.save();
  }
}

module.exports = {
  getCategoryWithDescendants,
  categorySpendRollup,
  detectRecurringSubscriptions,
  flagUnusedSubscriptions,
};
