# Flashcards

A static website that turns study material into Flashcards quizzes.

Long story short: drop your PDFs into `docs/`, generate question files from them, open the page, and drill the material with Flashcards — both multiple-choice and fill-in-the-blank. It was built to study the anatomy and biology of huntable/faunistic species from Italian university PDFs, but the format is generic — any topic works.

No framework, no build step, no npm, no internet — just vanilla HTML + CSS + JavaScript. Everything runs locally from the folder on disk.

**Live:** <https://mattiadurso.com/flashcards>

---

## What it does

- **Setup screen first** — every session starts on *Imposta la sessione*, where you choose **Argomenti** (topics), **Difficoltà**, and **how many questions**, then tap **Inizia**.
- **Topics multi-select** — take a whole subject group or just specific species, with *Tutti / Nessuno* shortcuts and a live *"N disponibili"* count.
- **Session length** — quick chips (10 / 20 / 30 / 50 / *Tutte*); your choice is remembered.
- One Flashcards at a time, in two flavours:
  - **multiple-choice** — a question with 2–4 tappable options;
  - **fill-in-the-blank** (`type: "fill"`) — you **type** the missing word(s) into the sentence; matching is case-, accent- and space-insensitive, with synonyms accepted. Used mainly for definitions and key terms.
- Optional foldable **Suggerimento** (hint) per question, before you commit.
- On answer: highlights correct (green) / wrong (red) and reveals a foldable **Spiegazione** (explanation).
- **No repeats** — within a session, and across sessions (seen questions are remembered in `localStorage`) until the whole bank is exhausted.
- **Progress bar + running score**, e.g. `12 / 87`.
- **Per-argument results** at the end — accuracy per species, weakest first, with colored bars.
- **Reward screen** — score above **90%** shows a random encouraging message; a perfect **100%** gets its own lines and a golden card (see [Praise messages](#praise-messages)).
- **Flag a bad question** to hide it; restore all flagged questions later from the header.
- iPhone-quiz look: big rounded card, soft shadows, accent blue, light theme, mobile-responsive.

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
    index.json                  ← manifest: every topic file, with species + counts
    Anatomia_e_Biologia/        ← one folder per subject; one JSON per species
      daino.json
      cervo.json
      ...
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

2. **Open Claude Code in this folder** (`claude` in the terminal, or the VS Code extension) and ask it to generate the questions. Claude reads the PDFs, follows the rules in `QUESTION_FORMAT.md`, writes `questions/<new-topic>.json`, and appends an entry to `questions/index.json`.

   Example prompts:

   ```text
   Generate questions from docs/cinghiale/ following QUESTION_FORMAT.md.

   Make ~40 questions from docs/Anatomia e biologia/18 Lupo.pdf,
   medium-to-hard, in Italian, and add them as a new topic.

   Read QUESTION_FORMAT.md, then turn every PDF in docs/uccelli/ into
   a question bank and register it in questions/index.json.
   ```

   Tips: point at a whole folder or a single PDF; say how many questions and what difficulty you want; ask Claude to run the pre-flight checklist in `QUESTION_FORMAT.md` before finishing; and remind it not to invent facts (mark anything uncertain as `PLACEHOLDER`).

3. **Reload the page.** The new species/topic shows up automatically in the **Argomenti** list on the setup screen — tick it (or *Tutti*) and tap **Inizia**. No edits to `index.html` / `app.js` needed.

The website reads `questions/index.json` first, then fetches every file it lists and merges them into one in-memory bank. Per-topic progress is keyed by question `id`, so adding a topic never resets progress on the others.

See **`QUESTION_FORMAT.md`** for the exact JSON schema, writing rules, a worked example, and the pre-flight checklist.

---

## Controls

- **1 – 4** — select an option (multiple-choice questions)
- **Enter** — submit your typed answer (fill-in-the-blank questions)
- **Enter / Space** — go to the next question
- **h** — toggle the hint (*Suggerimento*) when the question has one
- **Esc** — close the topics menu
- **‹ Nuova sessione** (header, during a session) — back to the setup screen
- **Title** (top-left, *✨ Giud's Flashcards ✨*) — click it to return to the initial setup screen
- **Reset progress** (header) — clear the "already seen" set
- **Ripristina segnalate** (header, when present) — un-hide flagged questions

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

---

## License & scope

Personal study tool. The code is yours to reuse / modify; PDFs under `docs/` are not redistributed (university material, kept local via `.gitignore`).
