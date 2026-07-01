// Flashcards — local Flashcards quiz.
// Vanilla JS, no framework. Loads questions/index.json, fetches every listed
// topic file, merges into one in-memory bank, and walks the user through a
// non-repeating session with localStorage-backed "already seen" tracking.

const SEEN_KEY = 'giud_studia.seen.v1';
const CORRECT_KEY = 'giud_studia.correct.v1';   // ids answered correctly = "mastered" (retired from the pool)
const FLAGGED_KEY = 'giud_studia.flagged.v1';
const LENGTH_KEY = 'giud_studia.length.v1';
const SELECTION_KEY = 'giud_studia.topics.v1';
const THEME_KEY = 'giud_studia.theme.v1';   // 'light' (default) | 'dark'
const FOLD_KEY = 'giud_studia.folds.v1';    // labels of unfolded topic groups (rest collapsed)
const LANG_KEY = 'giud_studia.lang.v1';     // UI language: 'it' (default) | 'en'

const state = {
  bank: [],              // all loaded questions
  eggs: [],              // hidden easter-egg "bonus" questions (not in the bank/score)
  filtered: [],          // questions matching current filters
  queue: [],             // shuffled, not-yet-shown question ids for this session
  history: [],           // records of questions already shown this session (see newRecord)
  histPos: -1,           // index into history of the question on screen (-1 before start)
  current: null,         // current question object (mirror of history[histPos].q)
  currentRecord: null,   // current history record
  answered: false,
  score: { correct: 0, total: 0 },
  streak: 0,                // consecutive correct answers this session
  argStats: {},             // per-argument tally this session: species -> { correct, total }
  entries: [],              // flattened manifest entries: {topic, label, file, species, source}
  selectedFiles: new Set(), // which topic files are active, keyed by file path
  selectedDifficulties: new Set(),  // empty = all difficulties
  hasDifficulty: false,
  sessionLength: 'all',  // 'all', or a positive integer (as a string from the dropdown)
  sessionTotal: 0,       // how many questions this session actually has
  lang: 'it',            // UI language: 'it' (default) | 'en'
};

// ---------- storage ----------

// Generic localStorage helpers. The Set forms back the "seen"/"flagged" id sets;
// all swallow quota / private-mode errors so storage stays best-effort.
function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch { /* quota / private mode — silently ignore */ }
}

function removeKey(key) {
  try { localStorage.removeItem(key); } catch {}
}

const loadSeen = () => loadSet(SEEN_KEY);
const saveSeen = (set) => saveSet(SEEN_KEY, set);
const clearSeen = () => removeKey(SEEN_KEY);

// "Mastered" ids: questions answered correctly at least once. These are the ones
// retired from future sessions — questions answered WRONG stay out of this set, so
// they keep getting re-proposed until you finally get them right.
const loadCorrect = () => loadSet(CORRECT_KEY);
const saveCorrect = (set) => saveSet(CORRECT_KEY, set);
const clearCorrect = () => removeKey(CORRECT_KEY);

const loadFlagged = () => loadSet(FLAGGED_KEY);
const saveFlagged = (set) => saveSet(FLAGGED_KEY, set);
const clearFlagged = () => removeKey(FLAGGED_KEY);

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

// ---------- theme (day / night) ----------

function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

// Apply the chosen mode: flip the root attribute the CSS keys off, match the
// mobile browser chrome color, and update the toggle's label/pressed state.
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0E1116' : '#F5F7FB');
  if (els.themeToggle) {
    const label = dark ? t('theme.toLight') : t('theme.toDark');
    els.themeToggle.setAttribute('aria-label', label);
    els.themeToggle.title = label;
    els.themeToggle.setAttribute('aria-checked', String(dark));
  }
}

function toggleTheme() {
  const next = loadTheme() === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  applyTheme(next);
}

// ---------- language (it / en) ----------

function loadLang() {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'it'; }
  catch { return 'it'; }
}

function saveLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch {}
}

// Translate a UI key into the current language, filling in `{name}` placeholders
// from `params`. Falls back to Italian, then to the raw key, so a missing string
// is visible rather than blank. Reads the I18N global from i18n.js defensively.
function t(key, params) {
  const dict = (typeof I18N !== 'undefined' && I18N[state.lang]) || {};
  const fallback = (typeof I18N !== 'undefined' && I18N.it) || {};
  let s = dict[key] != null ? dict[key] : (fallback[key] != null ? fallback[key] : key);
  if (params) {
    for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
  }
  return s;
}

// Apply the current language to every static element tagged in the HTML:
//   data-i18n            -> textContent
//   data-i18n-html       -> innerHTML (for strings that contain markup, e.g. <code>)
//   data-i18n-title      -> title attribute
//   data-i18n-aria-label -> aria-label attribute
function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

// Switch the whole UI to `lang`: persist it, re-translate the static chrome, and
// rebuild the dynamic setup-screen controls (their text is generated in JS). The
// questions themselves are left in their authored language.
function applyLanguage(lang) {
  state.lang = lang === 'en' ? 'en' : 'it';
  saveLang(state.lang);
  document.documentElement.setAttribute('lang', state.lang);
  translateStatic();
  applyTheme(loadTheme());   // refresh the theme toggle's localized label

  if (els.langSwitch) {
    els.langSwitch.querySelectorAll('.lang-opt').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang));
    });
  }

  // Dynamic setup controls build their own text via t(), so regenerate them.
  if (state.entries.length) {
    buildTopicsControl();
    buildCountPresets();
    refreshCountActive();
    updateAvailableCount();
  }
}

