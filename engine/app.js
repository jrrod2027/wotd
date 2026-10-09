/**
 * Vocabulario del Barrio — static word-of-the-day engine.
 * Reads data/manifest.json (built from words/). Do not put day content here.
 */

import { searchEntries } from "./search.js";
import {
  buildMonthCells,
  monthLabel,
  initialMonth,
  canGoPrev,
  canGoNext,
  parseDateId,
} from "./calendar.js";

const MANIFEST_URL = "data/manifest.json";
const TABS = ["word", "search", "calendar"];

const state = {
  manifest: null,
  /** @type {string[]} past-or-today dates only, ascending */
  visibleDates: [],
  /** index into visibleDates */
  index: -1,
  currentAudio: null,
  /** @type {{ dateId: string, entry: object }[]} */
  searchDocs: [],
  searchActive: -1,
  tab: "word",
  calYear: 0,
  calMonth: 0,
};

const els = {
  folder: document.getElementById("folder"),
  status: document.getElementById("status"),
  panelWord: document.getElementById("panel-word"),
  panelSearch: document.getElementById("panel-search"),
  panelCalendar: document.getElementById("panel-calendar"),
  dateLabel: document.getElementById("date-label"),
  dateValue: document.getElementById("date-value"),
  prevBtn: document.getElementById("prev-day"),
  nextBtn: document.getElementById("next-day"),
  word: document.getElementById("word"),
  phonetic: document.getElementById("phonetic"),
  audioRow: document.getElementById("audio-row"),
  defs: document.getElementById("defs"),
  searchInput: document.getElementById("search-input"),
  searchResults: document.getElementById("search-results"),
  searchRoot: document.getElementById("search"),
  tabButtons: [...document.querySelectorAll(".folder__tab")],
  calTitle: document.getElementById("cal-title"),
  calGrid: document.getElementById("cal-grid"),
  calPrev: document.getElementById("cal-prev"),
  calNext: document.getElementById("cal-next"),
};

function todayId(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDisplayDate(dateId) {
  const { y, m, d } = parseDateId(dateId);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(y, m, d));
}

function formatShortDate(dateId) {
  const { y, m, d } = parseDateId(dateId);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(y, m, d));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stopAudio() {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }
  for (const btn of els.audioRow.querySelectorAll(".audio-btn")) {
    btn.classList.remove("is-playing");
  }
}

function playSrc(src, button) {
  stopAudio();
  const audio = new Audio(src);
  state.currentAudio = audio;
  button.classList.add("is-playing");
  audio.addEventListener("ended", () => {
    button.classList.remove("is-playing");
    if (state.currentAudio === audio) state.currentAudio = null;
  });
  audio.play().catch(() => {
    button.classList.remove("is-playing");
  });
}

function renderAudio(audioList) {
  els.audioRow.replaceChildren();
  if (!audioList?.length) return;

  for (const item of audioList) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audio-btn";
    btn.setAttribute("aria-label", `Play pronunciation: ${item.label}`);
    btn.innerHTML = `
      <svg class="audio-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>
      </svg>
      <span>${escapeHtml(item.label)}</span>
    `;
    btn.addEventListener("click", () => playSrc(item.src, btn));
    els.audioRow.appendChild(btn);
  }
}

function isBrowserSafeImage(src) {
  const lower = src.toLowerCase();
  return !lower.endsWith(".heic") && !lower.endsWith(".heif");
}

function renderDefinitions(definitions) {
  els.defs.replaceChildren();
  if (!definitions?.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No definitions yet for this day.";
    els.defs.appendChild(p);
    return;
  }

  definitions.forEach((def, i) => {
    const article = document.createElement("article");
    article.className = "def";
    article.style.animationDelay = `${0.05 * i}s`;

    const index = document.createElement("span");
    index.className = "def__index";
    index.textContent = `Definition ${i + 1}`;
    article.appendChild(index);

    const text = document.createElement("p");
    text.className = "def__text";
    text.textContent = def.definition || "—";
    article.appendChild(text);

    if (def.connotation) {
      const con = document.createElement("p");
      con.className = "def__connotation";
      con.textContent = `(${def.connotation})`;
      article.appendChild(con);
    }

    const images = (def.images || []).filter(isBrowserSafeImage);
    if (images.length) {
      const gallery = document.createElement("div");
      gallery.className = "def__images";
      for (const src of images) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = def.definition || "Definition image";
        img.loading = "lazy";
        gallery.appendChild(img);
      }
      article.appendChild(gallery);
    }

    if (def.examples?.length) {
      const list = document.createElement("ul");
      list.className = "examples";
      for (const ex of def.examples) {
        const li = document.createElement("li");
        li.className = "example";
        li.innerHTML = `
          <p class="example__es">${escapeHtml(ex.es)}</p>
          ${ex.en ? `<p class="example__en">${escapeHtml(ex.en)}</p>` : ""}
        `;
        list.appendChild(li);
      }
      article.appendChild(list);
    }

    els.defs.appendChild(article);
  });
}

