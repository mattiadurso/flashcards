# QUESTION_FORMAT.md

Specification for converting an arbitrary PDF into a question file consumed by the Giud Studia quiz site.

Follow this document end-to-end when generating a new topic. Schema keys are **English**; question text and options are **Italian**.

---

## 1. File layout

Every topic is one JSON file under `questions/`, plus an entry in `questions/index.json`:

```
questions/
  index.json                 ← manifest (list of topics)
  capriolo.json              ← one file per topic
  cinghiale.json
  ...
images/
  capriolo/                  ← topic-scoped images
    skull-side.jpg
  ...
docs/
  capriolo/                  ← source PDFs (and any extracted images)
    anatomia.pdf
```

### `questions/index.json`

The manifest can use one of two shapes. **Pick whichever fits your folder layout — the website accepts both.**

**Flat form** — one JSON file per topic, sitting directly under `questions/`:

```json
[
  { "topic": "capriolo",  "file": "capriolo.json"  },
  { "topic": "cinghiale", "file": "cinghiale.json" }
]
```

**Nested form** — a topic can group several species/source files under a subfolder (e.g. `questions/anatomia/daino.json`, `questions/anatomia/capriolo.json`):

```json
{
  "topics": [
    {
      "topic": "anatomia",
      "label": "Anatomia e biologia",
      "files": [
        { "species": "Daino (Dama dama)",      "file": "anatomia/daino.json",      "source": "docs/anatomia/DAINO.pdf" },
        { "species": "Capriolo (Capreolus c.)", "file": "anatomia/capriolo.json",   "source": "docs/anatomia/CAPRIOLO.pdf" }
      ]
    }
  ]
}
```

Values declared at the manifest level (`topic`, `species`, `source`) are inherited by every question in that file when not already set on the question itself. The website builds its topic dropdown from the union of all `topic` values — add an entry whenever you introduce a new file.

### `questions/<topic>.json`

Either a flat array of question objects, or `{ "questions": [...] }`. The flat array is preferred.

---

## 2. Question schema

```jsonc
{
  "id": "capriolo-anat-skull-001",      // REQUIRED, globally unique, stable
  "topic": "capriolo",                  // OPTIONAL — inferred from index.json if absent
  "species": "Capreolus capreolus",     // OPTIONAL — Latin name or common name
  "question": "Perché …?",              // REQUIRED, Italian
  "options": [                          // REQUIRED, 2 to 4 entries, Italian
    "Opzione A",
    "Opzione B",
    "Opzione C"
  ],
  "correctIndex": 1,                    // REQUIRED, 0-based
  "explanation": "…",                   // OPTIONAL but strongly encouraged, Italian
  "difficulty": "easy",                 // OPTIONAL: "easy" | "medium" | "hard"
  "source": "DAINO.pdf p.14",           // REQUIRED for traceability — PDF + page
  "image": "images/capriolo/skull.jpg"  // OPTIONAL — relative to project root
}
```

### Field rules

| Field          | Rule |
|----------------|------|
| `id`           | Globally unique across **all** topic files. Format: `<topic>-<area>-<slug>-<3digit>`, e.g. `capriolo-anat-mandibola-007`. NEVER reuse an id, even after a question is rewritten — bump the trailing number. The site uses `id` to track "already seen". |
| `topic`        | Lowercase, no spaces, hyphens allowed. Must match the folder name under `docs/` and the `topic` value in `index.json`. |
| `question`     | Italian, single sentence, ends with `?`. No "as seen above" / "in the previous question". Stand-alone. |
| `options`      | 2–4 plausible answers. Distractors must come from the **same domain**: other huntable species, related anatomical structures, plausible-but-wrong mechanisms. **No** "tutte le precedenti" / "nessuna delle precedenti". |
| `correctIndex` | Integer in `[0, options.length - 1]`. |
| `explanation`  | One short paragraph explaining **why** the answer is correct (and ideally why the others are not). Italian. |
| `difficulty`   | Only the three strings listed. Omit when unsure. |
| `source`       | Always include the source PDF file name and page number(s), e.g. `"DAINO.pdf p.14"` or `"DAINO.pdf pp.14-15"`. |
| `image`        | Relative path from project root. Used for anatomy / ID questions where a visual is essential. Place files under `images/<topic>/`. |

---

## 3. Writing meaningful questions

The point of the quiz is **understanding**, not trivia recall.

**Prefer** concept-checking questions:

> *"Perché il capriolo, a differenza del cervo, presenta un rumine relativamente piccolo?"*

**Avoid** flat trivia:

> ~~*"Di che colore è il pelo invernale del capriolo?"*~~ (unless the colour itself carries diagnostic value — e.g. distinguishing two species in the field).

Guidelines:

- One idea per question. If you find yourself writing "e inoltre", split it.
- Distractors should be the kind of mistake a real student would make: confuse two similar species, swap two anatomical structures, invert a cause and effect.
- If the PDF gives a number (gestation length, weight), prefer asking *why* it differs from a related species, not the bare number.
- When asking about an image, the question must reference what is visible (`"Quale struttura è indicata dalla freccia?"`) and the `image` field must be set.
- 2–4 options. Three is the sweet spot — four only when you have four genuinely plausible answers.

