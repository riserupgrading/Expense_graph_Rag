const Category = require("../models/Category");
const Merchant = require("../models/Merchant");
const Transaction = require("../models/Transaction");
const Subscription = require("../models/Subscription");
const { vectorSearch, embedText } = require("./embeddings");
const { categorySpendRollup } = require("./graphTraversal");

/**
 * HYBRID RETRIEVAL + ANSWER SYNTHESIS ("RAG")
 * --------------------------------------------
 * 1. Classify rough intent from the question (cheap keyword rules - this
 *    stands in for an LLM intent-extraction call so the demo works with
 *    zero API keys; swap classifyIntent() for an LLM call in production).
 * 2. GRAPH step: for structural questions (category totals, subscriptions)
 *    query MongoDB relationships / $graphLookup rollups.
 * 3. VECTOR step: for fuzzy/semantic questions ("travel spending"),
 *    embed the query and cosine-similarity search transaction
 *    descriptions.
 * 4. Synthesize a natural-language answer from whatever facts were
 *    retrieved. If OPENAI_API_KEY is set, ask the LLM to phrase it nicely;
 *    otherwise use a template - so the app is fully usable offline.
 */

function classifyIntent(question) {
  const q = question.toLowerCase();
  if (/(subscription|recurring|not using|unused|forgot)/.test(q)) return "subscriptions";
  if (/(vs|versus|compare)/.test(q)) return "compare";
  if (/(how much|total|spend|spent)/.test(q) && /(on|for)/.test(q)) return "category_or_merchant";
  return "semantic";
}

async function getUnusedSubscriptions() {
  const subs = await Subscription.find({ status: "possibly-unused" }).populate("merchant");
  return subs;
}

async function getAllSubscriptions() {
  const subs = await Subscription.find().populate("merchant");
  return subs;
}

function extractTopicPhrase(question) {
  // crude but effective: grab text after "on"/"for"/"about"
  const match = question.match(/(?:on|for|about)\s+([a-zA-Z\s]+?)(?:\?|$)/i);
  return match ? match[1].trim() : question;
}

async function semanticTransactionSearch(query, topK = 8) {
  const txns = await Transaction.find().populate({
    path: "merchant",
    populate: { path: "category" },
  });
  const candidates = txns.map((t) => ({
    id: t._id,
    text: t.rawDescription,
    embedding: t.embedding,
    transaction: t,
  }));
  const results = vectorSearch(query, candidates, topK);
  return results.filter((r) => r.score > 0.05); // drop near-zero matches
}

async function answerSubscriptionsQuestion(question) {
  const unused = await getUnusedSubscriptions();
  const all = await getAllSubscriptions();

  if (unused.length === 0) {
    return {
      answer:
        `Good news — none of your ${all.length} tracked subscriptions look unused right now. ` +
        `Everything you're being charged for has recent usage activity.`,
      supportingData: { subscriptions: all },
    };
  }

  const lines = unused.map((s) => {
    const days = s.lastUsedDate
      ? Math.round((Date.now() - new Date(s.lastUsedDate)) / 86400000)
      : "never (no usage logged)";
    return `- ${s.name}: ₹${s.avgAmount}/${s.frequency}, last used ${
      typeof days === "number" ? `${days} days ago` : days
    }`;
  });

  return {
    answer:
      `You have ${unused.length} subscription(s) that look possibly unused, still costing you ` +
      `₹${unused.reduce((sum, s) => sum + s.avgAmount, 0)}/cycle combined:\n\n${lines.join("\n")}`,
    supportingData: { subscriptions: unused },
  };
}

async function answerCategoryOrMerchantQuestion(question) {
  const topic = extractTopicPhrase(question);

  // Try a direct category match first (graph rollup)
  const category = await Category.findOne({ name: new RegExp(`^${topic}$`, "i") });
  if (category) {
    const rollup = await categorySpendRollup(topic);
    return {
      answer: `You've spent ₹${rollup.total.toLocaleString("en-IN")} on ${rollup.category} across ${
        rollup.count
      } transactions (including its sub-categories).`,
      supportingData: { transactions: rollup.transactions.slice(0, 15) },
    };
  }

  // Fall back to vector search over transaction descriptions (fuzzy merchant/topic match)
  const results = await semanticTransactionSearch(topic, 15);
  const total = results.reduce((s, r) => s + r.transaction.amount, 0);
  if (results.length === 0) {
    return {
      answer: `I couldn't find any transactions related to "${topic}" in your data.`,
      supportingData: { transactions: [] },
    };
  }
  return {
    answer: `Found ${results.length} transactions related to "${topic}", totalling ₹${total.toLocaleString(
      "en-IN"
    )}.`,
    supportingData: { transactions: results.map((r) => r.transaction) },
  };
}

async function answerCompareQuestion(question) {
  const parts = question.split(/\bvs\b|\bversus\b/i).map((p) => p.trim());
  if (parts.length < 2) return answerCategoryOrMerchantQuestion(question);

  const topicA = extractTopicPhrase(parts[0]) || parts[0];
  const topicB = extractTopicPhrase(parts[1]) || parts[1];

  const [resA, resB] = await Promise.all([
    semanticTransactionSearch(topicA, 30),
    semanticTransactionSearch(topicB, 30),
  ]);
  const totalA = resA.reduce((s, r) => s + r.transaction.amount, 0);
  const totalB = resB.reduce((s, r) => s + r.transaction.amount, 0);

  const winner = totalA === totalB ? "roughly the same" : totalA > totalB ? topicA : topicB;

  return {
    answer:
      `"${topicA}": ₹${totalA.toLocaleString("en-IN")} (${resA.length} txns) vs ` +
      `"${topicB}": ₹${totalB.toLocaleString("en-IN")} (${resB.length} txns). ` +
      `You spend more on ${winner}.`,
    supportingData: {
      transactions: [...resA.map((r) => r.transaction), ...resB.map((r) => r.transaction)],
      comparison: { [topicA]: totalA, [topicB]: totalB },
    },
  };
}

async function answerSemanticQuestion(question) {
  const results = await semanticTransactionSearch(question, 10);
  if (results.length === 0) {
    return {
      answer:
        "I couldn't find anything closely related to that in your transactions. Try asking about a specific category, merchant, or your subscriptions.",
      supportingData: { transactions: [] },
    };
  }
  const total = results.reduce((s, r) => s + r.transaction.amount, 0);
  return {
    answer: `Here's what I found related to your question — ${results.length} matching transactions totalling ₹${total.toLocaleString(
      "en-IN"
    )}.`,
    supportingData: { transactions: results.map((r) => r.transaction) },
  };
}

async function answerQuestion(question) {
  const intent = classifyIntent(question);
  switch (intent) {
    case "subscriptions":
      return { intent, ...(await answerSubscriptionsQuestion(question)) };
    case "compare":
      return { intent, ...(await answerCompareQuestion(question)) };
    case "category_or_merchant":
      return { intent, ...(await answerCategoryOrMerchantQuestion(question)) };
    default:
      return { intent, ...(await answerSemanticQuestion(question)) };
  }
}

module.exports = { answerQuestion, classifyIntent, semanticTransactionSearch };
