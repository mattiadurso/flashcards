// Giud Studia — local flashcard quiz.
// Vanilla JS, no framework. Loads questions/index.json, fetches every listed
// topic file, merges into one in-memory bank, and walks the user through a
// non-repeating session with localStorage-backed "already seen" tracking.

const SEEN_KEY = 'giud_studia.seen.v1';
const FLAGGED_KEY = 'giud_studia.flagged.v1';
const LENGTH_KEY = 'giud_studia.length.v1';
const SELECTION_KEY = 'giud_studia.topics.v1';

const state = {
  bank: [],              // all loaded questions
  byTopic: new Map(),    // topic -> question[]
  filtered: [],          // questions matching current filters
  queue: [],             // shuffled, not-yet-shown question ids for this session
  current: null,         // current question object
  answered: false,
  score: { correct: 0, total: 0 },
  argStats: {},             // per-argument tally this session: species -> { correct, total }
  entries: [],              // flattened manifest entries: {topic, label, file, species, source}
  selectedFiles: new Set(), // which topic files are active, keyed by file path
  difficulty: '__all__',
  hasDifficulty: false,
  sessionLength: 'all',  // 'all', or a positive integer (as a string from the dropdown)
  sessionTotal: 0,       // how many questions this session actually has
};

// ---------- storage ----------

function loadSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch { /* quota / private mode — silently ignore */ }
}

function clearSeen() {
  try { localStorage.removeItem(SEEN_KEY); } catch {}
}

