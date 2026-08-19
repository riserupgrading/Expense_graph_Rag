/**
 * Lightweight local "vector DB" layer.
 *
 * In production you'd swap this for real embeddings (OpenAI/Cohere/HF)
 * plus a real vector store (Qdrant/Pinecone/pgvector). For this project we
 * implement a self-contained feature-hashing embedding + cosine similarity
 * so the ENTIRE app runs offline with zero external API keys - the
 * embedding function is isolated in this one file, so swapping in a real
 * embedding API later is a one-function change (see embedText below).
 *
 * How it works (feature hashing / "hashing trick"):
 *  1. Normalize + tokenize text into words
 *  2. Hash each token into one of DIM buckets
 *  3. Increment that bucket (term-frequency vector)
 *  4. L2-normalize the vector so cosine similarity behaves well
 *
 * This is a real, documented embedding technique (used in Vowpal Wabbit,
 * scikit-learn's HashingVectorizer, etc.) - not a toy - it just trades a
 * little bit of semantic nuance for zero dependencies / zero cost.
 */

const DIM = 128;

// Small stopword list so common filler words don't dominate the vector
const STOPWORDS = new Set([
  "the", "a", "an", "on", "at", "in", "of", "to", "for", "and", "or",
  "is", "was", "were", "be", "with", "this", "that", "it", "my", "me",
]);

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// djb2-style string hash -> stable, fast, no dependencies
function hashToken(token) {
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 33) ^ token.charCodeAt(i);
  }
  return Math.abs(hash) % DIM;
}

function embedText(text) {
  const vec = new Array(DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    vec[hashToken(token)] += 1;
  }
  // also hash bigrams to capture a bit of phrase-level meaning
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + "_" + tokens[i + 1];
    vec[hashToken(bigram)] += 0.5;
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized, so dot product == cosine similarity
}

/**
 * Given a query string and a list of {id, text, embedding} candidates,
 * return the top-K most semantically similar candidates.
 */
function vectorSearch(query, candidates, topK = 10) {
  const queryVec = embedText(query);
  return candidates
    .map((c) => ({ ...c, score: cosineSimilarity(queryVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = { DIM, embedText, cosineSimilarity, vectorSearch, tokenize };
