# Giud Studia

Local flashcard quiz for studying anatomy and biology of huntable / faunistic species from Italian university PDFs.

No framework, no build step, no npm — vanilla HTML + CSS + JavaScript.

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
giud_studia_quiz/
  index.html
  styles.css
  app.js
  docs/                  ← source PDFs, organized by topic
    anatomia/
    capriolo/
    ...
  questions/
    index.json           ← manifest listing every topic file
    capriolo.json        ← per-topic question bank
    ...
  images/                ← images referenced from questions
  QUESTION_FORMAT.md     ← spec for adding new questions
  README.md
  start-mac.command
  start-windows.bat
```

---

## Adding a new topic

1. Drop the PDFs into `docs/<new-topic>/`.
2. In a new Claude session ask: *"generate questions from `docs/<new-topic>/`"* — Claude reads the PDFs, follows `QUESTION_FORMAT.md`, writes `questions/<new-topic>.json`, and appends an entry to `questions/index.json`. Any images extracted from the PDFs go into `images/<new-topic>/`.
3. Reload `index.html`. The topic dropdown picks up the new topic automatically — no code edits needed.

See `QUESTION_FORMAT.md` for the exact schema and writing rules.

---

## Controls

- **1 – 4** — select an option
- **Enter / Space** — go to next question
- **Esc** — close the image lightbox
- **Reset progress** (top-right) — clear the `localStorage` "already seen" set