// ---------- loading ----------

// `no-cache` (not `no-store`): the browser keeps a cached copy but revalidates
// it on every load with a conditional request. Unchanged files come back as a
// bodyless 304 (python's http.server supports this) — so reloads stay fast and
// never re-download the ~1 MB of JSON, yet regenerated question files are picked
// up immediately without a hard refresh.
async function loadBank() {
  const manifest = await fetch('questions/index.json', { cache: 'no-cache' })
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

  // Fetch every topic file in parallel — sequential awaits made the setup
  // screen wait on ~28 round-trips one after another. Failures are tolerated
  // per-file (logged, skipped) so one bad file can't block the rest.
  const loaded = await Promise.all(entries.map(entry =>
    fetch(`questions/${entry.file}`, { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`${entry.file}: ${r.status}`);
        return r.json();
      })
      .then(data => ({ entry, data }))
      .catch(err => { console.warn(`Skipping "${entry.file}": ${err.message}`); return null; })
  ));

  const all = [];
  for (const res of loaded) {
    if (!res) continue;
    const { entry, data } = res;
    const items = Array.isArray(data) ? data : data.questions || [];
    for (const q of items) {
      if (!q.topic) q.topic = entry.topic;
      if (!q.species && entry.species) q.species = entry.species;
      if (!q.source && entry.source) q.source = entry.source;
      q._file = entry.file;   // which manifest file this question came from
      all.push(q);
    }
  }

  state.bank = all;
  state.entries = entries.filter(e => all.some(q => q._file === e.file));  // only files that loaded
  state.hasDifficulty = all.some(q => q.difficulty);

  // Hidden easter-egg "bonus" questions. Kept out of index.json on purpose, so
  // they never appear in the topic list, filters, counts or score — they just
  // surface, rarely, as a sweet surprise. Missing file is fine.
  try {
    const eggData = await fetch('questions/easter-eggs.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null));
    const eggs = eggData && (Array.isArray(eggData) ? eggData : eggData.questions || []);
    if (eggs) for (const q of eggs) { q._bonus = true; state.eggs.push(q); }
  } catch (_) { /* no easter eggs — no problem */ }
}

const BONUS_CHANCE = 0.03;   // 3% of sessions get one bonus card

// With BONUS_CHANCE probability, splice one random egg into the queue somewhere
// around the middle — never as the very first card (it should feel like a
// surprise mid-session, not a greeting). sessionTotal is left untouched so the
// bonus doesn't count toward the score or the "X / N" progress denominator.
function maybeInsertBonus() {
  if (state.eggs.length === 0 || state.queue.length === 0) return;
  if (Math.random() >= BONUS_CHANCE) return;
  const egg = pickRandom(state.eggs);
  // Center on the middle, jitter within ±25% of the queue length, and clamp to
  // [1, length] so it's never first but still lands roughly in the middle.
  const mid = state.queue.length / 2;
  const spread = state.queue.length * 0.25;
  const raw = Math.round(mid + (Math.random() * 2 - 1) * spread);
  const pos = Math.max(1, Math.min(state.queue.length, raw));
  state.queue.splice(pos, 0, egg.id);
}

// Look a question up by id in the normal bank or the hidden egg list.
function findQuestion(id) {
  return state.bank.find(q => q.id === id) || state.eggs.find(q => q.id === id);
}

// ---------- filters & queue ----------

// A question matches the difficulty filter when no difficulties are checked
// (empty selection = all) or its difficulty is among the checked ones.
function difficultyMatches(q) {
  if (!state.hasDifficulty || state.selectedDifficulties.size === 0) return true;
  return state.selectedDifficulties.has(q.difficulty);
}

// A question is in the active pool when it isn't flagged, belongs to a selected
// topic file, and matches the difficulty filter. `flagged` is passed in so
// callers read localStorage once, not once per question.
function matchesFilters(q, flagged) {
  return !flagged.has(q.id) && state.selectedFiles.has(q._file) && difficultyMatches(q);
}

