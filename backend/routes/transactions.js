const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Merchant = require("../models/Merchant");
const Category = require("../models/Category");
const { embedText } = require("../utils/embeddings");

// GET /api/transactions?limit=50&page=1
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const txns = await Transaction.find()
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "merchant", populate: { path: "category" } });

    const total = await Transaction.countDocuments();
    res.json({ transactions: txns, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions  -> add a manual transaction (auto-embeds description)
router.post("/", async (req, res) => {
  try {
    const { date, amount, rawDescription, merchantName, categoryName, type } = req.body;

    let merchant = await Merchant.findOne({ normalizedName: merchantName });
    if (!merchant) {
      let category = categoryName ? await Category.findOne({ name: categoryName }) : null;
      merchant = await Merchant.create({
        normalizedName: merchantName,
        rawNames: [rawDescription],
        category: category ? category._id : null,
        embedding: embedText(merchantName),
      });
    }

    const txn = await Transaction.create({
      date: date ? new Date(date) : new Date(),
      amount,
      rawDescription,
      merchant: merchant._id,
      type: type || "debit",
      embedding: embedText(rawDescription),
    });

    res.status(201).json(txn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
