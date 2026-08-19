const express = require("express");
const router = express.Router();
const { answerQuestion } = require("../utils/ragEngine");

// POST /api/query  { question: string }
router.post("/", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "question is required" });
    }
    const result = await answerQuestion(question.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
