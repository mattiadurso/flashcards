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

It also prints **non-blocking style warnings** (e.g. options that use
"tutte/nessuna delle precedenti", which `QUESTION_FORMAT.md` discourages). These
do **not** fail the build — they're authoring hints.

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
