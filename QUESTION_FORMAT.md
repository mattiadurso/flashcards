# QUESTION_FORMAT.md

Specification for converting an arbitrary PDF into a question file consumed by the Flashcards quiz site.

Follow this document end-to-end when generating a new topic. Schema keys are **English**; question text and options are **Italian**.

---

## 1. File layout

Every species/source file is one JSON file under `questions/<Topic_Folder>/`, **and must be registered with an entry in `questions/index.json`** (see below — a file the manifest doesn't list is invisible to the website).

The folder under `questions/` mirrors the folder under `docs/` that holds the source PDFs. Use the **same folder name** in both, with no spaces (use underscores), e.g. `Anatomia_e_Biologia`:

```
questions/
  index.json                       ← manifest — MUST list every file below
  Anatomia_e_Biologia/             ← one folder per macro-topic, mirrors docs/
    daino.json                     ← one file per species / source PDF
    capriolo.json
    cervo.json
    ...
images/
  Anatomia_e_Biologia/             ← optional, topic-scoped images
    capriolo-skull.jpg
docs/
  Anatomia_e_Biologia/             ← source PDFs (same folder name as above)
    9 DAINO.pdf
    3. CAPRIOLO GEN FATTO.pdf
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

**Nested form (the one this project uses)** — a `topic` groups several species/source files that live in a subfolder. The website shows one checkbox per `species` under the `label`, so each species is independently selectable:

```json
{
  "topics": [
    {
      "topic": "anatomia",
      "label": "Anatomia e biologia",
      "files": [
        { "species": "Daino (Dama dama)",       "file": "Anatomia_e_Biologia/daino.json",    "source": "docs/Anatomia_e_Biologia/9 DAINO.pdf",              "count": 60 },
        { "species": "Capriolo (Capreolus c.)", "file": "Anatomia_e_Biologia/capriolo.json", "source": "docs/Anatomia_e_Biologia/3. CAPRIOLO GEN FATTO.pdf", "count": 30 }
      ]
    }
  ]
}
```

Per-file manifest fields: `species` (label shown on the checkbox and tagged on each card), `file` (path **relative to `questions/`**, i.e. `<Topic_Folder>/<species>.json`), `source` (the source PDF path, for your reference), and `count` (how many questions the file holds — keep it in sync). Values declared at the manifest level (`topic`, `species`, `source`) are inherited by a question only when that question doesn't set them itself.

> **⚠️ Always update `index.json`.** Generating a new `questions/<Topic_Folder>/<species>.json` file is **not enough** — the website only loads files listed in `index.json`. For every new file, add one `{ species, file, source, count }` entry to the matching topic's `files` array (create the topic block if it's the first file of a new macro-topic). After adding it, reload `index.html` and confirm the new species appears in the **Argomenti** list.

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
  "suggestion": "Pensa a …",            // OPTIONAL but encouraged — a foldable hint, Italian
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
| `suggestion`   | Italian, one short foldable **hint**. Nudges the student toward the answer **without revealing it** — point at the concept, mechanism, or where to look (e.g. "Pensa alla strategia alimentare da 'concentrate selector'."). NEVER name or quote the correct option, never say "la risposta è…". One sentence. Optional but encouraged on every question. The site shows it as a collapsible "💡 Suggerimento" the student can open before answering. |
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

**The `suggestion` (hint):** a single Italian sentence that helps a stuck student *reason toward* the answer, never one that hands it over. Good hints point at the underlying concept ("Ricorda la differenza tra corna cave permanenti e palchi ossei caduchi."), the place to look, or the kind of mechanism involved. Bad hints restate the question, name the correct option, or are so vague they help nobody ("Pensaci bene."). For a trabocchetto/borderline question, the hint can flag that a precise value or a subtle distinction is at stake — without saying which option is the trap.

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
    "suggestion": "Pensa alla qualità del cibo che cerca, non alla quantità: cosa hanno in comune germogli, gemme e foglie tenere?",
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
    "suggestion": "Collega il volume dell'organo fermentativo al tipo di dieta: un alimento molto digeribile richiede meno fermentazione.",
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
    "suggestion": "Una bocca fatta per selezionare singoli bocconi è diversa da una fatta per strappare grandi ciuffi d'erba.",
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
- [ ] Each `suggestion` (when present) is a real hint and does **not** reveal or name the correct option.
- [ ] No question depends on another ("come visto sopra").
- [ ] Every question carries a `source` pointing at the PDF and page.
- [ ] If `image` is set, the file exists at the given path and is committed to `images/<topic>/`.
- [ ] No invented biological facts — if a claim is not in the PDF, drop the question or mark `"source": "PLACEHOLDER — replace with real PDF content"`.
- [ ] `questions/index.json` has an entry for the new file — correct `file` path (`<Topic_Folder>/<species>.json`), `species`, `source`, and a `count` matching the number of questions in the file.
- [ ] Open `index.html`, pick the topic from the dropdown, and walk through every new question once.

---

## 6. ID stability rule

The site uses `id` to mark a question as **already seen** *and* as **flagged-as-incorrect** in `localStorage`. Therefore:

- **Never** change an existing `id`. If you rewrite a question, give it a new id (`-002`, `-003`, …) and delete the old one.
- IDs are global across topics — collision = bug. Use the topic prefix to guarantee uniqueness.
- If you renumber or re-organise, write a one-line note in the topic file's git commit so future-you knows progress was reset for those ids.
- If a question is **wrong** (typo, factual error, ambiguous answer), the user can press **⚑ Segnala** on the card to hide it permanently. The flag is keyed by `id`. To repair a flagged question: edit the JSON, **bump the id suffix** (e.g. `daino-anat-pelo-001` → `daino-anat-pelo-002`) and reload — the corrected version reappears automatically and the stale flag harmlessly points at a now-absent id. (Alternatively, the user can click `Ripristina segnalate` in the header to wipe all flags at once.) If the question is unrecoverable, just delete the entry from the JSON file.