function syncUrl() {
  const url = new URL(window.location.href);
  const dateId = state.visibleDates[state.index];
  if (dateId) url.searchParams.set("d", dateId);
  else url.searchParams.delete("d");

  if (state.tab === "word") url.searchParams.delete("tab");
  else url.searchParams.set("tab", state.tab);

  history.replaceState({ dateId, tab: state.tab }, "", url);
}

function renderEntry(dateId) {
  const entry = state.manifest.entries[dateId];
  if (!entry) return;

  stopAudio();

  const isToday = dateId === todayId();
  els.dateLabel.textContent = isToday ? "Word of the day" : "Word from";
  els.dateValue.textContent = formatDisplayDate(dateId);
  els.word.textContent = entry.word;
  els.phonetic.textContent = entry.phonetic ? `(${entry.phonetic})` : "";
  els.phonetic.hidden = !entry.phonetic;

  renderAudio(entry.audio);
  renderDefinitions(entry.definitions);

  els.prevBtn.disabled = state.index <= 0;
  els.nextBtn.disabled = state.index >= state.visibleDates.length - 1;

  syncUrl();
  if (state.tab === "calendar") renderCalendar();
}

function showEmpty(message) {
  els.status.hidden = false;
  els.status.textContent = message;
  // Keep the word tab shell visible so the folder never looks blank
  setTab("word");
  if (els.word) els.word.textContent = "";
  if (els.defs) els.defs.replaceChildren();
  if (els.audioRow) els.audioRow.replaceChildren();
  if (els.dateValue) els.dateValue.textContent = "";
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.visibleDates.length) return;
  state.index = next;
  renderEntry(state.visibleDates[state.index]);
}

