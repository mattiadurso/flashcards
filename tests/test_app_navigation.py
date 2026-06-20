"""Contract tests for the Back-button navigation in ``app.js``.

The project ships no JavaScript runtime in its test harness (everything runs on
plain ``python3`` — see ``tests/README.md``), so these are *static-source*
checks: they read ``app.js`` / ``index.html`` and assert the wiring and the key
invariants of the back-navigation feature are present. They are intentionally
behaviour-focused — each test pins one guarantee a regression could silently
break — rather than asserting exact formatting.

The feature: from the second question of a session onward a "‹ Indietro" button
lets the user step back one question at a time, up to the first. Earlier
questions are shown **read-only** — the stored answer is replayed and cannot be
changed, so stepping back never alters the answer or the score.

Run:
    python3 -m unittest discover -s tests
"""

import os
import re
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TESTS_DIR)

with open(os.path.join(ROOT, "app.js"), encoding="utf-8") as _f:
    APP_JS = _f.read()
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as _f:
    INDEX_HTML = _f.read()


def function_body(src, name):
    """Return the source text of the top-level ``function name(...)``.

    Sliced from the ``function name(`` declaration up to the next top-level
    ``function`` declaration. That's robust to template-literal braces (``${}``)
    inside the body, which a naive brace-matcher would trip over, and is precise
    enough for the presence/absence assertions below.
    """
    start = src.find(f"function {name}(")
    assert start != -1, f"function {name}() not found in app.js"
    nxt = src.find("\nfunction ", start + 1)
    return src[start:nxt if nxt != -1 else len(src)]


class TestBackButtonMarkup(unittest.TestCase):
    """The Back control exists, starts hidden, and sits at the top of the card."""

    def test_back_button_present(self):
        self.assertIn('id="back-btn"', INDEX_HTML, "no #back-btn element in index.html")

    def test_back_button_starts_hidden(self):
        # First paint (before app.js runs) must not flash the button on Q1.
        match = re.search(r"<button[^>]*id=\"back-btn\"[^>]*>", INDEX_HTML)
        self.assertIsNotNone(match, "#back-btn is not a <button>")
        self.assertIn("hidden", match.group(0), "#back-btn must start with the hidden attribute")

    def test_back_button_inside_card(self):
        card = INDEX_HTML.find('id="card"')
        back = INDEX_HTML.find('id="back-btn"')
        question = INDEX_HTML.find('id="question-text"')
        self.assertTrue(
            -1 < card < back < question,
            "#back-btn should sit inside the card, above the question text",
        )


class TestNavigationWiring(unittest.TestCase):
    """Session history exists and Back/Next are wired to it."""

    def test_history_state_fields(self):
        for field in ("history:", "histPos:"):
            self.assertIn(field, APP_JS, f"state is missing the '{field}' navigation field")

    def test_navigation_functions_defined(self):
        for name in (
            "newRecord", "nextQuestion", "prevQuestion", "showRecord",
            "updateBackButton", "replayAnswer", "applyMcAnswer",
            "applyFillAnswer", "showExplanation",
        ):
            with self.subTest(fn=name):
                self.assertIn(f"function {name}(", APP_JS, f"{name}() is not defined")

    def test_back_button_click_calls_prev(self):
        self.assertRegex(
            APP_JS,
            r"backBtn\.addEventListener\(\s*'click'[\s\S]{0,60}prevQuestion\(\)",
            "the #back-btn click handler must call prevQuestion()",
        )

    def test_left_arrow_steps_back(self):
        # ArrowLeft is the keyboard equivalent of the Back button.
        self.assertRegex(
            APP_JS,
            r"ArrowLeft[\s\S]{0,120}prevQuestion\(\)",
            "ArrowLeft should call prevQuestion()",
        )

    def test_new_session_resets_history(self):
        body = function_body(APP_JS, "applyFilters")
        self.assertIn("state.history = []", body, "applyFilters must clear history for a new session")
        self.assertIn("state.histPos = -1", body, "applyFilters must reset histPos for a new session")

    def test_flagging_removes_card_from_back_trail(self):
        # A flagged card is hidden, so Back must not be able to return to it.
        self.assertIn(
            "state.history.splice", APP_JS,
            "flagging a question must drop it from the back-trail (history.splice)",
        )


