"""Contract tests for the flashcard study mode in ``app.js``.

Static-source checks like ``test_app_navigation.py`` (the harness has no JS
runtime): they read ``app.js`` / ``index.html`` / ``i18n.js`` and pin the
guarantees a regression could silently break.

The feature: on the setup screen the user ticks Quiz and/or Flashcard. A
flashcard shows the question on the front and, once tapped, flips to show only
the correct answer on the back. With both modes ticked, each drawn card is a
quiz question or a flashcard on a 50/50 coin flip. Flipping never grades; once
flipped, the user grades themselves with "Sbagliata" (red, left) or "Corretta"
(green, right) in place of Avanti, recorded exactly like a quiz answer — so a
wrong flashcard stays in the pool and comes back in a future session.

Run:
    python3 -m unittest discover -s tests
"""

import os
import re
import unittest

from test_app_navigation import APP_JS, INDEX_HTML, function_body
from test_i18n import EN, IT

with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "styles.css"), encoding="utf-8") as _f:
    STYLES_CSS = _f.read()


class TestFlashcardMarkup(unittest.TestCase):
    """The mode picker and the flip card exist in index.html."""

    def test_mode_picker_on_setup_screen(self):
        setup = INDEX_HTML.find('id="setup-screen"')
        pills = INDEX_HTML.find('id="mode-pills"')
        start = INDEX_HTML.find('id="start-btn"')
        self.assertTrue(-1 < setup < pills < start,
                        "#mode-pills should sit on the setup screen, before the Start button")

    def test_both_modes_are_checkboxes(self):
        # Checkboxes, not radios: both modes may be ticked at once.
        for value in ("quiz", "flash"):
            with self.subTest(mode=value):
                self.assertRegex(
                    INDEX_HTML,
                    rf'<input type="checkbox" value="{value}"',
                    f"the '{value}' mode must be a checkbox so both can be ticked",
                )

    def test_flashcard_has_two_faces_and_starts_hidden(self):
        match = re.search(r'<div[^>]*id="flashcard"[^>]*>', INDEX_HTML)
        self.assertIsNotNone(match, "no #flashcard element in index.html")
        self.assertIn("hidden", match.group(0), "#flashcard must start hidden (quiz is the default)")
        for needle in ('id="flashcard-question"', 'id="flashcard-answer"',
                       "flashcard-front", "flashcard-back"):
            with self.subTest(needle=needle):
                self.assertIn(needle, INDEX_HTML)

    def test_grade_buttons_wrong_left_right_right(self):
        feedback = INDEX_HTML.find('id="feedback"')
        wrong = INDEX_HTML.find('data-i18n="flash.wrong"')
        right = INDEX_HTML.find('data-i18n="flash.right"')
        nxt = INDEX_HTML.find('id="next-btn"')
        self.assertTrue(-1 < feedback < wrong < right < nxt,
                        "Sbagliata then Corretta must sit in the feedback row, before Avanti")
        match = re.search(r'<div[^>]*id="flash-grade"[^>]*>', INDEX_HTML)
        self.assertIsNotNone(match, "no #flash-grade row in index.html")
        self.assertIn("hidden", match.group(0), "#flash-grade must start hidden")

    def test_flashcard_inside_card(self):
        card = INDEX_HTML.find('id="card"')
        flash = INDEX_HTML.find('id="flashcard"')
        feedback = INDEX_HTML.find('id="feedback"')
        self.assertTrue(-1 < card < flash < feedback,
                        "#flashcard should sit inside the card, above the Next/feedback row")


class TestModeSelection(unittest.TestCase):
    """Modes persist, never go empty, and mix 50/50 when both are ticked."""

    def test_modes_key_keeps_storage_prefix(self):
        self.assertIn("'giud_studia.modes.v1'", APP_JS,
                      "the modes must persist under the giud_studia.* localStorage prefix")

    def test_last_mode_cannot_be_unticked(self):
        body = function_body(APP_JS, "setMode")
        self.assertRegex(body, r"size\s*>\s*1",
                         "setMode must refuse to untick the last remaining mode")

    def test_load_falls_back_to_quiz(self):
        body = function_body(APP_JS, "loadModes")
        self.assertIn("new Set(['quiz'])", body, "loadModes must default to quiz-only")

    def test_both_modes_flip_a_coin(self):
        body = function_body(APP_JS, "drawAsFlashcard")
        self.assertIn("Math.random() < 0.5", body,
                      "with both modes ticked each card must be a 50/50 draw")

    def test_mode_is_decided_per_card(self):
        # The draw is stored on the history record, so Back replays a card in the
        # same form it was first shown in.
        self.assertIn("newRecord(q, drawAsFlashcard())", APP_JS,
                      "nextQuestion must draw each new card's mode and store it on the record")
        self.assertIn("flash,", function_body(APP_JS, "newRecord"),
                      "newRecord must keep the card's flash flag")
        self.assertIn("record.flash", function_body(APP_JS, "renderQuestion"),
                      "renderQuestion must render from the record's own mode")


