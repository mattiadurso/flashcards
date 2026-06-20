I'm a bachelor student in natural sciences. I need to study the anatomy and biology of huntable (venatorie) and faunistic species from Italian university PDFs, and I want a local Flashcards quiz website to drill the material.

Please deliver two artifacts in one project folder:

Artifact 1 — QUESTION_FORMAT.md

A specification document I (or you, in a later session) can follow to convert any arbitrary PDF into the question file consumed by the website. It must specify:

- The exact JSON schema for a question bank file (questions.json), including fields like id, topic, species (optional), question, options[], correctIndex, explanation (optional), difficulty (optional), source (PDF name + page), image (optional — relative path to an image file in an images/ subfolder, e.g. "images/capriolo-skull.jpg"; used for anatomy/ID questions where a visual is essential).
- Rules for writing meaningful questions from a PDF:
  - Prefer concept-checking questions over trivia ("Why does X have feature Y?" beats "What color is X?").
  - 2 to 4 plausible options; distractors must be from the same domain (other species, related anatomical structures, plausible-but-wrong mechanisms) — no obvious throwaways.
  - Avoid "all of the above" / "none of the above".
  - Each question must stand alone (no "as seen in the previous question").
  - Italian language for questions and options (since my source material is Italian); keep schema keys in English.
- A short worked example: a paragraph of fake PDF text → 3 well-formed JSON questions.
- A checklist I can run through before adding a new batch of questions.
- Guidance on unique stable IDs so the website can track "already seen" without duplicates even after I add new questions.

Artifact 2 — The local website

A single-folder static site that runs by simply opening index.html in any modern browser on macOS and Windows — no build step, no server, no npm. Use vanilla HTML + CSS + JavaScript only. Load questions.json via fetch — and because some browsers block fetch on file://, also include a one-line note in a README.md telling me how to start it (e.g. python3 -m http.server on Mac, python -m http.server on Windows) and a start-mac.command + start-windows.bat that launch the server and open the browser.

Behavior

- On load, read questions.json and shuffle.
- Show one Flashcards at a time with the question and its 2–4 options as tappable buttons.
- If a question has an `image` field, render the image above the question text, constrained to the card width with rounded corners; tap/click to view full-size in a lightbox overlay (dismiss on click or Esc).
- On answer: highlight correct (green) and wrong (red), show the explanation if present, then a "Next" button.
- No repeats within a session: track seen IDs in memory; when all questions are seen, show a "Session complete" screen with score and a "Restart" button.
- No repeats across sessions until exhausted: persist seen IDs in localStorage; only reset when the full bank has been seen, or when I click a "Reset progress" button in the header.
- Filter bar at the top: dropdown to pick topic (or "All"), and a difficulty toggle if the field is present.
- Keyboard shortcuts: 1–4 to pick an option, Enter or Space for Next.
- Progress indicator: 12 / 87 and a thin progress bar.
- Running score for the session.

Visual style — iPhone quiz app feel