---

## 4. Worked example

Source paragraph (fake, illustrative):

> *"Il capriolo (Capreolus capreolus) è un ruminante di piccola taglia, classificato come "concentrate selector": seleziona attivamente germogli, gemme e foglie tenere ad alto contenuto proteico. Per questa ragione possiede un rumine di dimensioni ridotte rispetto a quello del cervo nobile, ed una bocca stretta con labbro superiore prensile. La sua attività è prevalentemente crepuscolare." — DAINO.pdf p.12*

Three well-formed questions:

```json
[
  {
    "id": "capriolo-eco-feeding-001",
    "topic": "capriolo",
    "species": "Capreolus capreolus",
    "question": "Perché il capriolo è classificato come 'concentrate selector'?",
    "options": [
      "Si nutre di grandi quantità di erbe fibrose come il cervo nobile",
      "Seleziona attivamente germogli e gemme ad alto contenuto proteico",
      "Predilige cortecce e legno secco durante l'inverno"
    ],
    "correctIndex": 1,
    "explanation": "Il capriolo seleziona porzioni vegetali concentrate in nutrienti (germogli, gemme, foglie tenere), strategia opposta ai grazer che ingeriscono grandi volumi di foraggio fibroso.",
    "difficulty": "easy",
    "source": "DAINO.pdf p.12"
  },
  {
    "id": "capriolo-anat-rumen-001",
    "topic": "capriolo",
    "species": "Capreolus capreolus",
    "question": "Per quale ragione il rumine del capriolo è più piccolo rispetto a quello del cervo nobile?",
    "options": [
      "Perché il capriolo è una specie più giovane dal punto di vista evolutivo",
      "Perché si alimenta di vegetali altamente digeribili e ricchi di proteine",
      "Perché vive in ambienti più freddi e ha un metabolismo ridotto"
    ],
    "correctIndex": 1,
    "explanation": "Una dieta concentrata e altamente digeribile non richiede un grande volume fermentativo: il rumine è quindi proporzionalmente ridotto rispetto a quello dei grazer.",
    "difficulty": "medium",
    "source": "DAINO.pdf p.12"
  },
  {
    "id": "capriolo-anat-mouth-001",
    "topic": "capriolo",
    "species": "Capreolus capreolus",
    "question": "Quale caratteristica della bocca del capriolo riflette il suo comportamento alimentare?",
    "options": [
      "Bocca larga con lingua prensile, utile a strappare l'erba",
      "Bocca stretta con labbro superiore prensile, utile a selezionare singoli germogli",
      "Denti incisivi presenti su entrambe le arcate, per tagliare fibre dure"
    ],
    "correctIndex": 1,
    "explanation": "La bocca stretta e il labbro superiore prensile permettono al capriolo di selezionare con precisione i bocconi più nutrienti, coerentemente con la strategia 'concentrate selector'.",
    "difficulty": "medium",
    "source": "DAINO.pdf p.12"
  }
]
```

---

## 5. Pre-commit checklist

Run through this list before adding a new batch:

- [ ] Each `id` is unique across **every** file in `questions/`.
- [ ] Every question is in Italian; every JSON key is in English.
- [ ] Every question has 2–4 options and a valid `correctIndex`.
- [ ] No "tutte le precedenti" / "nessuna delle precedenti".
- [ ] Distractors are domain-plausible, not throwaways.
- [ ] No question depends on another ("come visto sopra").
- [ ] Every question carries a `source` pointing at the PDF and page.
- [ ] If `image` is set, the file exists at the given path and is committed to `images/<topic>/`.
- [ ] No invented biological facts — if a claim is not in the PDF, drop the question or mark `"source": "PLACEHOLDER — replace with real PDF content"`.
- [ ] `questions/index.json` lists the new topic file.
- [ ] Open `index.html`, pick the topic from the dropdown, and walk through every new question once.

---

## 6. ID stability rule

The site uses `id` to mark a question as **already seen** *and* as **flagged-as-incorrect** in `localStorage`. Therefore:

- **Never** change an existing `id`. If you rewrite a question, give it a new id (`-002`, `-003`, …) and delete the old one.
- IDs are global across topics — collision = bug. Use the topic prefix to guarantee uniqueness.
- If you renumber or re-organise, write a one-line note in the topic file's git commit so future-you knows progress was reset for those ids.
- If a question is **wrong** (typo, factual error, ambiguous answer), the user can press **⚑ Segnala** on the card to hide it permanently. The flag is keyed by `id`. To repair a flagged question: edit the JSON, **bump the id suffix** (e.g. `daino-anat-pelo-001` → `daino-anat-pelo-002`) and reload — the corrected version reappears automatically and the stale flag harmlessly points at a now-absent id. (Alternatively, the user can click `Ripristina segnalate` in the header to wipe all flags at once.) If the question is unrecoverable, just delete the entry from the JSON file.