function applyFilters() {
  const correct = loadCorrect();
  const flagged = loadFlagged();
  state.filtered = state.bank.filter(q => matchesFilters(q, flagged));

  // The pool is every filtered question NOT yet answered correctly — i.e. unseen
  // questions PLUS ones previously answered wrong, so mistakes keep coming back.
  // Auto-reset once the whole slice has been mastered.
  const pending = state.filtered.filter(q => !correct.has(q.id));
  let pool;
  if (pending.length === 0 && state.filtered.length > 0) {
    // every question in this slice is mastered → clear the slice's "correct" ids
    // and the matching "seen" ids, then start the whole slice over.
    const filteredIds = new Set(state.filtered.map(q => q.id));
    saveCorrect(new Set([...correct].filter(id => !filteredIds.has(id))));
    const seen = loadSeen();
    saveSeen(new Set([...seen].filter(id => !filteredIds.has(id))));
    pool = [...state.filtered];
  } else {
    pool = pending;
  }

  shuffle(pool);

  // Cap the session to the chosen length ('all' leaves the whole pool).
  const limit = parseInt(state.sessionLength, 10);
  if (!Number.isNaN(limit) && limit > 0) pool = pool.slice(0, limit);

  state.queue = pool.map(q => q.id);
  state.sessionTotal = state.queue.length;   // bonus cards don't count toward this
  maybeInsertBonus();
  state.history = [];          // fresh session: nothing to step back to yet
  state.histPos = -1;
  state.currentRecord = null;
  state.score = { correct: 0, total: 0 };
  state.streak = 0;
  state.argStats = {};
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pick one random element from a non-empty array.
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Normalize a free-text answer for tolerant comparison: strip accents, lowercase,
// trim, and collapse internal whitespace. So "Biomagnificazione", "biomagnificazione"
// and " biomagnificazione " all match. Used only by fill-in-the-blank questions.
function normalizeText(s) {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // drop diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// ---------- rendering ----------

const els = {
  topicsToggle: document.getElementById('topics-toggle'),
  topicsPanel: document.getElementById('topics-panel'),
  topicsSummary: document.getElementById('topics-summary'),
  difficultyPills: document.getElementById('difficulty-pills'),
  difficultyField: document.getElementById('difficulty-field'),
  title: document.getElementById('title'),
  themeToggle: document.getElementById('theme-toggle'),
  langSwitch: document.getElementById('lang-switch'),
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
  streak: document.getElementById('streak'),
  progressFill: document.getElementById('progress-fill'),
  progressHeart: document.getElementById('progress-heart'),
  toast: document.getElementById('toast'),
  emojiPop: document.getElementById('emoji-pop'),
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
  metaRow: document.getElementById('meta-row'),
  backBtn: document.getElementById('back-btn'),
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
};

// ---------- topics multi-select ----------

// Group the manifest entries by topic label -> [{ file, species }].
// Groups and the species within each are sorted alphabetically (locale-aware,
// case-insensitive) so the "Argomenti" list reads A→Z regardless of manifest order.
function groupedEntries() {
  const byLabel = new Map();
  for (const e of state.entries) {
    const label = e.label || e.topic;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push({ file: e.file, species: e.species || e.file });
  }
  const byName = (a, b) => a.species.localeCompare(b.species, 'it', { sensitivity: 'base' });
  const groups = new Map();
  for (const label of [...byLabel.keys()].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))) {
    groups.set(label, byLabel.get(label).sort(byName));
  }
  return groups;
}

// Per-file mastery tally: file path -> { total, correct }, where `correct` counts
// questions answered correctly at least once. Drives the stats shown on each
// species row and group header in the setup screen.
function fileStats() {
  const correct = loadCorrect();
  const m = new Map();
  for (const q of state.bank) {
    let s = m.get(q._file);
    if (!s) { s = { total: 0, correct: 0 }; m.set(q._file, s); }
    s.total += 1;
    if (correct.has(q.id)) s.correct += 1;
  }
  return m;
}

// "12/30" — correct-over-total ratio, or empty when there's nothing to count.
function formatStat(correct, total) {
  if (!total) return '';
  return `${correct}/${total}`;
}

// Refresh the correctness badge on every species row and group header from the
// current "mastered" set. Cheap; called whenever we (re)enter the setup screen.
function refreshTopicsStats() {
  const stats = fileStats();
  els.topicsPanel.querySelectorAll('.ms-item-stat').forEach(el => {
    const s = stats.get(el.dataset.file) || { total: 0, correct: 0 };
    el.textContent = formatStat(s.correct, s.total);
    el.classList.toggle('done', s.total > 0 && s.correct === s.total);
  });
  const groups = groupedEntries();
  els.topicsPanel.querySelectorAll('.ms-group-stat').forEach(el => {
    const items = groups.get(el.dataset.group) || [];
    let correct = 0, total = 0;
    for (const it of items) {
      const s = stats.get(it.file);
      if (s) { correct += s.correct; total += s.total; }
    }
    el.textContent = formatStat(correct, total);
    el.classList.toggle('done', total > 0 && correct === total);
  });
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
  const expanded = loadSet(FOLD_KEY);   // which groups are unfolded (default: none)

  // quick "select all / none"
  const actions = document.createElement('div');
  actions.className = 'ms-actions';
  for (const [text, on] of [[t('topics.all'), true], [t('topics.none'), false]]) {
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
    if (!expanded.has(label)) group.classList.add('collapsed');  // folded by default

    // Head row: a select-all checkbox (independent of folding) next to a button
    // that folds/unfolds the species list. Kept as separate controls so ticking
    // the group doesn't expand it, and expanding it doesn't tick the group.
    const head = document.createElement('div');
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

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ms-group-toggle';
    toggle.setAttribute('aria-expanded', String(expanded.has(label)));
    const gname = document.createElement('span');
    gname.className = 'ms-group-name';
    gname.textContent = label;
    const gcount = document.createElement('span');     // "selected / total", kept fresh in refreshTopicsChecks
    gcount.className = 'ms-group-count';
    gcount.dataset.group = label;
    const gstat = document.createElement('span');      // "correct / total · %", kept fresh in refreshTopicsStats
    gstat.className = 'ms-group-stat';
    gstat.dataset.group = label;
    const chev = document.createElement('span');
    chev.className = 'ms-group-chevron';
    chev.setAttribute('aria-hidden', 'true');
    toggle.append(gname, gstat, gcount, chev);
    toggle.addEventListener('click', () => {
      const open = !group.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(open));
      const folds = loadSet(FOLD_KEY);
      if (open) folds.add(label); else folds.delete(label);
      saveSet(FOLD_KEY, folds);
    });

    head.append(gcb, toggle);
    group.appendChild(head);

    // Body: one checkbox per species/file. Hidden by CSS while the group is folded.
    const body = document.createElement('div');
    body.className = 'ms-group-body';
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
      nm.className = 'ms-item-name';
      nm.textContent = it.species;
      const stat = document.createElement('span');     // per-species "correct / total · %"
      stat.className = 'ms-item-stat';
      stat.dataset.file = it.file;
      row.append(cb, stat, nm);   // checkbox, then stat, then species name
      body.appendChild(row);
    }
    group.appendChild(body);

    panel.appendChild(group);
  }

  els.difficultyField.hidden = !state.hasDifficulty;
  refreshTopicsChecks();
  refreshTopicsStats();
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
  // per-group "selected / total" so a folded group still shows what's picked
  els.topicsPanel.querySelectorAll('.ms-group-count').forEach(el => {
    const items = groups.get(el.dataset.group) || [];
    const n = items.filter(i => state.selectedFiles.has(i.file)).length;
    el.textContent = `${n}/${items.length}`;
  });
  updateTopicsSummary(groups);
}

