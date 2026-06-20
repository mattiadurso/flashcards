"""Data-integrity tests for the Flashcards question banks.

These tests guard the contract between the question JSON files and ``app.js``.
Every invariant the website relies on at runtime — a manifest that lists every
file, globally-unique ids, a ``correctIndex`` that points inside ``options``,
fill questions whose blanks match their answers — is checked here, so a
malformed bank is caught at commit time instead of silently breaking in the
browser.

Two severities:
  * **Hard tests** (the ``unittest`` cases below) must pass; they cover anything
    that would make the site fail to load or grade a question incorrectly.
  * **Style warnings** (``collect_warnings``) are printed but never fail the
    build; they flag authoring-quality issues the spec discourages.

Run:
    python3 -m unittest discover -s tests          # hard tests only
    python3 tests/test_question_banks.py           # hard tests + style warnings
"""

import json
import os
import re
import unittest

# ---------- paths ----------

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TESTS_DIR)
QUESTIONS_DIR = os.path.join(ROOT, "questions")
MANIFEST_PATH = os.path.join(QUESTIONS_DIR, "index.json")
EASTER_EGGS_PATH = os.path.join(QUESTIONS_DIR, "easter-eggs.json")

# Files under questions/ that are intentionally NOT in the manifest.
UNLISTED_FILES = frozenset({"index.json", "easter-eggs.json"})

# ---------- schema rules (mirror QUESTION_FORMAT.md) ----------

ALLOWED_DIFFICULTY = frozenset({"easy", "medium", "hard"})
MIN_OPTIONS, MAX_OPTIONS = 2, 4

# Stable id: lowercase letters/digits in hyphen-separated segments, no spaces.
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# A blank in a fill question is a run of two or more underscores — the same
# marker app.js splits the question text on (``/_{2,}/``).
BLANK_PATTERN = re.compile(r"_{2,}")
# Discouraged "all/none of the above" options.
ALL_OF_THE_ABOVE_PATTERN = re.compile(
    r"\b(?:tutte|nessuna)\s+(?:le|delle)\s+precedenti\b", re.IGNORECASE
)


# ---------- loading ----------


def _safe_read_json(path):
    """Return ``(data, None)`` on success or ``(None, error_message)``."""
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle), None
    except (OSError, ValueError) as exc:
        return None, str(exc)


def parse_manifest(manifest):
    """Flatten index.json into a list of per-file entries.

    Accepts every shape app.js accepts (a flat list, ``{topics: [...]}`` with a
    flat ``file`` per topic, or the nested ``files: [...]`` form) so the tests
    validate exactly what the website loads.
    """
    if not manifest:
        return []
    raw_topics = manifest if isinstance(manifest, list) else manifest.get("topics", [])
    entries = []
    for topic in raw_topics:
        if isinstance(topic.get("files"), list):
            for file_entry in topic["files"]:
                entries.append(
                    {
                        "topic": topic.get("topic"),
                        "label": topic.get("label"),
                        "file": file_entry.get("file"),
                        "species": file_entry.get("species"),
                        "source": file_entry.get("source"),
                        "count": file_entry.get("count"),
                    }
                )
        elif topic.get("file"):
            entries.append(
                {
                    "topic": topic.get("topic"),
                    "label": topic.get("label"),
                    "file": topic.get("file"),
                    "species": None,
                    "source": None,
                    "count": None,
                }
            )
    return entries