function loadFlagged() {
  try {
    const raw = localStorage.getItem(FLAGGED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFlagged(set) {
  try {
    localStorage.setItem(FLAGGED_KEY, JSON.stringify([...set]));
  } catch {}
}

function clearFlagged() {
  try { localStorage.removeItem(FLAGGED_KEY); } catch {}
}

function loadLength() {
  try { return localStorage.getItem(LENGTH_KEY) || 'all'; } catch { return 'all'; }
}

function saveLength(value) {
  try { localStorage.setItem(LENGTH_KEY, value); } catch {}
}

function loadSelection() {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSelection(files) {
  try { localStorage.setItem(SELECTION_KEY, JSON.stringify([...files])); } catch {}
}

// ---------- loading ----------

async function loadBank() {
  const manifest = await fetch('questions/index.json', { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error(`questions/index.json: ${r.status}`);
      return r.json();
    });

  // Accepts either:
  //   [{ topic, file }, ...]                           (flat form)
  //   { topics: [{ topic, file }, ...] }              (object form)
  //   { topics: [{ topic, label?, files: [{ file, species?, source? }, ...] }, ...] }  (nested form)
  const rawTopics = Array.isArray(manifest) ? manifest : manifest.topics || [];
  const entries = [];
  for (const t of rawTopics) {
    if (Array.isArray(t.files)) {
      for (const f of t.files) {
        entries.push({
          topic: t.topic,
          label: t.label,
          file: f.file,
          species: f.species,
          source: f.source,
        });
      }
    } else if (t.file) {
      entries.push({ topic: t.topic, label: t.label, file: t.file });
    }
  }

  const all = [];
  for (const entry of entries) {
    try {
      const data = await fetch(`questions/${entry.file}`, { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error(`${entry.file}: ${r.status}`);
        return r.json();
      });
      const items = Array.isArray(data) ? data : data.questions || [];
      for (const q of items) {
        if (!q.topic) q.topic = entry.topic;
        if (!q.species && entry.species) q.species = entry.species;
        if (!q.source && entry.source) q.source = entry.source;
        q._file = entry.file;   // which manifest file this question came from
        all.push(q);
      }
    } catch (err) {
      console.warn(`Skipping "${entry.file}": ${err.message}`);
    }
  }

  state.bank = all;
  state.entries = entries.filter(e => all.some(q => q._file === e.file));  // only files that loaded
  state.byTopic = new Map();
  for (const q of all) {
    if (!state.byTopic.has(q.topic)) state.byTopic.set(q.topic, []);
    state.byTopic.get(q.topic).push(q);
  }
  state.hasDifficulty = all.some(q => q.difficulty);
}

// ---------- filters & queue ----------

function applyFilters() {
  const seen = loadSeen();
  const flagged = loadFlagged();
  state.filtered = state.bank.filter(q => {
    if (flagged.has(q.id)) return false;
    if (!state.selectedFiles.has(q._file)) return false;
    if (state.hasDifficulty && state.difficulty !== '__all__'
        && q.difficulty !== state.difficulty) return false;
    return true;
  });

  // Auto-reset if every filtered question is already seen.
  const unseen = state.filtered.filter(q => !seen.has(q.id));
  let pool;
  if (unseen.length === 0 && state.filtered.length > 0) {
    // wipe seen IDs that belong to this filtered slice, then start over
    const filteredIds = new Set(state.filtered.map(q => q.id));
    const remaining = [...seen].filter(id => !filteredIds.has(id));
    saveSeen(new Set(remaining));
    pool = [...state.filtered];
  } else {
    pool = unseen;
  }

  shuffle(pool);

  // Cap the session to the chosen length ('all' leaves the whole pool).
  const limit = parseInt(state.sessionLength, 10);
  if (!Number.isNaN(limit) && limit > 0) pool = pool.slice(0, limit);

  state.queue = pool.map(q => q.id);
  state.sessionTotal = state.queue.length;
  state.score = { correct: 0, total: 0 };
  state.argStats = {};
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- rendering ----------

const els = {
  topicsToggle: document.getElementById('topics-toggle'),
  topicsPanel: document.getElementById('topics-panel'),
  topicsSummary: document.getElementById('topics-summary'),
  difficultySelect: document.getElementById('difficulty-select'),
  difficultyField: document.getElementById('difficulty-field'),
  setupScreen: document.getElementById('setup-screen'),
  startBtn: document.getElementById('start-btn'),
  newSessionBtn: document.getElementById('new-session-btn'),
  countPresets: document.getElementById('count-presets'),
  countHint: document.getElementById('count-hint'),
  progress: document.getElementById('progress'),
  resetBtn: document.getElementById('reset-btn'),
  restoreFlaggedBtn: document.getElementById('restore-flagged-btn'),
  flaggedCount: document.getElementById('flagged-count'),
  counter: document.getElementById('counter'),
  score: document.getElementById('score'),
  progressFill: document.getElementById('progress-fill'),
  card: document.getElementById('card'),
  cardContainer: document.getElementById('card-container'),
  questionText: document.getElementById('question-text'),
  options: document.getElementById('options'),
  feedback: document.getElementById('feedback'),
  explanationBox: document.getElementById('explanation-box'),
  explanation: document.getElementById('explanation'),
  suggestionBox: document.getElementById('suggestion-box'),
  suggestion: document.getElementById('suggestion'),
  nextBtn: document.getElementById('next-btn'),
  imageWrap: document.getElementById('image-wrap'),
  cardImage: document.getElementById('card-image'),
  metaRow: document.getElementById('meta-row'),
  flagBtn: document.getElementById('flag-btn'),
  endScreen: document.getElementById('end-screen'),
  endSummary: document.getElementById('end-summary'),
  praise: document.getElementById('praise'),
  praiseEmojis: document.getElementById('praise-emojis'),
  praiseMsg: document.getElementById('praise-msg'),
  praiseScore: document.getElementById('praise-score'),
  breakdown: document.getElementById('breakdown'),
  breakdownList: document.getElementById('breakdown-list'),
  restartBtn: document.getElementById('restart-btn'),
  emptyScreen: document.getElementById('empty-screen'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
};

// ---------- topics multi-select ----------

// Group the manifest entries by topic label -> [{ file, species }].
function groupedEntries() {
  const groups = new Map();
  for (const e of state.entries) {
    const label = e.label || e.topic;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push({ file: e.file, species: e.species || e.file });
  }
  return groups;
}

// Restore the saved selection (intersected with what actually loaded);
// default to everything selected.
function initSelection() {
  const allFiles = state.entries.map(e => e.file);
  const saved = loadSelection();
  let chosen = Array.isArray(saved) ? saved.filter(f => allFiles.includes(f)) : null;
  if (!chosen || chosen.length === 0) chosen = allFiles;
  state.selectedFiles = new Set(chosen);
}

function buildTopicsControl() {
  const panel = els.topicsPanel;
  panel.innerHTML = '';
  const groups = groupedEntries();

  // quick "select all / none"
  const actions = document.createElement('div');
  actions.className = 'ms-actions';
  for (const [text, on] of [['Tutti', true], ['Nessuno', false]]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ms-action';
    b.textContent = text;
    b.addEventListener('click', () => setAllSelected(on));
    actions.appendChild(b);
  }
  panel.appendChild(actions);

  for (const [label, items] of groups) {
    const group = document.createElement('div');
    group.className = 'ms-group';

    // whole-group checkbox (e.g. all of "Anatomia e biologia")
    const head = document.createElement('label');
    head.className = 'ms-group-head';
    const gcb = document.createElement('input');
    gcb.type = 'checkbox';
    gcb.dataset.group = label;
    gcb.addEventListener('change', () => {
      for (const it of items) {
        if (gcb.checked) state.selectedFiles.add(it.file);
        else state.selectedFiles.delete(it.file);
      }
      onSelectionChanged();
    });
    const gname = document.createElement('span');
    gname.textContent = label;
    head.append(gcb, gname);
    group.appendChild(head);

    // one checkbox per species/file
    for (const it of items) {
      const row = document.createElement('label');
      row.className = 'ms-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = it.file;
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedFiles.add(it.file);
        else state.selectedFiles.delete(it.file);
        onSelectionChanged();
      });
      const nm = document.createElement('span');
      nm.textContent = it.species;
      row.append(cb, nm);
      group.appendChild(row);
    }
    panel.appendChild(group);
  }

  els.difficultyField.hidden = !state.hasDifficulty;
  refreshTopicsChecks();
}

function setAllSelected(on) {
  state.selectedFiles = new Set(on ? state.entries.map(e => e.file) : []);
  onSelectionChanged();
}

function onSelectionChanged() {
  saveSelection(state.selectedFiles);
  refreshTopicsChecks();
  updateAvailableCount();   // setup screen: refresh preview, don't start the session
}

// Sync every checkbox (incl. group indeterminate state) and the summary label
// to the current selection.
function refreshTopicsChecks() {
  const groups = groupedEntries();
  els.topicsPanel.querySelectorAll('.ms-item input').forEach(cb => {
    cb.checked = state.selectedFiles.has(cb.value);
  });
  els.topicsPanel.querySelectorAll('.ms-group-head input').forEach(gcb => {
    const items = groups.get(gcb.dataset.group) || [];
    const n = items.filter(i => state.selectedFiles.has(i.file)).length;
    gcb.checked = n > 0 && n === items.length;
    gcb.indeterminate = n > 0 && n < items.length;
  });
  updateTopicsSummary(groups);
}

function updateTopicsSummary(groups) {
  groups = groups || groupedEntries();
  const sel = state.selectedFiles;
  const allCount = state.entries.length;
  let text;
  if (sel.size === 0) {
    text = 'Nessuno';
  } else if (sel.size === allCount) {
    text = 'Tutti';
  } else {
    const fullGroups = [...groups].filter(([, items]) =>
      items.length && items.every(i => sel.has(i.file)));
    if (fullGroups.length === 1 && fullGroups[0][1].length === sel.size) {
      text = fullGroups[0][0];                       // exactly one whole group
    } else if (sel.size === 1) {
      const e = state.entries.find(x => x.file === [...sel][0]);
      text = e ? (e.species || e.label || e.file) : '1 selezionato';
    } else {
      text = `${sel.size} selezionati`;
    }
  }
  els.topicsSummary.textContent = text;
}

// ---------- question-count control (setup screen) ----------

const COUNT_PRESETS = [10, 20, 30, 50];

function buildCountPresets() {
  els.countPresets.innerHTML = '';
  for (const c of COUNT_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'count-chip';
    b.dataset.count = String(c);
    b.textContent = String(c);
    b.addEventListener('click', () => applyCount(String(c)));
    els.countPresets.appendChild(b);
  }
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'count-chip';
  all.dataset.count = 'all';
  all.textContent = 'Tutte';
  all.addEventListener('click', () => applyCount('all'));
  els.countPresets.appendChild(all);
}

// How many questions a session would actually contain right now — i.e. the
// size of the pool applyFilters() will build: unseen questions matching the
// topic + difficulty selection (flagged excluded). When everything has been
// seen, applyFilters auto-resets to the full set, so report that here too.
function availableCount() {
  const flagged = loadFlagged();
  const seen = loadSeen();
  const byDiff = state.hasDifficulty && state.difficulty !== '__all__';
  const filtered = state.bank.filter(q =>
    !flagged.has(q.id) &&
    state.selectedFiles.has(q._file) &&
    (!byDiff || q.difficulty === state.difficulty)
  );
  const unseen = filtered.filter(q => !seen.has(q.id));
  return unseen.length === 0 ? filtered.length : unseen.length;
}

// Set the session length from a preset chip; persist and re-highlight.
function applyCount(value) {
  state.sessionLength = value;
  saveLength(value);
  refreshCountActive();
}

function refreshCountActive() {
  els.countPresets.querySelectorAll('.count-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.count === String(state.sessionLength));
  });
}

// Refresh the "N disponibili" hint, the visible presets, and whether "Inizia"
// is enabled, from the real pool size.
function updateAvailableCount() {
  const n = availableCount();
  els.countHint.textContent = n
    ? `${n} domande disponibili`
    : 'Nessuna domanda per questa selezione';
  els.startBtn.disabled = n === 0;
  // hide presets that meet or exceed the pool (they'd behave like "Tutte"),
  // but never hide the currently-selected chip — it must stay highlighted.
  els.countPresets.querySelectorAll('.count-chip').forEach(chip => {
    const c = parseInt(chip.dataset.count, 10);
    const active = chip.dataset.count === String(state.sessionLength);
    chip.hidden = !Number.isNaN(c) && n > 0 && c >= n && !active;
  });
  refreshCountActive();
}

function showSetupScreen() {
  state.current = null;            // keyboard handlers ignore input while on setup
  els.setupScreen.hidden = false;
  els.cardContainer.hidden = true;
  els.endScreen.hidden = true;
  els.emptyScreen.hidden = true;
  els.progress.hidden = true;
  els.newSessionBtn.hidden = true;
  els.difficultySelect.value = state.difficulty;   // reflect current state in the control
  updateAvailableCount();
}

function updateProgress() {
  const total = state.sessionTotal;
  const shown = state.score.total;
  els.counter.textContent = `${shown} / ${total}`;
  els.score.textContent = `Score: ${state.score.correct}`;
  const pct = total === 0 ? 0 : (shown / total) * 100;
  els.progressFill.style.width = `${pct}%`;
}

function nextQuestion() {
  if (state.queue.length === 0) {
    showEndScreen();
    return;
  }
  const id = state.queue.shift();
  const q = state.bank.find(x => x.id === id);
  if (!q) { nextQuestion(); return; }
  state.current = q;
  state.answered = false;
  renderQuestion(q);
}

function renderQuestion(q) {
  // slide/fade transition
  els.card.classList.add('leaving');
  setTimeout(() => {
    // image
    if (q.image) {
      els.cardImage.src = q.image;
      els.cardImage.alt = q.question || '';
      els.imageWrap.hidden = false;
    } else {
      els.imageWrap.hidden = true;
      els.cardImage.removeAttribute('src');
    }

    // meta tags
    els.metaRow.innerHTML = '';
    if (q.topic) addTag(q.topic);
    if (q.species) addTag(q.species);
    if (q.difficulty) addTag(q.difficulty);

    els.questionText.textContent = q.question;

    // foldable hint — shown (collapsed) only when the question has one
    if (q.suggestion) {
      els.suggestion.textContent = q.suggestion;
      els.suggestionBox.open = false;     // start folded each question
      els.suggestionBox.hidden = false;
    } else {
      els.suggestionBox.hidden = true;
      els.suggestion.textContent = '';
    }

    els.options.innerHTML = '';
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.type = 'button';
      btn.dataset.index = String(idx);
      const keycap = document.createElement('span');
      keycap.className = 'keycap';
      keycap.textContent = String(idx + 1);
      const label = document.createElement('span');
      label.textContent = opt;
      btn.appendChild(keycap);
      btn.appendChild(label);
      btn.addEventListener('click', () => handleAnswer(idx));
      els.options.appendChild(btn);
    });

    els.feedback.hidden = true;
    els.explanation.textContent = '';

    els.card.classList.remove('leaving');
    els.card.classList.add('entering');
    requestAnimationFrame(() => {
      els.card.classList.remove('entering');
    });
  }, 180);
}

function addTag(text) {
  const span = document.createElement('span');
  span.className = 'tag';
  span.textContent = text;
  els.metaRow.appendChild(span);
}

function handleAnswer(chosenIdx) {
  if (state.answered) return;
  const q = state.current;
  state.answered = true;

  const buttons = [...els.options.querySelectorAll('.option')];
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === q.correctIndex) b.classList.add('correct');
    if (i === chosenIdx && i !== q.correctIndex) b.classList.add('wrong');
  });

  const isCorrect = chosenIdx === q.correctIndex;
  state.score.total += 1;
  if (isCorrect) state.score.correct += 1;

  // per-argument tally (by species, falling back to topic / file)
  const argKey = q.species || q.topic || q._file || 'Altro';
  const a = state.argStats[argKey] || (state.argStats[argKey] = { correct: 0, total: 0 });
  a.total += 1;
  if (isCorrect) a.correct += 1;

  // mark seen
  const seen = loadSeen();
  seen.add(q.id);
  saveSeen(seen);

  if (q.explanation) {
    els.explanation.textContent = q.explanation;
  } else {
    els.explanation.textContent = isCorrect
      ? 'Correct.'
      : `Correct answer: ${q.options[q.correctIndex]}`;
  }
  els.explanationBox.open = false;   // start folded; user clicks to reveal
  els.feedback.hidden = false;
  updateProgress();
}