function updateTopicsSummary(groups) {
  groups = groups || groupedEntries();
  const sel = state.selectedFiles;
  const allCount = state.entries.length;
  let text;
  if (sel.size === 0) {
    text = t('topics.none');
  } else if (sel.size === allCount) {
    text = t('topics.all');
  } else {
    const fullGroups = [...groups].filter(([, items]) =>
      items.length && items.every(i => sel.has(i.file)));
    if (fullGroups.length === 1 && fullGroups[0][1].length === sel.size) {
      text = fullGroups[0][0];                       // exactly one whole group
    } else if (sel.size === 1) {
      const e = state.entries.find(x => x.file === [...sel][0]);
      text = e ? (e.species || e.label || e.file) : t('topics.oneSelected');
    } else {
      text = t('topics.nSelected', { n: sel.size });
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
  all.textContent = t('count.all');
  all.addEventListener('click', () => applyCount('all'));
  els.countPresets.appendChild(all);
}

// Counts for the current topic + difficulty selection (flagged excluded):
//   total     — all matching questions
//   correct   — how many have been answered correctly (mastered)
//   available — the pool the next session draws from: questions not yet mastered
//               (unseen + previously-wrong), or — once everything is mastered —
//               the whole set, since applyFilters() auto-resets in that case.
function selectionCounts() {
  const flagged = loadFlagged();
  const correctSet = loadCorrect();
  const filtered = state.bank.filter(q => matchesFilters(q, flagged));
  const correct = filtered.filter(q => correctSet.has(q.id)).length;
  const pending = filtered.length - correct;
  return { total: filtered.length, correct, available: pending || filtered.length };
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
  const { correct, total, available: n } = selectionCounts();
  els.countHint.textContent = total
    ? t('count.hint', { correct, total, available: n })
    : t('count.none');
  els.startBtn.disabled = n === 0;
  // hide presets that meet or exceed the pool (they'd behave like "Tutte"),
  // but never hide the currently-selected chip — it must stay highlighted.
  els.countPresets.querySelectorAll('.count-chip').forEach(chip => {
    const c = parseInt(chip.dataset.count, 10);
    const active = chip.dataset.count === String(state.sessionLength);
    chip.hidden = !Number.isNaN(c) && n > 0 && c >= n && !active;
    chip.classList.toggle('active', active);   // highlight the selected chip in the same pass
  });
}

function showSetupScreen() {
  state.current = null;            // keyboard handlers ignore input while on setup
  document.body.classList.remove('session-active');
  els.setupScreen.hidden = false;
  els.cardContainer.hidden = true;
  els.endScreen.hidden = true;
  els.emptyScreen.hidden = true;
  els.progress.hidden = true;
  els.newSessionBtn.hidden = true;
  // reflect current state in the pills
  els.difficultyPills.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = state.selectedDifficulties.has(cb.value);
  });
  refreshTopicsStats();   // reflect the just-finished session's results
  updateAvailableCount();
}

function updateProgress() {
  const total = state.sessionTotal;
  // While reviewing an earlier card, the counter/bar track the card on screen
  // (its 1-based position); at the live front they track how many we've answered.
  const reviewing = state.histPos >= 0 && state.histPos < state.history.length - 1;
  const shown = reviewing ? state.histPos + 1 : state.score.total;
  els.counter.textContent = `${shown} / ${total}`;
  els.score.textContent = `${t('score')}: ${state.score.correct}`;   // score never changes on review
  const pct = total === 0 ? 0 : (shown / total) * 100;
  els.progressFill.style.width = `${pct}%`;
  els.progressHeart.style.left = `${pct}%`;   // heart rides the leading edge
}

// Streak chip: a little fire + count, shown once two-in-a-row builds up.
function updateStreakChip() {
  if (state.streak >= 2) {
    els.streak.textContent = `🔥 ${state.streak}`;
    els.streak.hidden = false;
    // retrigger the pop animation
    els.streak.classList.remove('streak');
    void els.streak.offsetWidth;
    els.streak.classList.add('streak');
  } else {
    els.streak.hidden = true;
  }
}

// ---------- celebratory feedback ----------

const POP_EMOJIS = ['💙', '✨', '🌟', '🎉', '💯', '👏', '💪', '🦌'];
let toastTimer = null;

// Re-trigger a one-shot CSS animation: drop the class, force a reflow so the
// browser restarts it, re-add it, then strip it again (and run `onEnd`, if given)
// once the animation finishes. Shared by the card bounce and the emoji pop.
function playAnimation(el, className, onEnd) {
  el.classList.remove(className);
  void el.offsetWidth;                       // reflow so the animation restarts
  el.classList.add(className);
  el.addEventListener('animationend', function done() {
    el.classList.remove(className);
    el.removeEventListener('animationend', done);
    if (onEnd) onEnd();
  });
}

// Bounce the card briefly when an option is tapped.
function bounceCard() {
  playAnimation(els.card, 'bounce');
}