def question_list(data):
    """A bank file is either a flat array or ``{"questions": [...]}``."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("questions", [])
    return []


def resolved(question, entry, key):
    """A field's effective value: the question's own, falling back to the manifest."""
    return question.get(key) or (entry or {}).get(key)


# Load everything once at import time; the test cases iterate these caches.
MANIFEST, MANIFEST_ERROR = _safe_read_json(MANIFEST_PATH)
ENTRIES = parse_manifest(MANIFEST)

BANKS = {}         # file path (relative to questions/) -> list[question]
PARSE_ERRORS = {}  # file path -> error message
for _entry in ENTRIES:
    _file = _entry["file"]
    if not _file:
        continue
    _data, _err = _safe_read_json(os.path.join(QUESTIONS_DIR, _file))
    if _err:
        PARSE_ERRORS[_file] = _err
    else:
        BANKS[_file] = question_list(_data)

# (entry, question) pairs for every question reachable from the manifest.
QUESTIONS = [(entry, q) for entry in ENTRIES for q in BANKS.get(entry["file"], [])]

# Hidden bonus questions: not in the manifest, but they share the id namespace
# and go through the same render path, so they earn the same schema checks.
_EGGS_DATA, _ = _safe_read_json(EASTER_EGGS_PATH)
EGGS = question_list(_EGGS_DATA) if _EGGS_DATA else []
# (entry, question) for every schema-checked question, eggs included.
ALL_SCHEMA_QUESTIONS = QUESTIONS + [(None, q) for q in EGGS]


def _label(entry, question):
    """A readable identifier for subTest output."""
    where = (entry or {}).get("file", "easter-eggs.json")
    return f'{question.get("id", "<no id>")} ({where})'


def is_fill(question):
    return question.get("type") == "fill"


# ---------- manifest integrity ----------


class TestManifest(unittest.TestCase):
    """index.json parses, is internally consistent, and lists every bank file."""

    def test_manifest_parses(self):
        self.assertIsNone(MANIFEST_ERROR, f"questions/index.json is invalid JSON: {MANIFEST_ERROR}")

    def test_manifest_has_entries(self):
        self.assertGreater(len(ENTRIES), 0, "index.json lists no question files")

    def test_every_entry_has_a_file_path(self):
        for entry in ENTRIES:
            with self.subTest(species=entry.get("species")):
                self.assertTrue(entry.get("file"), f"manifest entry has no 'file': {entry}")

    def test_file_paths_are_unique(self):
        paths = [e["file"] for e in ENTRIES if e.get("file")]
        duplicates = sorted({p for p in paths if paths.count(p) > 1})
        self.assertEqual(duplicates, [], f"index.json lists the same file twice: {duplicates}")

    def test_every_referenced_file_exists_and_parses(self):
        for entry in ENTRIES:
            path = entry.get("file")
            with self.subTest(file=path):
                self.assertNotIn(path, PARSE_ERRORS, f"{path}: {PARSE_ERRORS.get(path)}")
                full = os.path.join(QUESTIONS_DIR, path) if path else ""
                self.assertTrue(os.path.exists(full), f"manifest references a missing file: {path}")

    def test_no_orphan_files_on_disk(self):
        """Every *.json under questions/ is listed in the manifest (or unlisted on purpose)."""
        referenced = {e["file"] for e in ENTRIES}
        for dirpath, _dirs, files in os.walk(QUESTIONS_DIR):
            for name in files:
                if not name.endswith(".json"):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, name), QUESTIONS_DIR)
                if rel in UNLISTED_FILES:
                    continue
                with self.subTest(file=rel):
                    self.assertIn(
                        rel, referenced,
                        f"{rel} exists but is not in index.json — the site won't load it",
                    )

    def test_count_matches_actual_question_total(self):
        for entry in ENTRIES:
            if entry.get("count") is None:
                continue
            with self.subTest(file=entry["file"]):
                actual = len(BANKS.get(entry["file"], []))
                self.assertEqual(
                    entry["count"], actual,
                    f'{entry["file"]}: manifest count {entry["count"]} != {actual} questions in the file',
                )


# ---------- per-question schema ----------


class TestQuestionSchema(unittest.TestCase):
    """Fields shared by every question type (multiple-choice and fill)."""

    def test_id_present_and_well_formed(self):
        for entry, q in ALL_SCHEMA_QUESTIONS:
            with self.subTest(q=_label(entry, q)):
                qid = q.get("id")
                self.assertIsInstance(qid, str, "id must be a string")
                self.assertTrue(
                    ID_PATTERN.match(qid),
                    f"id '{qid}' must be lowercase, hyphen-separated, no spaces",
                )

    def test_question_text_present(self):
        for entry, q in ALL_SCHEMA_QUESTIONS:
            with self.subTest(q=_label(entry, q)):
                text = q.get("question")
                self.assertIsInstance(text, str, "question must be a string")
                self.assertTrue(text.strip(), "question text is empty")

    def test_difficulty_is_valid_when_present(self):
        for entry, q in ALL_SCHEMA_QUESTIONS:
            if "difficulty" not in q:
                continue
            with self.subTest(q=_label(entry, q)):
                self.assertIn(
                    q["difficulty"], ALLOWED_DIFFICULTY,
                    f"difficulty must be one of {sorted(ALLOWED_DIFFICULTY)}",
                )

    def test_source_is_resolvable(self):
        """Each question carries a source, on the question or inherited from the manifest."""
        for entry, q in QUESTIONS:  # eggs have no manifest entry to inherit from
            with self.subTest(q=_label(entry, q)):
                self.assertTrue(resolved(q, entry, "source"), "no source on question or manifest entry")

    def test_image_paths_exist(self):
        for entry, q in ALL_SCHEMA_QUESTIONS:
            image = q.get("image")
            if not image:
                continue
            with self.subTest(q=_label(entry, q)):
                self.assertTrue(
                    os.path.exists(os.path.join(ROOT, image)),
                    f"image '{image}' is referenced but the file is missing",
                )


class TestMultipleChoice(unittest.TestCase):
    """Schema specific to multiple-choice questions."""

    def _mc_questions(self):
        return [(e, q) for e, q in ALL_SCHEMA_QUESTIONS if not is_fill(q)]

    def test_option_count_in_range(self):
        for entry, q in self._mc_questions():
            with self.subTest(q=_label(entry, q)):
                options = q.get("options")
                self.assertIsInstance(options, list, "options must be a list")
                self.assertTrue(
                    MIN_OPTIONS <= len(options) <= MAX_OPTIONS,
                    f"expected {MIN_OPTIONS}-{MAX_OPTIONS} options, got {len(options)}",
                )

    def test_options_are_nonempty_and_unique(self):
        for entry, q in self._mc_questions():
            options = q.get("options") or []
            with self.subTest(q=_label(entry, q)):
                self.assertTrue(all(str(o).strip() for o in options), "an option is empty")
                self.assertEqual(
                    len(options), len({str(o) for o in options}),
                    f"duplicate option text: {options}",
                )

    def test_correct_index_in_range(self):
        for entry, q in self._mc_questions():
            options = q.get("options") or []
            with self.subTest(q=_label(entry, q)):
                idx = q.get("correctIndex")
                self.assertIsInstance(idx, int, "correctIndex must be an integer")
                self.assertTrue(
                    0 <= idx < len(options),
                    f"correctIndex {idx} out of range for {len(options)} options",
                )


class TestFillQuestions(unittest.TestCase):
    """Schema specific to ``type: fill`` questions (mirrors renderFill/handleFillSubmit)."""

    def _fill_questions(self):
        return [(e, q) for e, q in ALL_SCHEMA_QUESTIONS if is_fill(q)]

    def test_has_no_options_or_correct_index(self):
        for entry, q in self._fill_questions():
            with self.subTest(q=_label(entry, q)):
                self.assertNotIn("options", q, "fill questions must not have options")
                self.assertNotIn("correctIndex", q, "fill questions must not have correctIndex")

    def test_answers_match_blank_count(self):
        for entry, q in self._fill_questions():
            with self.subTest(q=_label(entry, q)):
                answers = q.get("answers")
                self.assertIsInstance(answers, list, "answers must be a list")
                blanks = len(BLANK_PATTERN.findall(q.get("question", "")))
                self.assertGreaterEqual(blanks, 1, "fill question has no ___ blank")
                self.assertEqual(
                    len(answers), blanks,
                    f"{len(answers)} answer group(s) but {blanks} blank(s)",
                )

    def test_each_answer_group_is_nonempty(self):
        for entry, q in self._fill_questions():
            with self.subTest(q=_label(entry, q)):
                for i, group in enumerate(q.get("answers") or []):
                    self.assertIsInstance(group, list, f"answers[{i}] must be a list of accepted spellings")
                    self.assertTrue(group, f"answers[{i}] lists no accepted spelling")
                    self.assertTrue(
                        all(isinstance(s, str) and s.strip() for s in group),
                        f"answers[{i}] has an empty accepted spelling",
                    )


class TestGlobalInvariants(unittest.TestCase):
    """Cross-file invariants the website depends on."""

    def test_ids_are_globally_unique(self):
        """ids must be unique across every bank AND the easter eggs (localStorage keys on id)."""
        seen = {}
        duplicates = []
        for entry, q in ALL_SCHEMA_QUESTIONS:
            qid = q.get("id")
            where = (entry or {}).get("file", "easter-eggs.json")
            if qid in seen:
                duplicates.append(f"{qid}: {seen[qid]} & {where}")
            else:
                seen[qid] = where
        self.assertEqual(duplicates, [], "duplicate ids found:\n  " + "\n  ".join(duplicates))


# ---------- non-blocking style warnings ----------


def collect_warnings():
    """Return human-readable, non-failing warnings for spec-discouraged authoring."""
    warnings = []

    all_of_the_above = []
    for entry, q in QUESTIONS:
        for option in q.get("options", []) or []:
            if ALL_OF_THE_ABOVE_PATTERN.search(str(option)):
                all_of_the_above.append((q.get("id"), entry["file"], option))
                break
    if all_of_the_above:
        warnings.append(
            f'{len(all_of_the_above)} question(s) use a "tutte/nessuna delle precedenti" '
            "option — QUESTION_FORMAT.md discourages these:"
        )
        for qid, file, option in all_of_the_above[:10]:
            warnings.append(f'    - {qid} ({file}): "{option}"')
        if len(all_of_the_above) > 10:
            warnings.append(f"    … and {len(all_of_the_above) - 10} more")

    return warnings


def _print_warnings():
    warnings = collect_warnings()
    if warnings:
        print("\n⚠️  Style warnings (non-blocking):")
        for line in warnings:
            print(" ", line)
        print()


if __name__ == "__main__":
    import sys

    # Run the hard tests first (exit=False so we can append warnings afterwards),
    # then print the non-blocking style warnings, then exit on the test result.
    result = unittest.main(verbosity=2, exit=False).result
    _print_warnings()
    sys.exit(0 if result.wasSuccessful() else 1)
