// Giud Studia — local flashcard quiz.
// Vanilla JS, no framework. Loads questions/index.json, fetches every listed
// topic file, merges into one in-memory bank, and walks the user through a
// non-repeating session with localStorage-backed "already seen" tracking.

const SEEN_KEY = 'giud_studia.seen.v1';
const FLAGGED_KEY = 'giud_studia.flagged.v1';

const state = {
  bank: [],              // all loaded questions
  byTopic: new Map(),    // topic -> question[]
  filtered: [],          // questions matching current filters
  queue: [],             // shuffled, not-yet-shown question ids for this session
  current: null,         // current question object
  answered: false,
  score: { correct: 0, total: 0 },
  topic: '__all__',
  difficulty: '__all__',
  hasDifficulty: false,
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
        all.push(q);
      }
    } catch (err) {
      console.warn(`Skipping "${entry.file}": ${err.message}`);
    }
  }

  state.bank = all;
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
    if (state.topic !== '__all__' && q.topic !== state.topic) return false;
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
  state.queue = pool.map(q => q.id);
  state.score = { correct: 0, total: 0 };
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
  topicSelect: document.getElementById('topic-select'),
  difficultySelect: document.getElementById('difficulty-select'),
  difficultyField: document.getElementById('difficulty-field'),
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
  restartBtn: document.getElementById('restart-btn'),
  emptyScreen: document.getElementById('empty-screen'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
};

function buildTopicDropdown() {
  els.topicSelect.innerHTML = '<option value="__all__">All</option>';
  const topics = [...state.byTopic.keys()].sort();
  for (const t of topics) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    els.topicSelect.appendChild(opt);
  }
  els.difficultyField.hidden = !state.hasDifficulty;
}

function updateProgress() {
  const total = state.filtered.length;
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

function showEndScreen() {
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
}

function showEmptyScreen() {
  els.cardContainer.hidden = true;
  els.endScreen.hidden = true;
  els.emptyScreen.hidden = false;
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
  els.endScreen.hidden = true;
  els.emptyScreen.hidden = true;
  els.cardContainer.hidden = false;
  updateProgress();
  if (state.filtered.length === 0) {
    showEmptyScreen();
    return;
  }
  nextQuestion();
}

// ---------- events ----------

function bindEvents() {
  els.topicSelect.addEventListener('change', () => {
    state.topic = els.topicSelect.value;
    startSession();
  });
  els.difficultySelect.addEventListener('change', () => {
    state.difficulty = els.difficultySelect.value;
    startSession();
  });
  els.resetBtn.addEventListener('click', () => {
    if (!confirm('Reset "già viste"?\n\nLe domande segnalate come errate restano nascoste — usa "Ripristina segnalate" per riaverle.')) return;
    clearSeen();
    startSession();
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
      startSession();
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
    if (!state.current) return;
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
    els.questionText.textContent =
      'Could not load questions. Run the app via the start script ' +
      '(file:// fetch is blocked by browsers). See README.md.';
    els.options.innerHTML = '';
    console.error(err);
    return;
  }
  buildTopicDropdown();
  startSession();
})();
