# Vocabulario del Barrio

Static **word of the day** site for GitHub Pages — Caribbean Spanish with Puerto Rican / Dominican flavor.

Open the site → you get **today’s word** (or the most recent day on or before today). Future dates are never shown. Use ← / → to walk earlier and later published days.

## Layout

| Path | Role |
|------|------|
| `words/` | **All content you edit** — one folder per day |
| `engine/` | Site UI (CSS + JS). Leave alone day-to-day |
| `index.html` | Page shell |
| `scripts/build.mjs` | Scans `words/` → writes `data/manifest.json` |
| `data/manifest.json` | Generated. Do not hand-edit |

## Adding a word

1. Create `words/YYYYMMDD/` (example: `20261124` = Nov 24, 2026).
2. Fill files as below.
3. Run:

```bash
node scripts/build.mjs
```

4. Commit and push. (A GitHub Action also rebuilds the manifest when `words/` changes.)

### Day folder shape

```
words/20261009/
  word.txt              ← Spanish word (required)
  phonetic.txt          ← pronunciation spelling → shown as (koo-CHEE-yo)
  pronunciation-pr.wav  ← any audio file = a playable pronunciation
  pronunciation-dr.wav
  1/                    ← definition #1
    definition.txt      ← English gloss
    connotation.txt     ← theme → shown as (trauma)
    knife.png           ← any image = illustration for this sense
    kitchen.png
    example-cooking.txt ← line 1 Spanish, line 2 English
    example-street.txt
  2/                    ← definition #2
    …
```

**Rules the builder uses**

- `word.txt` / `phonetic.txt` at the day root
- Audio extensions: `.wav` `.mp3` `.flac` `.ogg` `.m4a` `.aac` `.webm` `.opus` — button label comes from the filename
- Numbered folders `1`, `2`, … = definitions (order by number)
- Inside a definition folder: `definition.txt`, `connotation.txt`, image files, and **any other** `.txt` = example sentences (ES then EN)
- `.heic` / `.heif` are kept in the data tree but skipped in the browser (convert to `.jpg` / `.png` for display)

See **`words/20261009/`** (`cuchillo`) for a full worked example.

## GitHub Pages

1. Repo **Settings → Pages → Deploy from a branch** → `main` (or your default) `/ (root)`.
2. Site URL will be `https://<user>.github.io/<repo>/`.

Because assets are loaded with relative paths, it works at the repo root or a project Pages URL.

## Local preview

```bash
node scripts/build.mjs
python3 -m http.server 8080
# open http://localhost:8080
```

## Notes / open choices

- **“Today”** uses the visitor’s local calendar date.
- Days without `word.txt` are skipped at build time.
- Gaps in the calendar are fine — ← / → jump to the previous/next *published* day, not empty calendar days.
- Placeholder audio in the sample are short tones so you can hear the buttons; replace with real recordings anytime.