// Pop a big emoji over the card on a correct answer.
function popEmoji() {
  els.emojiPop.textContent = pickRandom(POP_EMOJIS);
  els.emojiPop.hidden = false;
  playAnimation(els.emojiPop, 'pop', () => { els.emojiPop.hidden = true; });
}

// Show a short affectionate toast, auto-hiding after a couple seconds.
function showToast(text) {
  if (!text) return;
  els.toast.textContent = text;
  els.toast.hidden = false;
  void els.toast.offsetWidth;
  els.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => { els.toast.hidden = true; }, 300);
  }, 2200);
}

let lastNudgeIdx = -1;   // remembered so a general nudge never repeats back-to-back

// True when `a` is a non-empty array. Used to read the optional message banks
// from praise.js defensively — any of them is absent if that script didn't load.
const hasLines = (a) => Array.isArray(a) && a.length > 0;

// Pick a mid-quiz nudge: prefer a streak-milestone line, else an occasional
// general encouragement. Returns null when there's nothing to say right now.
function pickNudge() {
  const streakNudges = typeof STREAK_NUDGES !== 'undefined' ? STREAK_NUDGES : null;
  const nudges = typeof NUDGES !== 'undefined' ? NUDGES : null;
  if (hasLines(streakNudges)) {
    const hit = [...streakNudges].reverse().find(s => state.streak === s.min);
    if (hit) return hit.text;
  }
  // every 3rd correct in a row, a 1-in-3 chance of a varied general nudge
  if (hasLines(nudges) && state.streak > 0 && state.streak % 3 === 0 && Math.random() < 1 / 3) {
    let idx = Math.floor(Math.random() * nudges.length);
    if (nudges.length > 1 && idx === lastNudgeIdx) idx = (idx + 1) % nudges.length;
    lastNudgeIdx = idx;
    return nudges[idx];
  }
  return null;
}

// A per-session record of one shown question: the question itself plus whatever
// answer was given, so we can re-display it read-only when stepping back/forward.
function newRecord(q) {
  return {
    q,
    answered: false,
    chosenIdx: null,      // multiple-choice: which option was tapped
    fillValues: null,     // fill-in-the-blank: the strings typed into each blank
    blanksCorrect: null,  // fill-in-the-blank: per-blank correctness
    isCorrect: false,
  };
}

// "Next" does double duty: if we're reviewing an earlier question, it walks
// forward through the already-seen history; only once we're back at the front
// does it pull a fresh question off the queue.
function nextQuestion() {
  if (state.histPos < state.history.length - 1) {
    state.histPos += 1;
    showRecord(state.history[state.histPos]);
    return;
  }
  if (state.queue.length === 0) {
    showEndScreen();
    return;
  }
  const id = state.queue.shift();
  const q = findQuestion(id);
  if (!q) { nextQuestion(); return; }
  const record = newRecord(q);
  state.history.push(record);
  state.histPos = state.history.length - 1;
  showRecord(record);
}

// "Back": step one question earlier. The earlier question is always already
// answered (you can't advance past an unanswered card), so it's shown locked —
// the stored answer is replayed and can't be changed, leaving the score intact.
function prevQuestion() {
  if (state.histPos <= 0) return;
  state.histPos -= 1;
  showRecord(state.history[state.histPos]);
}

// Point the live state at a record and render it. Answered records render in
// their locked, replayed state; the (only ever frontmost) unanswered record
// renders fresh and answerable.
function showRecord(record) {
  state.currentRecord = record;
  state.current = record.q;
  state.answered = record.answered;
  renderQuestion(record);
  updateBackButton();
  updateProgress();   // keep the counter/bar in step with the card on screen
}

// Back is offered from the second question of the session onward.
function updateBackButton() {
  if (els.backBtn) els.backBtn.hidden = state.histPos <= 0;
}

function renderQuestion(record) {
  const q = record.q;
  document.body.classList.remove('answered');   // drop the post-answer bottom spacer
  // slide/fade transition
  els.card.classList.add('leaving');
  setTimeout(() => {
    // meta tags
    els.metaRow.innerHTML = '';
    if (q._bonus) {
      const b = document.createElement('span');
      b.className = 'tag tag--bonus';
      b.textContent = t('bonus');
      els.metaRow.appendChild(b);
    }
    if (q.topic) addTag(q.topic);
    if (q.species) addTag(q.species);
    if (q.difficulty) addTag(t('diff.' + q.difficulty));

    // bonus cards get a warm golden treatment; the flag button makes no sense
    els.card.classList.toggle('card--bonus', !!q._bonus);
    els.flagBtn.hidden = !!q._bonus;

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
    state.fillInputs = [];
    if (q.type === 'fill') {
      renderFill(q, record.answered);
    } else {
      els.questionText.textContent = q.question;
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
    }

    els.feedback.hidden = true;
    els.explanation.textContent = '';

    // Reviewing an earlier question: replay its locked answer read-only.
    if (record.answered) replayAnswer(record);

    els.card.classList.remove('leaving');
    els.card.classList.add('entering');
    requestAnimationFrame(() => {
      els.card.classList.remove('entering');
    });
  }, 180);
}

// Re-apply a stored answer to a freshly-rendered card WITHOUT re-grading: lock
// the controls, paint correct/wrong, and reveal the explanation. Used when the
// user steps back to (or forward to) a question they already answered, so going
// back never changes their answer or the score.
function replayAnswer(record) {
  const q = record.q;
  if (q.type === 'fill') {
    applyFillAnswer(q, record.fillValues || [], record.blanksCorrect || []);
  } else {
    applyMcAnswer(q, record.chosenIdx);
  }
  showExplanation(q, record.isCorrect);
  // Note: we deliberately do NOT add the body.answered spacer here. It exists to
  // give the live-answer auto-scroll room (gradeResult); a reviewed card does no
  // such scroll, so the spacer would just leave a large empty gap on mobile.
}

