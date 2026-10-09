/**
 * Month calendar for published word days (today and earlier only).
 */

export function parseDateId(dateId) {
  return {
    y: Number(dateId.slice(0, 4)),
    m: Number(dateId.slice(4, 6)) - 1,
    d: Number(dateId.slice(6, 8)),
  };
}

export function toDateId(y, m, d) {
  return `${y}${String(m + 1).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

/**
 * @param {object} opts
 * @param {number} opts.year
 * @param {number} opts.month 0-indexed
 * @param {Set<string>} opts.publishedIds
 * @param {string} opts.todayId
 * @param {string} [opts.selectedId]
 */
export function buildMonthCells({ year, month, publishedIds, todayId, selectedId }) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  /** @type {{ day: number|null, dateId: string|null, published: boolean, future: boolean, today: boolean, selected: boolean }[]} */
  const cells = [];

  for (let i = 0; i < firstDow; i += 1) {
    cells.push({
      day: null,
      dateId: null,
      published: false,
      future: false,
      today: false,
      selected: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateId = toDateId(year, month, d);
    cells.push({
      day: d,
      dateId,
      published: publishedIds.has(dateId),
      future: dateId > todayId,
      today: dateId === todayId,
      selected: dateId === selectedId,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      day: null,
      dateId: null,
      published: false,
      future: false,
      today: false,
      selected: false,
    });
  }

  return cells;
}

export function monthLabel(year, month, locale = undefined) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

/** Earliest month that still has a published day, else current month. */
export function initialMonth(publishedIds, todayId) {
  const today = parseDateId(todayId);
  if (!publishedIds.size) return { year: today.y, month: today.m };

  const sorted = [...publishedIds].sort();
  const latest = sorted[sorted.length - 1];
  const { y, m } = parseDateId(latest);
  return { year: y, month: m };
}

export function canGoPrev(year, month, publishedIds) {
  if (!publishedIds.size) return false;
  const earliest = [...publishedIds].sort()[0];
  const { y, m } = parseDateId(earliest);
  return year > y || (year === y && month > m);
}

export function canGoNext(year, month, todayId) {
  const today = parseDateId(todayId);
  return year < today.y || (year === today.y && month < today.m);
}