// A few celebratory emojis (two themed to the subject matter) picked at random
// for each >90% reward, so the screen feels a little different every time.
const CELEBRATION_EMOJIS = ['🎉', '🎊', '🥳', '🏆', '⭐', '✨', '🌟', '🙌', '👏', '💪', '🦌', '🐗'];

function randomEmojis(n) {
  const pool = [...CELEBRATION_EMOJIS];
  shuffle(pool);
  return pool.slice(0, n).join(' ');
}

// Per-argument performance for the end screen: one row per species answered,
// weakest first, each with a colored accuracy bar.
function renderBreakdown() {
  const rows = Object.entries(state.argStats);
  els.breakdownList.innerHTML = '';
  if (rows.length === 0) {
    els.breakdown.hidden = true;
    return;
  }
  rows.sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
  for (const [name, s] of rows) {
    const pct = Math.round((s.correct / s.total) * 100);
    const tier = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad';

    const row = document.createElement('div');
    row.className = 'arg-row';

    const head = document.createElement('div');
    head.className = 'arg-head';
    const nm = document.createElement('span');
    nm.className = 'arg-name';
    nm.textContent = name;
    const sc = document.createElement('span');
    sc.className = 'arg-score';
    sc.textContent = `${s.correct}/${s.total} · ${pct}%`;
    head.append(nm, sc);

    const bar = document.createElement('div');
    bar.className = 'arg-bar';
    const fill = document.createElement('div');
    fill.className = `arg-fill ${tier}`;
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    row.append(head, bar);
    els.breakdownList.appendChild(row);
  }
  els.breakdown.hidden = false;
}