- Large rounded card (border-radius ~24px), soft shadow, generous padding, centered on screen.
- System font stack starting with -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI".
- Light and dark mode via prefers-color-scheme.
- Option buttons: full-width pill shape, subtle press animation, haptic-like color flash on tap.
- Smooth card slide/fade transition between questions (CSS transitions, no libraries).
- Mobile-responsive (so I can also open it on my phone over the local network).
- Accent color: a single tasteful color (e.g. iOS blue #0A84FF) used consistently.

Deliverable structure

giud_studia_quiz/
  index.html
  styles.css
  app.js
  docs/                   ← source PDFs, organized by topic
    capriolo/             ← one subfolder per topic; drop PDFs (and any extracted images) here
    cinghiale/
    ...
  questions/
    index.json            ← manifest listing all topic files: [{ "topic": "capriolo", "file": "capriolo.json" }, ...]
    capriolo.json         ← per-topic question bank (same schema as questions.json)
    ...
  images/                 ← optional images referenced by questions (jpg/png/webp/svg)
                            include at least 1 placeholder image so the image flow is verifiable
  QUESTION_FORMAT.md
  README.md
  start-mac.command
  start-windows.bat

Reusability workflow (this is the whole point — the project must support this loop without code changes):

1. I drop a new folder of PDFs into `docs/<new-topic>/`.
2. I ask Claude in a later session: "generate questions from docs/<new-topic>/" — Claude reads the PDFs, follows QUESTION_FORMAT.md, writes `questions/<new-topic>.json`, and appends an entry to `questions/index.json`. Images extracted from the PDFs land in `images/<new-topic>/`.
3. I reload index.html. The topic dropdown auto-populates from `questions/index.json` — the new topic appears with no code edit. Selecting it loads only that topic's questions; selecting "All" merges every topic file.

Implications for the website:
- On load, fetch `questions/index.json` first, then fetch each referenced topic file and merge into one in-memory bank.
- The topic dropdown is built from the manifest, not hardcoded.
- Per-topic `seen` state in localStorage is keyed by question id (already globally unique per QUESTION_FORMAT.md rules), so adding a new topic file never resets progress on existing topics.
- For the seed delivery, include 1–2 example topic files under `questions/` and a matching `index.json` so the flow is verifiable end-to-end.

Constraints

- No frameworks, no build tools, no CDNs. Everything offline-capable once the folder is on disk.
- Code should be readable and commented only where the why isn't obvious — I'll be extending it.
- Don't invent biological facts in the seed questions; if unsure, mark the example questions clearly as "source": "PLACEHOLDER — replace with real PDF content".

Build everything, then end your reply with (a) the exact commands to launch it on Mac and Windows and (b) the next step I should take to load my own PDF content.

---

## Repository map

> **Read this first.** This section is the single source of truth for *where things
> live*. A new session should be able to orient itself from this map alone. The
> annotated tree below reflects the repo as it actually is — note it has grown
> past the original brief above (two-level `questions/<Subject>/` folders, a nested
> `index.json`, `praise.js`, hidden easter eggs, and no `images/` folder yet).

```
flashcards/                      ← repo root (GitHub repo is "flashcards"; was "giud_studia" — see note below)
  index.html                     ← the only page; markup + header controls (theme toggle, lang it/en, Reset, Restore flagged)
  styles.css                     ← all styling; light/dark via data-theme + prefers-color-scheme
  app.js                         ← all app logic (~1500 lines): load manifest → fetch banks → quiz loop (incl. Back/Forward nav + i18n)
  praise.js                      ← end-of-session encouragement phrases (Italian); picked by score band
  i18n.js                        ← UI string tables (it/en) read by app.js; questions stay in their authored language
  QUESTION_FORMAT.md             ← AUTHORITATIVE spec for question JSON + index.json manifest schema
  README.md                      ← how to run the site (local server) + the "generate questions" workflow
  start-mac.command              ← double-click launcher: starts python http.server + opens browser (macOS)
  start-windows.bat              ← same for Windows
  CLAUDE.md                      ← this file (project brief + conventions + this map)

  docs/                          ← source material, organised by macro-subject (one folder per subject)
    Anatomia_e_Biologia/         ← course 1: each lecture is a "NN name.pdf" plus an extracted "NN name.txt"
    Bio-Chimica/                 ← course 2: PDFs and .pptx source decks
  questions/                     ← the question banks the website actually loads
    index.json                   ← MANIFEST. Lists every bank file; a file not listed here is invisible to the site
    Anatomia_e_Biologia/         ← one JSON bank per species/lecture (cervo.json, capriolo.json, …)
    Bio-Chimica/                 ← one JSON bank per topic (mercurio.json, ddt.json, …)
    easter-eggs.json             ← hidden "bonus" questions; deliberately NOT in index.json; spliced in at random
  tests/
    test_question_banks.py       ← validates every bank + index.json against QUESTION_FORMAT.md (plain python3)
    test_app_navigation.py       ← static-source checks for the Back/Forward navigation contract (read-only revisits)
    test_i18n.py                 ← static-source checks for the it/en translation contract (key parity, wiring)
    README.md                    ← how to run/extend the tests
  .githooks/pre-commit           ← runs the tests; blocks commit on failure (enable: git config core.hooksPath .githooks)
```

**Core files — what each does**

- `index.html` — single screen. Header holds the day/dark **theme toggle**, **Reset progress**, and **Restore flagged** buttons; an inline `<script>` applies the saved theme before paint to avoid a flash. The setup screen opens with a **language switch (it/en)**. Body is the card, the topic/difficulty filter ("Argomenti"), and the session-complete screen. Translatable chrome carries `data-i18n` / `data-i18n-html` / `data-i18n-title` / `data-i18n-aria-label` attributes that `app.js` fills in.
- `app.js` — everything: reads `questions/index.json`, fetches each listed bank, merges into one in-memory `state.bank`, then runs a non-repeating quiz. Supports multiple-choice **and** `fill` (fill-in-the-blank) questions, **Back/Forward navigation** through a per-session history (revisited cards are replayed read-only — answers/score never change), per-question **flagging**, a **"mastered"** pool (ids answered correctly are retired), a session-length selector, topic groups that fold/unfold, and **it/en UI translation** (the `t()` helper + `applyLanguage()`). Easter eggs load separately and are spliced into the queue with a small probability.
- `praise.js` — arrays of Italian phrases keyed to score bands (`PRAISE_PERFECT` / `PRAISE` / `PRAISE_GOOD` / `PRAISE_OK` / `PRAISE_LOW`); `app.js` picks one at session end. (Italian only — not translated.)
- `i18n.js` — `const I18N = { it: {...}, en: {...} }`: one flat key→string map per language for the UI chrome. Keep the two key sets identical (a test enforces it). Questions, explanations, hints and praise stay in their authored language (Italian).
- `QUESTION_FORMAT.md` — the contract for question files **and** the `index.json` manifest. When touching either, treat this doc as authoritative and keep it, the banks, and the tests in agreement.

**Data flow / how questions reach the screen**

1. `app.js` fetches `questions/index.json` (the manifest).
2. The manifest's real shape is **nested**: `{ "topics": [ { "topic", "label", "files": [ { "species", "file", "source", "count" }, … ] } ] }`. (`app.js` also still accepts the legacy flat `[{ topic, file }]` array.) Full field docs live in QUESTION_FORMAT.md → "`questions/index.json`".
3. Each `file` path is relative to `questions/` (e.g. `Anatomia_e_Biologia/daino.json`). All banks are fetched and merged into one in-memory bank.
4. The "Argomenti" filter shows one selectable entry per `species`, grouped under its `label`.
5. `questions/easter-eggs.json` is fetched on its own (not via the manifest) and kept out of the score.

**Key facts & gotchas a new session needs**

- **No build, no deps.** Vanilla HTML/CSS/JS; tests are plain `python3`. Open via a local server (fetch is blocked on `file://`) — see README.
- **The manifest is load-bearing.** Adding a `questions/<Subject>/<file>.json` does nothing until you add its `{ species, file, source, count }` entry to the right `topics[].files` array in `index.json`. This is the reusability workflow's one required edit.
- **localStorage key prefix is `giud_studia.`** (e.g. `giud_studia.seen.v1`, `.correct.v1`, `.flagged.v1`, `.length.v1`, `.topics.v1`, `.theme.v1`, `.folds.v1`, `.lang.v1`). Keep this prefix despite the repo rename — changing it wipes everyone's saved progress. (See the `repo-moved-to-flashcards` memory.)
- **UI language is it/en, questions are not translated.** The switch on the setup screen sets `giud_studia.lang.v1` (default `it`). Only interface chrome is translated, via `i18n.js` + `data-i18n*` attributes; question/explanation/hint/praise text stays as authored. When you add UI copy, add a key to BOTH languages in `i18n.js` (don't hardcode the string in `app.js`/`index.html`).
- **`images/` does not exist yet.** The `image` field is supported by the schema and the app, but no question uses it and there's no `images/` folder. Create `images/<subject>/` only when a question actually needs a visual.
- **Two question types:** standard multiple-choice and `fill` (fill-in-the-blank). See QUESTION_FORMAT.md before authoring either.

## Development conventions

These apply to every change in this repo, in any future session.

### Keep the Repository map current — required after every change

The **Repository map** above must stay accurate. Whenever a change alters the
repo's *structure or where-is-what* — adding/removing/renaming a file or folder,
changing what a core file does, changing the `index.json` manifest shape, adding a
question type or field, adding an `images/` folder, changing a localStorage key,
etc. — update the Repository map (and any other affected part of this file) **in
the same change**, so a future session still needs only `CLAUDE.md` to orient
itself. A purely content-level edit (e.g. adding more questions to an existing
bank, or a new bank that follows the existing pattern) does not need a map edit,
but adding a *new macro-subject folder* or a new top-level file does. If in doubt,
update it. Treat an out-of-date map as a bug.

### Code readability — Google style guides

All code should follow the relevant **Google style guide** for readability:

- JavaScript → [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- Python → [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
- HTML/CSS → [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)

Key points to keep applying: descriptive `camelCase` names (JS) / `snake_case` (Python), small single-purpose functions, no dead code, consistent 2-space indentation in JS/HTML/CSS and 4-space in Python, and comments that explain the **why**, not the **what** (the existing code already does this — match it). Prefer clarity over cleverness; the owner is a student who will be extending this.

### Testing — required for new functionality

When you **add or change a behaviour**, add or update a test for it under `tests/`. Don't ship new functionality untested.

- Tests live in `tests/` and run on plain `python3` (no dependencies, no npm), matching the project's "no build tools" constraint. Add one for every new feature you add.
- Run them with `python3 -m unittest discover -s tests` (or `python3 tests/test_question_banks.py` to also see non-blocking style warnings).
- A **pre-commit git hook** (`.githooks/pre-commit`) runs the tests automatically and blocks the commit if any fail. Enable it once per clone with `git config core.hooksPath .githooks`.
- The current suite (`tests/test_question_banks.py`) validates the question banks and `index.json` against QUESTION_FORMAT.md — the contract the website depends on. When you add a new kind of question field, manifest shape, or app behaviour with a checkable data contract, extend these tests to cover it.
- See `tests/README.md` for details.