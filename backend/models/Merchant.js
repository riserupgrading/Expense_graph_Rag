const mongoose = require("mongoose");

/**
 * Real bank/UPI statements show the same merchant under many messy strings
 * ("SWIGGY*ORDER123", "Swiggy Bangalore Pvt Ltd", "SWIGGY INSTAMART").
 * `rawNames` keeps every variant we have seen; `embedding` is a lightweight
 * vector (see utils/embeddings.js) used to fuzzy-match new/unseen raw
 * strings back to this merchant via cosine similarity - this is the
 * "vector DB" piece of the project, stored inline in Mongo instead of a
 * separate vector service so the whole app runs with zero external APIs.
 */
const merchantSchema = new mongoose.Schema({
  normalizedName: { type: String, required: true, unique: true },
  rawNames: [{ type: String }],
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  embedding: { type: [Number], default: [] },
});

module.exports = mongoose.model("Merchant", merchantSchema);