function showEndScreen() {
  state.current = null;              // no live question: ignore answer/next keys
  els.cardContainer.hidden = true;
  els.emptyScreen.hidden = true;
  els.endScreen.hidden = false;
  const { correct, total } = state.score;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const ratio = total === 0 ? 0 : correct / total;
  const perfect = total > 0 && correct === total;   // 100%, no mistakes

  // Reward a great run (strictly above 90%) with emojis, a random affectionate
  // line, and the actual score. A perfect 100% gets its own ad-hoc lines and a
  // golden box. Otherwise show the plain summary.
  if (ratio > 0.9 && typeof PRAISE !== 'undefined' && PRAISE.length) {
    const lines = perfect && typeof PRAISE_PERFECT !== 'undefined' && PRAISE_PERFECT.length
      ? PRAISE_PERFECT
      : PRAISE;
    els.praiseEmojis.textContent = perfect ? `💯 ${randomEmojis(3)}` : randomEmojis(3);
    els.praiseMsg.textContent = lines[Math.floor(Math.random() * lines.length)];
    els.praiseScore.textContent = `${pct}% — ${correct}/${total}`;
    els.praise.classList.toggle('perfect', perfect);
    els.praise.hidden = false;
    els.endSummary.hidden = true;
  } else {
    els.praise.hidden = true;
    els.endSummary.hidden = false;
    els.endSummary.textContent = total === 0
      ? 'No questions matched the current filters.'
      : `You answered ${correct} of ${total} (${pct}%).`;
  }

  renderBreakdown();
}

