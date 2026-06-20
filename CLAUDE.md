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

## Development conventions

These apply to every change in this repo, in any future session.

### Code readability — Google style guides

All code should follow the relevant **Google style guide** for readability:

- JavaScript → [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- Python → [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
- HTML/CSS → [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)

Key points to keep applying: descriptive `camelCase` names (JS) / `snake_case` (Python), small single-purpose functions, no dead code, consistent 2-space indentation in JS/HTML/CSS and 4-space in Python, and comments that explain the **why**, not the **what** (the existing code already does this — match it). Prefer clarity over cleverness; the owner is a student who will be extending this.

### Testing — required for new functionality

When you **add or change a behaviour**, add or update a test for it under `tests/`. Don't ship new functionality untested.

- Tests live in `tests/` and run on plain `python3` (no dependencies, no npm), matching the project's "no build tools" constraint.
- Run them with `python3 -m unittest discover -s tests` (or `python3 tests/test_question_banks.py` to also see non-blocking style warnings).
- A **pre-commit git hook** (`.githooks/pre-commit`) runs the tests automatically and blocks the commit if any fail. Enable it once per clone with `git config core.hooksPath .githooks`.
- The current suite (`tests/test_question_banks.py`) validates the question banks and `index.json` against QUESTION_FORMAT.md — the contract the website depends on. When you add a new kind of question field, manifest shape, or app behaviour with a checkable data contract, extend these tests to cover it.
- See `tests/README.md` for details.