function jumpToDate(dateId, { switchTab = true } = {}) {
  const idx = state.visibleDates.indexOf(dateId);
  if (idx < 0) return;
  state.index = idx;
  renderEntry(dateId);
  if (switchTab) setTab("word");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function pickInitialDate(requested) {
  const today = todayId();
  const visible = state.visibleDates;

  if (requested && visible.includes(requested) && requested <= today) {
    return requested;
  }

  for (let i = visible.length - 1; i >= 0; i -= 1) {
    if (visible[i] <= today) return visible[i];
  }
  return null;
}

function setTab(tab) {
  if (!TABS.includes(tab)) tab = "word";
  state.tab = tab;

  for (const btn of els.tabButtons) {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
    btn.tabIndex = active ? 0 : -1;
  }

  const panels = [
    [els.panelWord, "word"],
    [els.panelSearch, "search"],
    [els.panelCalendar, "calendar"],
  ];
  for (const [panel, name] of panels) {
    if (!panel) continue;
    const active = name === tab;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }

  if (els.folder) {
    els.folder.classList.toggle("folder--tab-search", tab === "search");
    els.folder.classList.toggle("folder--tab-calendar", tab === "calendar");
  }

  if (tab === "calendar") {
    try {
      renderCalendar();
    } catch (err) {
      console.error(err);
    }
  }
  if (tab === "search" && els.searchInput) {
    queueMicrotask(() => els.searchInput.focus());
  }

  syncUrl();
}

function bindTabs() {
  for (const btn of els.tabButtons) {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  }

  document.querySelector(".folder__tabs")?.addEventListener("keydown", (event) => {
    const order = els.tabButtons;
    const current = order.findIndex((b) => b.dataset.tab === state.tab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = order.length - 1;
    else return;
    event.preventDefault();
    setTab(order[next].dataset.tab);
    order[next].focus();
  });
}

function renderSearchResults(results, query) {
  els.searchResults.replaceChildren();
  state.searchActive = -1;

  if (!query.trim()) {
    const li = document.createElement("li");
    li.className = "search__empty";
    li.textContent = "Type to search all published words.";
    els.searchResults.appendChild(li);
    return;
  }

  if (!results.length) {
    const li = document.createElement("li");
    li.className = "search__empty";
    li.textContent = "No matches";
    els.searchResults.appendChild(li);
    return;
  }

  results.forEach((hit, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `search-opt-${i}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search__option";
    btn.dataset.dateId = hit.dateId;
    const pct = Math.round(hit.score * 100);
    btn.innerHTML = `
      <span class="search__option-word">${escapeHtml(hit.word)}</span>
      <span class="search__option-meta">${escapeHtml(formatShortDate(hit.dateId))} · ${escapeHtml(hit.matchType)} · ${pct}%</span>
      <span class="search__option-snippet">${escapeHtml(hit.snippet)}</span>
    `;
    btn.addEventListener("click", () => jumpToDate(hit.dateId));
    li.appendChild(btn);
    els.searchResults.appendChild(li);
  });
}

function setActiveOption(nextIndex) {
  const options = [...els.searchResults.querySelectorAll(".search__option")];
  if (!options.length) return;

  state.searchActive = (nextIndex + options.length) % options.length;
  options.forEach((opt, i) => {
    opt.classList.toggle("is-active", i === state.searchActive);
  });
  const active = options[state.searchActive];
  els.searchInput.setAttribute("aria-activedescendant", active.parentElement.id);
  active.scrollIntoView({ block: "nearest" });
}

function onSearchInput() {
  const query = els.searchInput.value;
  const results = searchEntries(query, state.searchDocs, 10);
  renderSearchResults(results, query);
}

function bindSearch() {
  if (!els.searchInput || !els.searchResults) return;
  els.searchInput.addEventListener("input", onSearchInput);
  els.searchInput.addEventListener("keydown", (event) => {
    const options = [...els.searchResults.querySelectorAll(".search__option")];
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOption(state.searchActive + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOption(state.searchActive - 1);
    } else if (event.key === "Enter") {
      if (state.searchActive >= 0 && options[state.searchActive]) {
        event.preventDefault();
        jumpToDate(options[state.searchActive].dataset.dateId);
      } else if (options[0]) {
        event.preventDefault();
        jumpToDate(options[0].dataset.dateId);
      }
    } else if (event.key === "Escape") {
      els.searchInput.value = "";
      onSearchInput();
    }
  });
  onSearchInput();
}

function publishedSet() {
  return new Set(state.visibleDates);
}

function renderCalendar() {
  const today = todayId();
  const selectedId = state.visibleDates[state.index] || "";
  const publishedIds = publishedSet();

  els.calTitle.textContent = monthLabel(state.calYear, state.calMonth);
  els.calPrev.disabled = !canGoPrev(state.calYear, state.calMonth, publishedIds);
  els.calNext.disabled = !canGoNext(state.calYear, state.calMonth, today);

  const cells = buildMonthCells({
    year: state.calYear,
    month: state.calMonth,
    publishedIds,
    todayId: today,
    selectedId,
  });

  els.calGrid.replaceChildren();
  for (const cell of cells) {
    if (cell.day == null) {
      const empty = document.createElement("div");
      empty.className = "cal__cell cal__cell--empty";
      empty.setAttribute("aria-hidden", "true");
      els.calGrid.appendChild(empty);
      continue;
    }

    const selectable = cell.published && !cell.future;
    const el = document.createElement(selectable ? "button" : "div");
    el.className = "cal__cell";
    if (selectable) el.type = "button";
    el.textContent = String(cell.day);

    if (cell.future) el.classList.add("cal__cell--future");
    if (!cell.published) el.classList.add("cal__cell--mute");
    if (selectable) el.classList.add("cal__cell--word");
    if (cell.today) el.classList.add("cal__cell--today");
    if (cell.selected) el.classList.add("cal__cell--selected");

    if (selectable) {
      const word = state.manifest.entries[cell.dateId]?.word || "";
      el.title = word ? `${word} — ${formatShortDate(cell.dateId)}` : formatShortDate(cell.dateId);
      el.setAttribute("aria-label", word ? `${cell.day}, ${word}` : `Day ${cell.day}`);
      el.addEventListener("click", () => jumpToDate(cell.dateId));
    } else {
      el.setAttribute("aria-hidden", "true");
    }

    els.calGrid.appendChild(el);
  }
}

function bindCalendar() {
  if (!els.calPrev || !els.calNext) return;
  els.calPrev.addEventListener("click", () => {
    state.calMonth -= 1;
    if (state.calMonth < 0) {
      state.calMonth = 11;
      state.calYear -= 1;
    }
    renderCalendar();
  });
  els.calNext.addEventListener("click", () => {
    state.calMonth += 1;
    if (state.calMonth > 11) {
      state.calMonth = 0;
      state.calYear += 1;
    }
    renderCalendar();
  });
}

async function init() {
  try {
    els.prevBtn?.addEventListener("click", () => go(-1));
    els.nextBtn?.addEventListener("click", () => go(1));
    bindTabs();
    bindSearch();
    bindCalendar();

    // Show the folder immediately on the default tab
    setTab("word");

    const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Could not load ${MANIFEST_URL}`);
    state.manifest = await res.json();

    const today = todayId();
    state.visibleDates = (state.manifest.availableDates || []).filter((d) => d <= today);

    if (!state.visibleDates.length) {
      showEmpty("No words yet for today or earlier. Add a folder under words/YYYYMMDD/ and push.");
      return;
    }

    state.searchDocs = state.visibleDates.map((dateId) => ({
      dateId,
      entry: state.manifest.entries[dateId],
    }));

    const start = initialMonth(publishedSet(), today);
    state.calYear = start.year;
    state.calMonth = start.month;

    const params = new URLSearchParams(window.location.search);
    const initial = pickInitialDate(params.get("d"));
    state.index = state.visibleDates.indexOf(initial);

    renderEntry(initial);
    els.status.hidden = true;

    const tabParam = params.get("tab");
    setTab(TABS.includes(tabParam) ? tabParam : "word");
  } catch (err) {
    console.error(err);
    showEmpty(
      "Could not load word data. If you just pushed a new day, wait a moment for GitHub to rebuild the site."
    );
  }
}

init();