function showEmptyScreen() {
  state.current = null;
  els.cardContainer.hidden = true;
  els.endScreen.hidden = true;
  els.emptyScreen.hidden = false;
  els.progress.hidden = true;        // no session running — drop the 0/0 bar
  // keep #new-session-btn visible so the empty-screen copy's "Nuova sessione" works
}

function updateFlaggedBadge() {
  if (!els.restoreFlaggedBtn) return;
  const count = loadFlagged().size;
  if (count === 0) {
    els.restoreFlaggedBtn.hidden = true;
  } else {
    els.restoreFlaggedBtn.hidden = false;
    els.flaggedCount.textContent = String(count);
  }
}

function startSession() {
  applyFilters();
  updateFlaggedBadge();
  els.setupScreen.hidden = true;
  els.endScreen.hidden = true;
  els.emptyScreen.hidden = true;
  els.cardContainer.hidden = false;
  els.progress.hidden = false;
  els.newSessionBtn.hidden = false;
  updateProgress();
  if (state.filtered.length === 0) {
    showEmptyScreen();
    return;
  }
  nextQuestion();
}

// After clearing seen/flagged: if we're still on the setup screen just refresh
// its preview (don't yank the user into a session); otherwise restart.
function refreshAfterDataChange() {
  if (!els.setupScreen.hidden) {
    updateFlaggedBadge();
    updateAvailableCount();
  } else {
    startSession();
  }
}