class TestBackBounds(unittest.TestCase):
    """Back is offered from Q2 onward and never steps before Q1."""

    def test_button_hidden_on_first_question(self):
        body = function_body(APP_JS, "updateBackButton")
        self.assertRegex(
            body, r"histPos\s*<=\s*0",
            "updateBackButton must hide Back while on the first question (histPos <= 0)",
        )
        self.assertIn("hidden", body, "updateBackButton must toggle the button's hidden state")

    def test_prev_guards_against_underflow(self):
        body = function_body(APP_JS, "prevQuestion")
        self.assertRegex(
            body, r"histPos\s*<=\s*0[\s\S]*return",
            "prevQuestion must return early when there's no earlier question",
        )


class TestBackIsReadOnly(unittest.TestCase):
    """Stepping back must not re-grade: the answer and score stay untouched."""

    def test_replay_does_not_rescore(self):
        body = function_body(APP_JS, "replayAnswer")
        # Match the call `gradeResult(`, not the bare word: replayAnswer's comment
        # legitimately references gradeResult to explain a design choice.
        self.assertNotIn("gradeResult(", body, "replayAnswer must NOT call gradeResult (no rescoring)")
        self.assertNotIn("state.score", body, "replayAnswer must NOT touch the score")
        self.assertNotIn("saveSeen", body, "replayAnswer must NOT mark the question seen again")

    def test_replay_locks_the_controls(self):
        body = function_body(APP_JS, "replayAnswer")
        self.assertTrue(
            "applyMcAnswer" in body and "applyFillAnswer" in body,
            "replayAnswer must lock both question types via applyMcAnswer / applyFillAnswer",
        )

    def test_locking_helpers_disable_inputs(self):
        self.assertIn("disabled = true", function_body(APP_JS, "applyMcAnswer"),
                      "applyMcAnswer must disable the option buttons")
        self.assertIn("disabled = true", function_body(APP_JS, "applyFillAnswer"),
                      "applyFillAnswer must disable the fill inputs")

    def test_navigation_paths_never_grade(self):
        for name in ("prevQuestion", "showRecord", "updateBackButton"):
            with self.subTest(fn=name):
                body = function_body(APP_JS, name)
                self.assertNotIn("gradeResult", body, f"{name} must not grade an answer")

    def test_only_live_answer_handlers_grade(self):
        # Scoring happens exactly where a fresh answer is given — nowhere else.
        for name in ("handleAnswer", "handleFillSubmit"):
            with self.subTest(fn=name):
                self.assertIn("gradeResult(", function_body(APP_JS, name),
                              f"{name} should grade the live answer")

    def test_show_record_respects_stored_answered_state(self):
        # This is what keeps a revisited card locked: handleAnswer/handleFillSubmit
        # both bail out when state.answered is already true.
        body = function_body(APP_JS, "showRecord")
        self.assertIn("state.answered = record.answered", body,
                      "showRecord must restore the record's answered flag so locked cards stay locked")


class TestAnswerIsRemembered(unittest.TestCase):
    """The given answer is captured on the record so Back can replay it exactly."""

    def test_multiple_choice_records_choice(self):
        body = function_body(APP_JS, "handleAnswer")
        self.assertIn("record.chosenIdx", body, "handleAnswer must store the chosen option on the record")
        self.assertIn("record.answered = true", body, "handleAnswer must mark the record answered")

    def test_fill_records_values(self):
        body = function_body(APP_JS, "handleFillSubmit")
        self.assertIn("record.fillValues", body, "handleFillSubmit must store the typed values")
        self.assertIn("record.blanksCorrect", body, "handleFillSubmit must store per-blank correctness")


class TestReviewPolish(unittest.TestCase):
    """Behaviours added after review: a position-aware progress bar and a
    replay path that doesn't leave the mobile bottom spacer / dead focus."""

    def test_progress_is_position_aware(self):
        body = function_body(APP_JS, "updateProgress")
        self.assertIn("state.histPos", body,
                      "updateProgress must reflect the on-screen card position while reviewing")

    def test_show_record_refreshes_progress(self):
        body = function_body(APP_JS, "showRecord")
        self.assertIn("updateProgress()", body,
                      "showRecord must refresh the progress indicator when navigating")

    def test_replay_does_not_add_mobile_spacer(self):
        # The 45vh body.answered spacer is for the live-answer auto-scroll only;
        # re-adding it on a reviewed card leaves a large empty gap on mobile.
        body = function_body(APP_JS, "replayAnswer")
        self.assertNotIn("classList.add('answered')", body,
                         "replayAnswer must not re-add the body.answered spacer on reviewed cards")

    def test_fill_skips_focus_when_answered(self):
        body = function_body(APP_JS, "renderFill")
        self.assertIn("!answered", body,
                      "renderFill must skip auto-focus when replaying an answered card")


if __name__ == "__main__":
    unittest.main(verbosity=2)
