// UI translations for the Flashcards app (interface chrome only — the questions,
// explanations and hints stay in the language they were authored in, Italian).
//
// One flat key -> string map per language. `{name}` tokens are placeholders the
// app fills in at runtime (see the t() helper in app.js). Keep the `it` and `en`
// key sets identical — a test (tests/test_i18n.py) enforces that parity, so when
// you add a string add it to BOTH languages.
//
// Defined as a global (like praise.js) and read by app.js; double-quoted keys and
// values keep it trivially parseable by the test.
const I18N = {
  it: {
    // header
    "title.tooltip": "Torna alla schermata iniziale",
    "theme.toDark": "Attiva la modalità notte",
    "theme.toLight": "Attiva la modalità giorno",
    "newSession": "‹ Nuova sessione",
    "newSession.tooltip": "Cambia argomenti, difficoltà o numero di domande",
    "restoreFlagged": "Ripristina segnalate",
    "restoreFlagged.tooltip": "Ripristina le domande segnalate come errate",
    "reset": "Reset progressi",
    "reset.tooltip": "Azzera le domande già viste e ricomincia",

    // setup screen
    "setup.title": "Imposta la sessione",
    "setup.topics": "Argomenti",
    "setup.difficulty": "Difficoltà",
    "diff.easy": "Facile",
    "diff.medium": "Media",
    "diff.hard": "Difficile",
    "diff.hint": "Nessuna selezione = tutte.",
    "setup.count": "Numero di domande",
    "count.all": "Tutte",
    "start": "Inizia 🍀",

    // topics multi-select
    "topics.all": "Tutti",
    "topics.none": "Nessuno",
    "topics.oneSelected": "1 selezionato",
    "topics.nSelected": "{n} selezionati",

    // counts hint on the setup screen
    "count.hint": "{correct}/{total} corrette · {available} da ripassare",
    "count.none": "Nessuna domanda per questa selezione",

    // question card
    "back": "Indietro",
    "back.tooltip": "Torna alla domanda precedente (la tua risposta non cambia)",
    "flag": "Segnala",
    "flag.tooltip": "Segnala domanda errata — non verrà più mostrata",
    "hint.label": "💡 Suggerimento",
    "explanation.label": "Spiegazione",
    "next": "Avanti",
    "bonus": "Bonus ❤️",
    "fill.submit": "Controlla",
    "fill.blankAria": "Spazio {n}",
    "score": "Punti",

    // post-answer feedback (fallbacks when a question has no explanation)
    "fb.fillCorrect": "Esatto.",
    "fb.fillWrong": "Risposta corretta: {answer}",
    "fb.mcCorrect": "Esatto.",
    "fb.mcWrong": "Risposta corretta: {answer}",

    // end / empty screens
    "end.title": "Sessione completata",
    "end.summaryNone": "Nessuna domanda corrisponde ai filtri attuali.",
    "end.summary": "Hai risposto a {correct} su {total} ({pct}%).",
    "breakdown.title": "Per argomento",
    "restart": "Ricomincia",
    "empty.title": "Nessuna domanda da mostrare",
    "empty.body": "Nessuna domanda per questa selezione. Tocca «‹ Nuova sessione» e scegli almeno un argomento — oppure aggiungi un file in <code>questions/</code> e registralo in <code>questions/index.json</code>.",

    // dialogs
    "confirm.reset": "Reset dei progressi?\n\nAzzera \"già viste\" e le risposte corrette: riparti da zero su tutte le domande.\nLe domande segnalate come errate restano nascoste — usa \"Ripristina segnalate\" per riaverle.",
    "confirm.flag": "Segnalare questa domanda come errata? Non verrà più mostrata finché non ripristini le segnalazioni.",
    "confirm.restore": "Ripristinare {n} domande segnalate?",
    "alert.noFlagged": "Nessuna domanda segnalata.",
    "error.load": "Impossibile caricare le domande. Avvia l'app con lo script di avvio (il fetch su file:// è bloccato dai browser). Vedi README.md.",
  },

  en: {
    // header
    "title.tooltip": "Back to the start screen",
    "theme.toDark": "Switch to night mode",
    "theme.toLight": "Switch to day mode",
    "newSession": "‹ New session",
    "newSession.tooltip": "Change topics, difficulty or number of questions",
    "restoreFlagged": "Restore flagged",
    "restoreFlagged.tooltip": "Restore questions flagged as wrong",
    "reset": "Reset progress",
    "reset.tooltip": "Clear the already-seen questions and start over",

    // setup screen
    "setup.title": "Set up the session",
    "setup.topics": "Topics",
    "setup.difficulty": "Difficulty",
    "diff.easy": "Easy",
    "diff.medium": "Medium",
    "diff.hard": "Hard",
    "diff.hint": "No selection = all.",
    "setup.count": "Number of questions",
    "count.all": "All",
    "start": "Start 🍀",

    // topics multi-select
    "topics.all": "All",
    "topics.none": "None",
    "topics.oneSelected": "1 selected",
    "topics.nSelected": "{n} selected",

    // counts hint on the setup screen
    "count.hint": "{correct}/{total} correct · {available} to review",
    "count.none": "No questions for this selection",

    // question card
    "back": "Back",
    "back.tooltip": "Go to the previous question (your answer won't change)",
    "flag": "Flag",
    "flag.tooltip": "Flag a wrong question — it won't be shown again",
    "hint.label": "💡 Hint",
    "explanation.label": "Explanation",
    "next": "Next",
    "bonus": "Bonus ❤️",
    "fill.submit": "Check",
    "fill.blankAria": "Blank {n}",
    "score": "Score",

    // post-answer feedback (fallbacks when a question has no explanation)
    "fb.fillCorrect": "Correct.",
    "fb.fillWrong": "Correct answer: {answer}",
    "fb.mcCorrect": "Correct.",
    "fb.mcWrong": "Correct answer: {answer}",

    // end / empty screens
    "end.title": "Session complete",
    "end.summaryNone": "No questions matched the current filters.",
    "end.summary": "You answered {correct} of {total} ({pct}%).",
    "breakdown.title": "By topic",
    "restart": "Restart",
    "empty.title": "No questions to show",
    "empty.body": "No questions for this selection. Tap «‹ New session» and pick at least one topic — or add a file under <code>questions/</code> and register it in <code>questions/index.json</code>.",

    // dialogs
    "confirm.reset": "Reset progress?\n\nClears \"already seen\" and your correct answers: you start over on every question.\nQuestions flagged as wrong stay hidden — use \"Restore flagged\" to get them back.",
    "confirm.flag": "Flag this question as wrong? It won't be shown again until you restore your flags.",
    "confirm.restore": "Restore {n} flagged questions?",
    "alert.noFlagged": "No flagged questions.",
    "error.load": "Could not load questions. Run the app via the start script (file:// fetch is blocked by browsers). See README.md.",
  },
};
