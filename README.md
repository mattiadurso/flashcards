# Giud Studia

A static website that turns study material into flashcard quizzes.

Long story short: drop your PDFs into `docs/`, generate question files from them, open the page, and drill the material with multiple-choice flashcards. It was built to study the anatomy and biology of huntable/faunistic species from Italian university PDFs, but the format is generic — any topic works.

No framework, no build step, no npm, no internet — just vanilla HTML + CSS + JavaScript. Everything runs locally from the folder on disk.

---

## What it does

- Shows one flashcard at a time: a question with 2–4 tappable options.
- On answer: highlights correct (green) / wrong (red) and reveals a foldable **Spiegazione** (explanation) box.
- **No repeats** — within a session, and across sessions (seen questions are remembered in `localStorage`) until the whole bank is exhausted.
- **Filter bar**: pick a topic (or *All*), a difficulty if the questions define it, and how many questions to do **per session** (10 / 20 / 30 / 50 / All). The choice is remembered.
- **Progress bar + running score**, e.g. `12 / 87`.
- **Flag a bad question** to hide it; restore all flagged questions later from the header.
- Optional **image** per question (anatomy / ID), tap to open full-size in a lightbox.
- End-of-session reward: score above **90%** shows a random encouraging message; a perfect **100%** gets its own special lines and a golden card (see [Praise messages](#praise-messages)).
- iPhone-quiz look: big rounded card, soft shadows, accent blue, mobile-responsive.

---

## Run it

Most browsers block `fetch()` on `file://`, so you need a tiny local server. Python ships with one on macOS and Windows.

### macOS

Double-click **`start-mac.command`** in Finder.
(First time: right-click → Open → Open to allow the script.)

Or from a terminal:

```sh
cd /path/to/giud_studia
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

### Windows

Double-click **`start-windows.bat`**.

Or from PowerShell / cmd:

```bat
cd C:\path\to\giud_studia
python -m http.server 8000
```

Then open <http://localhost:8000>.

### Phone (same Wi-Fi)

After starting the server, find your Mac/PC's local IP (e.g. `192.168.1.42`) and open `http://192.168.1.42:8000` on your phone.

---

## Folder layout

```
giud_studia/
  index.html             ← the page
  styles.css             ← all styling (light theme, responsive)
  app.js                 ← quiz logic (loading, shuffling, scoring, progress)
  praise.js              ← the >90% / 100% encouragement messages
  docs/                  ← source PDFs, organized by topic (git-ignored)
    Anatomia e biologia/
    ...
  questions/
    index.json           ← manifest: lists every topic file
    anatomia/daino.json  ← a per-topic question bank
    ...
  images/                ← images referenced from questions (jpg/png/webp/svg)
    anatomia/
  QUESTION_FORMAT.md     ← full spec + rules for writing questions
  README.md
  start-mac.command
  start-windows.bat
```

> `docs/` (the PDFs) is in `.gitignore` — source material stays local and isn't published.

---

## Making new questions with Claude (the reuse loop — no code changes)

The whole point of the project: you add PDFs and Claude writes the question files. No coding required.

1. **Drop the PDFs** into `docs/<new-topic>/` (e.g. `docs/cinghiale/`).

2. **Open Claude Code in this folder** (`claude` in the terminal, or the VS Code extension) and ask it to generate the questions. Claude reads the PDFs, follows the rules in `QUESTION_FORMAT.md`, writes `questions/<new-topic>.json`, and appends an entry to `questions/index.json`. Any images it extracts go into `images/<new-topic>/`.

   Example prompts:

   ```text
   Generate questions from docs/cinghiale/ following QUESTION_FORMAT.md.

   Make ~40 questions from docs/Anatomia e biologia/18 Lupo.pdf,
   medium-to-hard, in Italian, and add them as a new topic.

   Read QUESTION_FORMAT.md, then turn every PDF in docs/uccelli/ into
   a question bank and register it in questions/index.json.
   ```

   Tips: point at a whole folder or a single PDF; say how many questions and what difficulty you want; ask Claude to run the pre-flight checklist in `QUESTION_FORMAT.md` before finishing; and remind it not to invent facts (mark anything uncertain as `PLACEHOLDER`).

3. **Reload the page.** The topic dropdown picks up the new topic automatically — selecting it loads just that topic, *All* merges everything. No edits to `index.html` / `app.js` needed.

The website reads `questions/index.json` first, then fetches every file it lists and merges them into one in-memory bank. Per-topic progress is keyed by question `id`, so adding a topic never resets progress on the others.

See **`QUESTION_FORMAT.md`** for the exact JSON schema, writing rules, a worked example, and the pre-flight checklist.

---

## Controls

- **1 – 4** — select an option
- **Enter / Space** — go to next question
- **Esc** — close the image lightbox
- **Reset progress** (top-right) — clear the "already seen" set
- **Ripristina segnalate** (top-right, when present) — un-hide flagged questions

---

## Praise messages

The end-of-session reward lives in **`praise.js`** as two plain arrays of strings:

- `PRAISE` — shown when the score is **above 90%**
- `PRAISE_PERFECT` — shown only on a **perfect 100%**

The lines are in Italian and written in the feminine. To change the wording or add more, just edit/append strings in those arrays — `app.js` picks one at random. The threshold is in `showEndScreen()` in `app.js` (`ratio > 0.9`).

---

## Notes

- Pure static site: no dependencies, works fully offline once the folder is on disk.
- If you edit `styles.css` / `app.js` / `praise.js` and don't see changes, hard-reload (`Cmd+Shift+R` / `Ctrl+F5`) — the files are loaded with `?v=` cache-busting query strings that bump on each change.
