/**
 * Vocabulario del Barrio — static word-of-the-day engine.
 * Reads data/manifest.json (built from words/). Do not put day content here.
 */

const MANIFEST_URL = "data/manifest.json";

const state = {
  manifest: null,
  /** @type {string[]} past-or-today dates only, ascending */
  visibleDates: [],
  /** index into visibleDates */
  index: -1,
  currentAudio: null,
};

const els = {
  status: document.getElementById("status"),
  panel: document.getElementById("panel"),
  dateLabel: document.getElementById("date-label"),
  dateValue: document.getElementById("date-value"),
  prevBtn: document.getElementById("prev-day"),
  nextBtn: document.getElementById("next-day"),
  word: document.getElementById("word"),
  phonetic: document.getElementById("phonetic"),
  audioRow: document.getElementById("audio-row"),
  defs: document.getElementById("defs"),
};

function todayId(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDisplayDate(dateId) {
  const y = Number(dateId.slice(0, 4));
  const m = Number(dateId.slice(4, 6)) - 1;
  const d = Number(dateId.slice(6, 8));
  const dt = new Date(y, m, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dt);
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

  const url = new URL(window.location.href);
  url.searchParams.set("d", dateId);
  history.replaceState({ dateId }, "", url);
}

function showEmpty(message) {
  els.status.hidden = false;
  els.status.textContent = message;
  els.panel.hidden = true;
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.visibleDates.length) return;
  state.index = next;
  renderEntry(state.visibleDates[state.index]);
}

function pickInitialDate(requested) {
  const today = todayId();
  const visible = state.visibleDates;

  if (requested && visible.includes(requested) && requested <= today) {
    return requested;
  }

  // Most recent available date on or before today
  for (let i = visible.length - 1; i >= 0; i -= 1) {
    if (visible[i] <= today) return visible[i];
  }
  return null;
}

async function init() {
  els.prevBtn.addEventListener("click", () => go(-1));
  els.nextBtn.addEventListener("click", () => go(1));

  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Could not load ${MANIFEST_URL}`);
    state.manifest = await res.json();
  } catch (err) {
    console.error(err);
    showEmpty(
      "Could not load word data. If you just added days under words/, run: node scripts/build.mjs"
    );
    return;
  }

  const today = todayId();
  state.visibleDates = (state.manifest.availableDates || []).filter((d) => d <= today);

  if (!state.visibleDates.length) {
    showEmpty("No words yet for today or earlier. Add a folder under words/YYYYMMDD/ and rebuild.");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const initial = pickInitialDate(params.get("d"));
  state.index = state.visibleDates.indexOf(initial);

  els.status.hidden = true;
  els.panel.hidden = false;
  renderEntry(initial);
}

init();
