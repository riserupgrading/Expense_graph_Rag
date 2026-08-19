const mongoose = require("mongoose");

/**
 * Categories form a small GRAPH via the self-referencing `parent` field.
 * e.g. Food -> Food Delivery, Food -> Dining Out
 * We traverse this with MongoDB's $graphLookup (a real recursive graph
 * traversal operator) in utils/graphTraversal.js, e.g. "how much did I
 * spend on Food overall, including every sub-category".
 */
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  icon: { type: String, default: "tag" },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  color: { type: String, default: "#2DD4BF" },
});

module.exports = mongoose.model("Category", categorySchema);
