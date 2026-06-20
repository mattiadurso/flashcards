# Tests

Automated checks for the Flashcards project. They run on plain **`python3`** —
no `npm`, no dependencies, no build step — to match the project's constraints.
(`python3` is already required to serve the site locally.)

## What is covered

`test_question_banks.py` validates the question data — the contract the website
(`app.js`) relies on at runtime. It mirrors the rules in `QUESTION_FORMAT.md`:

- **Manifest** (`questions/index.json`) parses, lists every bank file, has no
  duplicate or missing paths, no orphan `.json` files on disk, and every
  `count` matches the actual number of questions in the file.
- **Schema** — every question has a well-formed, stable `id`, non-empty
  `question` text, a resolvable `source`, and a valid `difficulty` when present.
- **Multiple-choice** — 2–4 non-empty, unique options and a `correctIndex`
  that points inside them.
- **Fill-in-the-blank** (`type: "fill"`) — no `options`/`correctIndex`, and the
  number of `___` blanks matches the number of `answers` groups.
- **Global** — every `id` is unique across all banks *and* the easter eggs
  (the website keys "seen"/"flagged" state on `id`, so a collision is a bug).

It also prints **non-blocking style warnings** — authoring hints that don't fail
the build:

- options that use "tutte/nessuna delle precedenti", which `QUESTION_FORMAT.md`
  discourages;
- the **length-parity tell** — files where the correct answer is the *single
  longest* option in more than half the questions (see `QUESTION_FORMAT.md` §3,
  *Answer-length parity & borderline distractors*). A high share means questions
  can be solved by picking the longest option without reading them.

`test_app_navigation.py` and `test_i18n.py` cover **app behaviour** rather than
data. Since the harness has no JavaScript runtime, they are *static-source*
checks: they read `app.js` / `index.html` / `i18n.js` and assert each guarantee a
regression could silently break.

- **Back/Forward navigation** (`test_app_navigation.py`) — the per-session history
  exists and Back/Next are wired to it; Back is hidden on the first question;
  and, crucially, revisiting a question is **read-only** (the replay path never
  re-grades, touches the score, or re-marks "seen").
- **it/en translation** (`test_i18n.py`) — the two language maps in `i18n.js`
  define the **same keys**, placeholders (`{name}`) match across languages, every
  `data-i18n*` key in the markup and every literal `t('…')` key in `app.js`
  resolves, and the language switch is wired up. This catches the classic i18n
  bug: a string added to one language but not the other.

## Running

```sh
# hard tests only
python3 -m unittest discover -s tests

# hard tests + style warnings (what the commit hook runs)
python3 tests/test_question_banks.py
```

## Pre-commit hook

A git hook runs these tests before every commit and aborts the commit if any
fail. It is version-controlled in `.githooks/`. **Enable it once per clone:**

```sh
git config core.hooksPath .githooks
```

To bypass it for a single commit (e.g. a work-in-progress): `git commit --no-verify`.
If `python3` isn't installed, the hook skips the tests instead of blocking.

## Adding tests

Per `CLAUDE.md`, new functionality should come with a test. When you add a new
question field, manifest shape, or any app behaviour backed by a checkable data
contract, add a `unittest` case here (follow the
[Google Python Style Guide](https://google.github.io/styleguide/pyguide.html),
like the existing file).
