const mongoose = require("mongoose");

/**
 * Simulates "did the user actually use this subscription" signal
 * (e.g. app-open events, check-ins) so we can flag subscriptions that
 * are still being charged but haven't been used in a long time.
 */
const usageLogSchema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model("UsageLog", usageLogSchema);
