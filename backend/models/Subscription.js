const mongoose = require("mongoose");

/**
 * A Subscription is a GRAPH node created by graphTraversal.js's recurring-
 * payment detector: it groups together the Transaction nodes that belong
 * to the same recurring merchant relationship
 * (Transaction) -[:PART_OF]-> (Subscription) -[:BILLED_BY]-> (Merchant)
 */
const subscriptionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  frequency: { type: String, enum: ["weekly", "monthly", "yearly"], default: "monthly" },
  avgAmount: { type: Number, required: true },
  status: { type: String, enum: ["active", "possibly-unused", "cancelled"], default: "active" },
  lastUsedDate: { type: Date, default: null },
  lastChargedDate: { type: Date, default: null },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