// ---------- events ----------

function bindEvents() {
  // open/close the topics checklist
  els.topicsToggle.addEventListener('click', (e) => {
    const willOpen = els.topicsPanel.hidden;
    els.topicsPanel.hidden = !willOpen;
    els.topicsToggle.setAttribute('aria-expanded', String(willOpen));
    e.stopPropagation();
  });
  els.topicsPanel.addEventListener('click', (e) => e.stopPropagation());  // keep panel open while picking
  document.addEventListener('click', () => {
    if (!els.topicsPanel.hidden) {
      els.topicsPanel.hidden = true;
      els.topicsToggle.setAttribute('aria-expanded', 'false');
    }
  });

  els.difficultySelect.addEventListener('change', () => {
    state.difficulty = els.difficultySelect.value;
    updateAvailableCount();        // setup screen: refresh preview, don't start
  });

  els.startBtn.addEventListener('click', () => {
    if (!els.startBtn.disabled) startSession();
  });
  els.newSessionBtn.addEventListener('click', () => showSetupScreen());

  els.resetBtn.addEventListener('click', () => {
    if (!confirm('Reset "già viste"?\n\nLe domande segnalate come errate restano nascoste — usa "Ripristina segnalate" per riaverle.')) return;
    clearSeen();
    refreshAfterDataChange();
  });

  els.flagBtn.addEventListener('click', () => {
    if (!state.current) return;
    if (!confirm('Segnalare questa domanda come errata? Non verrà più mostrata finché non ripristini le segnalazioni.')) return;
    const flagged = loadFlagged();
    flagged.add(state.current.id);
    saveFlagged(flagged);
    // also mark seen so the score stays consistent; skip to next
    const seen = loadSeen();
    seen.add(state.current.id);
    saveSeen(seen);
    // re-apply filters so the flagged question is excluded from any remaining queue
    const remainingIds = new Set(state.queue);
    state.queue = state.bank
      .filter(q => remainingIds.has(q.id) && !flagged.has(q.id))
      .map(q => q.id);
    updateFlaggedBadge();
    nextQuestion();
  });

  if (els.restoreFlaggedBtn) {
    els.restoreFlaggedBtn.addEventListener('click', () => {
      const flagged = loadFlagged();
      if (flagged.size === 0) {
        alert('Nessuna domanda segnalata.');
        return;
      }
      if (!confirm(`Ripristinare ${flagged.size} domande segnalate?`)) return;
      clearFlagged();
      refreshAfterDataChange();
    });
  }
  els.nextBtn.addEventListener('click', () => nextQuestion());
  els.restartBtn.addEventListener('click', () => startSession());

  // image lightbox
  els.imageWrap.addEventListener('click', () => {
    if (!els.cardImage.src) return;
    els.lightboxImg.src = els.cardImage.src;
    els.lightbox.hidden = false;
  });
  els.lightbox.addEventListener('click', () => { els.lightbox.hidden = true; });

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!els.lightbox.hidden && e.key === 'Escape') {
      els.lightbox.hidden = true;
      return;
    }
    if (!els.topicsPanel.hidden && e.key === 'Escape') {
      els.topicsPanel.hidden = true;
      els.topicsToggle.setAttribute('aria-expanded', 'false');
      return;
    }
    if (!state.current) return;
    if ((e.key === 'h' || e.key === 'H') && !els.suggestionBox.hidden) {
      els.suggestionBox.open = !els.suggestionBox.open;   // toggle the hint
      e.preventDefault();
      return;
    }
    if (!state.answered && /^[1-4]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < state.current.options.length) {
        handleAnswer(idx);
        e.preventDefault();
      }
    } else if (state.answered && (e.key === 'Enter' || e.key === ' ')) {
      nextQuestion();
      e.preventDefault();
    }
  });
}

// ---------- boot ----------

(async function init() {
  bindEvents();
  try {
    await loadBank();
  } catch (err) {
    // show only the error card (otherwise the setup screen stays stacked on top)
    els.setupScreen.hidden = true;
    els.cardContainer.hidden = false;
    els.questionText.textContent =
      'Could not load questions. Run the app via the start script ' +
      '(file:// fetch is blocked by browsers). See README.md.';
    els.options.innerHTML = '';
    console.error(err);
    return;
  }
  initSelection();
  buildTopicsControl();
  buildCountPresets();
  const savedLen = loadLength();   // normalize to a known chip ('all' or a preset)
  applyCount(savedLen === 'all' || COUNT_PRESETS.includes(parseInt(savedLen, 10)) ? savedLen : 'all');
  showSetupScreen();          // land on the setup screen; the user taps "Inizia" to begin
})();
