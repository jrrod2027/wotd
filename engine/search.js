/**
 * Fuzzy search over word-of-the-day text. Returns top matches by score.
 */

// Higher = stronger rank. Accents are folded in `fold()` so users need not type them.
const FIELD_WEIGHT = {
  word: 1.0,
  definition: 1.0, // equal to the word of the day itself
  phonetic: 0.8,
  connotation: 0.4, // mood / theme — helpful, but weaker
  example: 0.22, // sentence hits matter least
  date: 0.3,
};

export function fold(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Score how well `query` fuzzy-matches `text` (both already folded).
 * Higher is better. 0 = no match.
 */
export function fuzzyScore(query, text) {
  if (!query || !text) return 0;

  if (text === query) return 1;
  if (text.startsWith(query)) return 0.94;
  if (text.includes(` ${query}`) || text.includes(query)) {
    // Prefer tighter substring hits
    const idx = text.indexOf(query);
    const tightness = query.length / text.length;
    return 0.72 + 0.2 * tightness - Math.min(idx, 40) * 0.001;
  }

  // Short queries need a real substring/prefix hit (too many false fuzzies)
  if (query.length < 3) return 0;

  // Subsequence match with gaps (classic fuzzy)
  let ti = 0;
  let gaps = 0;
  let first = -1;
  let last = -1;
  for (let qi = 0; qi < query.length; qi += 1) {
    const ch = query[qi];
    const found = text.indexOf(ch, ti);
    if (found === -1) return 0;
    if (first === -1) first = found;
    if (found > ti) gaps += found - ti;
    last = found;
    ti = found + 1;
  }

  const span = last - first + 1;
  const density = query.length / span;
  const coverage = query.length / Math.max(text.length, query.length);
  const gapPenalty = Math.min(gaps / (text.length + 1), 0.5);
  const score = 0.35 * density + 0.35 * coverage + 0.25 * (1 - gapPenalty);
  // Drop loose subsequence hits
  return score >= 0.32 ? score : 0;
}

/**
 * Flatten an entry into searchable fields.
 * @param {object} entry
 * @param {string} dateId
 */
export function entryFields(entry, dateId) {
  const fields = [
    { type: "word", text: entry.word || "" },
    { type: "phonetic", text: entry.phonetic || "" },
    { type: "date", text: dateId },
  ];

  for (const def of entry.definitions || []) {
    fields.push({ type: "definition", text: def.definition || "" });
    fields.push({ type: "connotation", text: def.connotation || "" });
    for (const ex of def.examples || []) {
      fields.push({ type: "example", text: [ex.es, ex.en].filter(Boolean).join(" ") });
    }
  }

  return fields.filter((f) => f.text);
}

/**
 * @param {string} query
 * @param {{ dateId: string, entry: object }[]} docs
 * @param {number} [limit=10]
 */
export function searchEntries(query, docs, limit = 10) {
  const q = fold(query);
  if (!q) return [];

  const scored = [];

  for (const { dateId, entry } of docs) {
    const fields = entryFields(entry, dateId);
    let best = 0;
    let bestSnippet = "";
    let bestType = "";
    let hitCount = 0;
    let weightedSum = 0;

    for (const field of fields) {
      const folded = fold(field.text);
      const raw = fuzzyScore(q, folded);
      if (raw <= 0) continue;
      hitCount += 1;
      const weighted = raw * (FIELD_WEIGHT[field.type] ?? 0.5);
      weightedSum += weighted;
      if (weighted > best) {
        best = weighted;
        bestSnippet = field.text;
        bestType = field.type;
      }
    }

    if (best <= 0) continue;

    // Multi-field hits bump rank a bit ("probability")
    const multiBonus = Math.min(hitCount - 1, 4) * 0.03;
    const score = Math.min(1, best + multiBonus + weightedSum * 0.02);
    if (score < 0.28) continue;

    scored.push({
      dateId,
      word: entry.word || dateId,
      score,
      matchType: bestType,
      snippet: bestSnippet,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.dateId.localeCompare(a.dateId));
  return scored.slice(0, limit);
}
