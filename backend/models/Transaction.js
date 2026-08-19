const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  rawDescription: { type: String, required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },
  type: { type: String, enum: ["debit", "credit"], default: "debit" },
  // Vector embedding of rawDescription, used for semantic/fuzzy search
  // e.g. "travel related spending" should surface Uber/Ola/IRCTC/MakeMyTrip
  // transactions even if none of them literally say "travel".
  embedding: { type: [Number], default: [] },
});

transactionSchema.index({ date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