class TestFlashcardGrading(unittest.TestCase):
    """Flipping only reveals; the self-grade buttons record it like a quiz answer."""

    def test_flip_does_not_grade(self):
        body = function_body(APP_JS, "flipFlashcard")
        for forbidden in ("gradeResult(", "saveCorrect", "saveSeen", "state.score", "state.streak"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, body, f"flipFlashcard must not touch {forbidden}")

    def test_self_grade_is_recorded_like_a_quiz_answer(self):
        # The same bookkeeping as a quiz answer — that's what makes a wrong
        # flashcard come back in a future session.
        body = function_body(APP_JS, "gradeFlashcard")
        self.assertIn("recordResult(", body, "gradeFlashcard must record the verdict via recordResult")
        self.assertIn("nextQuestion(", body, "grading a flashcard must move on to the next card")
        self.assertIn("recordResult(", function_body(APP_JS, "gradeResult"),
                      "quiz answers must share recordResult with flashcards")
        record = function_body(APP_JS, "recordResult")
        self.assertIn("correct.delete(q.id)", record, "a wrong verdict must un-master the question")
        self.assertIn("saveSeen", record, "a graded card must be marked seen")

    def test_only_a_revealed_card_can_be_graded(self):
        # Guards the double tap: the next card takes over currentRecord at once.
        self.assertIn("!record.revealed", function_body(APP_JS, "gradeFlashcard"),
                      "gradeFlashcard must ignore a card that hasn't been flipped")
        self.assertIn("record.revealed = true", function_body(APP_JS, "flipFlashcard"),
                      "the first flip must mark the card revealed")
        self.assertIn("revealed: false", function_body(APP_JS, "newRecord"))

    def test_grade_buttons_replace_next(self):
        body = function_body(APP_JS, "showFlashFeedback")
        self.assertIn("els.nextBtn.hidden = !record.answered", body,
                      "Avanti must give way to the grade buttons until the card is graded")
        self.assertIn("disabled = record.answered", body,
                      "a graded card revisited via Back must show its verdict locked")

    def test_graded_card_leaves_toward_its_button(self):
        # Corretta (right) slides the card out right with the emoji rising from
        # the button; Sbagliata (left) slides it out left.
        body = function_body(APP_JS, "gradeFlashcard")
        self.assertIn("nextQuestion(isCorrect ? 'leaving-right' : 'leaving-left')", body)
        self.assertIn("popEmoji(els.flashGrade.querySelector('.grade-btn--right'))", body)
        self.assertIn("classList.add(exitClass)", function_body(APP_JS, "renderQuestion"),
                      "renderQuestion must play the exit the caller asked for")
        for rule in (".card.leaving-right", ".card.leaving-left", ".emoji-pop.rise"):
            with self.subTest(rule=rule):
                self.assertIn(rule, STYLES_CSS, f"styles.css is missing {rule}")

    def test_keyboard_grades_with_1_and_2(self):
        self.assertRegex(APP_JS, r"e\.key === '1' \|\| e\.key === '2'[\s\S]{0,80}gradeFlashcard\(e\.key === '2'\)",
                         "keys 1 (Sbagliata) and 2 (Corretta) must grade a flipped flashcard")

    def test_flip_does_not_scroll(self):
        # Unlike a quiz answer, flipping must leave the page where it is.
        body = function_body(APP_JS, "flipFlashcard")
        self.assertNotIn("scrollBy", body, "flipFlashcard must not scroll the page")
        self.assertNotIn("classList.add('answered')", body,
                         "flipFlashcard must not add the post-answer scroll spacer")
        self.assertNotIn("scrollBy", function_body(APP_JS, "gradeFlashcard"),
                         "gradeFlashcard must not scroll the page")

    def test_back_face_shows_only_the_correct_answer(self):
        body = function_body(APP_JS, "renderFlashcard")
        self.assertIn("flashcardAnswer.textContent = correctAnswerText(", body,
                      "the back face must show the correct answer (via correctAnswerText)")
        self.assertIn("q.options[q.correctIndex]", function_body(APP_JS, "correctAnswerText"))


class TestFlashcardStrings(unittest.TestCase):
    """Every flashcard UI string exists in both languages."""

    def test_keys_in_both_languages(self):
        for key in ("setup.mode", "mode.quiz", "mode.flash", "mode.hint",
                    "flash.tap", "flash.answer", "flash.aria", "flash.wrong", "flash.right"):
            with self.subTest(key=key):
                self.assertIn(key, IT, f"'{key}' missing from the Italian strings")
                self.assertIn(key, EN, f"'{key}' missing from the English strings")


if __name__ == "__main__":
    unittest.main(verbosity=2)