// Lock the multiple-choice options and paint the verdict: the correct option
// green, plus the chosen one red when it was wrong. Shared by live answering
// (handleAnswer) and read-only replay (replayAnswer).
function applyMcAnswer(q, chosenIdx) {
  const buttons = [...els.options.querySelectorAll('.option')];
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === q.correctIndex) b.classList.add('correct');
    if (i === chosenIdx && i !== q.correctIndex) b.classList.add('wrong');
  });
}

// Lock the fill-in-the-blank inputs and paint each blank: restore the typed
// value, mark it correct/wrong, and show the expected word after wrong ones.
// Shared by live grading (handleFillSubmit) and read-only replay (replayAnswer).
function applyFillAnswer(q, values, blanksCorrect) {
  const inputs = state.fillInputs || [];
  const blanks = q.answers || [];
  inputs.forEach((input, i) => {
    if (values[i] != null) input.value = values[i];
    input.disabled = true;
    const ok = !!blanksCorrect[i];
    input.classList.add(ok ? 'fill-input--correct' : 'fill-input--wrong');
    if (!ok && (blanks[i] || []).length) {     // show the expected word after the box
      const corr = document.createElement('span');
      corr.className = 'fill-correct';
      corr.textContent = blanks[i][0];
      input.insertAdjacentElement('afterend', corr);
    }
  });
  els.options.querySelectorAll('.fill-submit').forEach(b => { b.disabled = true; });
}

// Fill the explanation panel and reveal the feedback row. No scoring here, so
// it's safe to call both on a live answer and on a read-only replay.
function showExplanation(q, isCorrect) {
  if (q.explanation) {
    els.explanation.textContent = q.explanation;
  } else if (q.type === 'fill') {
    const accepted = (q.answers || []).map(b => b[0]).join(', ');
    els.explanation.textContent = isCorrect
      ? t('fb.fillCorrect')
      : t('fb.fillWrong', { answer: accepted });
  } else {
    els.explanation.textContent = isCorrect
      ? t('fb.mcCorrect')
      : t('fb.mcWrong', { answer: q.options[q.correctIndex] });
  }
  els.explanationBox.open = false;   // start folded; user clicks to reveal
  els.feedback.hidden = false;
}

// Render a fill-in-the-blank card: rebuild the question text with an inline text
// input wherever a run of underscores (the blank marker, e.g. "___") appears, and
// drop a "Controlla" button into the options area. One input per blank; the i-th
// input is graded against q.answers[i] (an array of accepted strings).
function renderFill(q, answered) {
  const blanks = q.answers || [];
  els.questionText.innerHTML = '';
  const parts = String(q.question).split(/_{2,}/);   // text segments around blanks
  const inputs = [];
  parts.forEach((part, i) => {
    if (part) els.questionText.appendChild(document.createTextNode(part));
    if (i < parts.length - 1) {                       // a blank sits between segments
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'fill-input';
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', t('fill.blankAria', { n: i + 1 }));
      const accepted = blanks[i] || [];
      const longest = accepted.reduce((m, s) => Math.max(m, String(s).length), 8);
      input.size = Math.max(6, Math.min(longest + 1, 22));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleFillSubmit(); }
      });
      els.questionText.appendChild(input);
      inputs.push(input);
    }
  });
  state.fillInputs = inputs;

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'primary-btn fill-submit';
  submit.textContent = t('fill.submit');
  submit.addEventListener('click', () => handleFillSubmit());
  els.options.appendChild(submit);

  // Auto-focus the first blank so you can type at once — but not when replaying an
  // already-answered card (the inputs are about to be disabled; focus would be dead).
  if (!answered && inputs[0]) setTimeout(() => inputs[0].focus(), 0);
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
  const record = state.currentRecord;
  state.answered = true;
  record.answered = true;
  record.chosenIdx = chosenIdx;            // remembered so Back can replay it

  applyMcAnswer(q, chosenIdx);

  const isCorrect = chosenIdx === q.correctIndex;
  record.isCorrect = isCorrect;

  bounceCard();                 // playful wiggle on every tap
  if (isCorrect) popEmoji();    // celebratory emoji pop on correct

  gradeResult(q, isCorrect);
}

// Grade a fill-in-the-blank question: read every inline input, compare each
// against its accepted answers (case/accent-insensitive), lock them, and flag the
// wrong ones in red while showing the expected word. Correct only when every
// blank is right.
function handleFillSubmit() {
  if (state.answered) return;
  const q = state.current;
  const record = state.currentRecord;
  const inputs = state.fillInputs || [];
  if (inputs.length === 0) return;
  state.answered = true;
  record.answered = true;

  const blanks = q.answers || [];
  const values = inputs.map(input => input.value);
  const blanksCorrect = inputs.map((input, i) =>
    (blanks[i] || []).some(a => normalizeText(a) === normalizeText(input.value)));
  const allCorrect = blanksCorrect.every(Boolean);

  // remembered so Back can replay the exact answer read-only
  record.fillValues = values;
  record.blanksCorrect = blanksCorrect;
  record.isCorrect = allCorrect;

  applyFillAnswer(q, values, blanksCorrect);

  bounceCard();
  if (allCorrect) popEmoji();

  gradeResult(q, allCorrect);
}

// Shared post-answer bookkeeping for both question types: score, streak,
// per-argument stats, "seen" persistence, the explanation panel and the
// Next-button scroll. The caller has already decided `isCorrect`.
function gradeResult(q, isCorrect) {
  // Bonus cards are pure surprise: they don't touch the score, the per-argument
  // stats, or the "seen" set (so they can resurface another day).
  if (!q._bonus) {
    state.score.total += 1;
    if (isCorrect) state.score.correct += 1;

    // running streak of consecutive correct answers
    state.streak = isCorrect ? state.streak + 1 : 0;
    updateStreakChip();

    // per-argument tally (by species, falling back to topic / file)
    const argKey = q.species || q.topic || q._file || 'Altro';
    const a = state.argStats[argKey] || (state.argStats[argKey] = { correct: 0, total: 0 });
    a.total += 1;
    if (isCorrect) a.correct += 1;

    // mark seen, and track mastery: a correct answer retires the question; a wrong
    // answer drops it back out of "mastered" so it gets re-proposed next session.
    const seen = loadSeen();
    seen.add(q.id);
    saveSeen(seen);
    const correct = loadCorrect();
    if (isCorrect) correct.add(q.id); else correct.delete(q.id);
    saveCorrect(correct);

    // affectionate mid-quiz nudge (streak milestone or periodic encouragement)
    const nudge = pickNudge();
    if (nudge) showToast(nudge);
  }

  showExplanation(q, isCorrect);
  updateProgress();

  // Lift the Next button to ~62% of the viewport, leaving empty space below it
  // (the .answered class adds bottom padding on mobile for the scroll room). The
  // gap keeps the button clear of iOS Safari's auto-appearing bottom toolbar, so
  // it's tappable in one touch. Only scrolls down when the button sits too low.
  document.body.classList.add('answered');
  requestAnimationFrame(() => {
    const rect = els.nextBtn.getBoundingClientRect();
    const target = window.innerHeight * 0.62;
    const delta = rect.bottom - target;
    if (delta > 0) window.scrollBy({ top: delta, behavior: 'smooth' });
  });
}

// Emoji picked at random for the end screen so it feels a little different each
// time. High scores get a celebratory set; lower scores get a warmer, gentler
// set (hearts, sprouts, study vibes) to keep the tone encouraging — never harsh.
const CELEBRATION_EMOJIS = ['🎉', '🎊', '🥳', '🏆', '⭐', '✨', '🌟', '🙌', '👏', '💪', '🦌', '🐗'];
const ENCOURAGE_EMOJIS = ['💛', '🤍', '🫶', '🌱', '🌿', '📚', '✏️', '💪', '🌸', '☘️', '🦌', '💗'];

function randomEmojis(n, pool = CELEBRATION_EMOJIS) {
  const p = [...pool];
  shuffle(p);
  return p.slice(0, n).join(' ');
}

// Resolve praise.js's optional message banks into one object (tier -> array, or
// null if that bank — or the whole script — is absent). The typeof guards avoid
// a ReferenceError when praise.js didn't load.
function praiseBanks() {
  return {
    perfect: typeof PRAISE_PERFECT !== 'undefined' ? PRAISE_PERFECT : null,
    high:    typeof PRAISE         !== 'undefined' ? PRAISE         : null,
    good:    typeof PRAISE_GOOD    !== 'undefined' ? PRAISE_GOOD    : null,
    ok:      typeof PRAISE_OK      !== 'undefined' ? PRAISE_OK      : null,
    low:     typeof PRAISE_LOW     !== 'undefined' ? PRAISE_LOW     : null,
  };
}

// Pick the message bank + emojis for the end screen, scaled to how the run went.
// Always positive: every tier returns a warm, affectionate line — lower scores
// get gentle, motivating ones rather than a dry summary. Returns null only if
// praise.js is missing entirely (graceful fallback to the plain summary).
function pickPraise(ratio, perfect) {
  const b = praiseBanks();
  if (perfect && hasLines(b.perfect)) return { lines: b.perfect, emojis: `💯 ${randomEmojis(3)}` };
  if (ratio > 0.9 && hasLines(b.high)) return { lines: b.high, emojis: randomEmojis(3) };
  if (ratio >= 0.7 && hasLines(b.good)) return { lines: b.good, emojis: randomEmojis(3) };
  if (ratio >= 0.5 && hasLines(b.ok))  return { lines: b.ok,   emojis: randomEmojis(3, ENCOURAGE_EMOJIS) };
  if (hasLines(b.low))                 return { lines: b.low,  emojis: randomEmojis(3, ENCOURAGE_EMOJIS) };
  if (hasLines(b.high))                return { lines: b.high, emojis: randomEmojis(3, ENCOURAGE_EMOJIS) };  // last resort
  return null;
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
  document.body.classList.remove('session-active');
  els.cardContainer.hidden = true;
  els.emptyScreen.hidden = true;
  els.endScreen.hidden = false;
  const { correct, total } = state.score;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const ratio = total === 0 ? 0 : correct / total;
  const perfect = total > 0 && correct === total;   // 100%, no mistakes

  // Always close on an affectionate, positive note, with the message bank scaled
  // to the score (perfect → great → good → ok → low). Even a rough run gets a
  // warm, motivating line instead of a dry summary. A perfect 100% gets the
  // golden box. The plain summary is only a fallback (no answers, or no banks).
  const praise = total === 0 ? null : pickPraise(ratio, perfect);
  if (praise) {
    els.praiseEmojis.textContent = praise.emojis;
    els.praiseMsg.textContent = pickRandom(praise.lines);
    els.praiseScore.textContent = `${pct}% — ${correct}/${total}`;
    els.praise.classList.toggle('perfect', perfect);
    els.praise.hidden = false;
    els.endSummary.hidden = true;
  } else {
    els.praise.hidden = true;
    els.endSummary.hidden = false;
    els.endSummary.textContent = total === 0
      ? t('end.summaryNone')
      : t('end.summary', { correct, total, pct });
  }

  renderBreakdown();
}

function showEmptyScreen() {
  state.current = null;
  document.body.classList.remove('session-active');
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
  els.streak.hidden = true;        // fresh session starts with no streak
  // On mobile this folds the top bar down to just the progress bar, freeing
  // vertical space so the card (and its Next button) fits without scrolling.
  document.body.classList.add('session-active');
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
    refreshTopicsStats();
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

  els.difficultyPills.addEventListener('change', (e) => {
    const cb = e.target;
    if (!cb.matches('input[type=checkbox]')) return;
    if (cb.checked) state.selectedDifficulties.add(cb.value);
    else state.selectedDifficulties.delete(cb.value);
    updateAvailableCount();        // setup screen: refresh preview, don't start
  });

  els.themeToggle.addEventListener('click', toggleTheme);

  if (els.langSwitch) {
    els.langSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-opt');
      if (btn && btn.dataset.lang && btn.dataset.lang !== state.lang) {
        applyLanguage(btn.dataset.lang);
      }
    });
  }

  els.startBtn.addEventListener('click', () => {
    if (!els.startBtn.disabled) startSession();
  });
  els.newSessionBtn.addEventListener('click', () => showSetupScreen());

  // Clicking the title returns to the initial setup screen, like a logo/home link.
  els.title.addEventListener('click', () => showSetupScreen());
  els.title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSetupScreen(); }
  });

  els.resetBtn.addEventListener('click', () => {
    if (!confirm(t('confirm.reset'))) return;
    clearSeen();
    clearCorrect();
    refreshAfterDataChange();
  });

  els.flagBtn.addEventListener('click', () => {
    if (!state.current) return;
    if (!confirm(t('confirm.flag'))) return;
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
    // Drop the flagged card from the back-trail too, so Back can't return to a
    // question we've just hidden.
    const wasFront = state.histPos >= state.history.length - 1;
    if (state.histPos >= 0) {
      state.history.splice(state.histPos, 1);
      state.histPos -= 1;
    }
    updateFlaggedBadge();
    if (!wasFront && state.history.length > 0) {
      // We were reviewing an earlier card: return to the live front rather than
      // walking forward onto another already-answered (locked) card.
      state.histPos = state.history.length - 1;
      showRecord(state.history[state.histPos]);
    } else {
      nextQuestion();
    }
  });

  if (els.restoreFlaggedBtn) {
    els.restoreFlaggedBtn.addEventListener('click', () => {
      const flagged = loadFlagged();
      if (flagged.size === 0) {
        alert(t('alert.noFlagged'));
        return;
      }
      if (!confirm(t('confirm.restore', { n: flagged.size }))) return;
      clearFlagged();
      refreshAfterDataChange();
    });
  }
  els.nextBtn.addEventListener('click', () => nextQuestion());
  if (els.backBtn) els.backBtn.addEventListener('click', () => prevQuestion());
  els.restartBtn.addEventListener('click', () => startSession());

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!els.topicsPanel.hidden && e.key === 'Escape') {
      els.topicsPanel.hidden = true;
      els.topicsToggle.setAttribute('aria-expanded', 'false');
      return;
    }
    if (!state.current) return;
    const typing = e.target && e.target.tagName === 'INPUT';   // a fill-in box has focus
    const isFill = state.current.type === 'fill';
    // 'h' toggles the hint — but not while typing into a blank (you'd never type 'h').
    if ((e.key === 'h' || e.key === 'H') && !typing && !els.suggestionBox.hidden) {
      els.suggestionBox.open = !els.suggestionBox.open;
      e.preventDefault();
      return;
    }
    // Left arrow steps back one question (not while typing — it moves the caret).
    if (e.key === 'ArrowLeft' && !typing && state.histPos > 0) {
      prevQuestion();
      e.preventDefault();
      return;
    }
    if (!state.answered) {
      if (isFill) {
        // digits are part of the answer here; only Enter submits (also bound per-input)
        if (e.key === 'Enter') { handleFillSubmit(); e.preventDefault(); }
        return;
      }
      if (/^[1-4]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < state.current.options.length) {
          handleAnswer(idx);
          e.preventDefault();
        }
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      nextQuestion();
      e.preventDefault();
    }
  });
}

// ---------- boot ----------

(async function init() {
  bindEvents();
  state.lang = loadLang();
  applyLanguage(state.lang);   // localize static chrome + theme label before anything renders
  try {
    await loadBank();
  } catch (err) {
    // show only the error card (otherwise the setup screen stays stacked on top)
    els.setupScreen.hidden = true;
    els.cardContainer.hidden = false;
    els.questionText.textContent = t('error.load');
    els.options.innerHTML = '';
    console.error(err);
    return;
  }
  initSelection();
  buildTopicsControl();
  buildCountPresets();
  const savedLen = loadLength();   // normalize to a known chip ('all' or a preset)
  const knownLen = savedLen === 'all' || COUNT_PRESETS.includes(parseInt(savedLen, 10));
  applyCount(knownLen ? savedLen : 'all');
  showSetupScreen();          // land on the setup screen; the user taps "Inizia" to begin
})();
