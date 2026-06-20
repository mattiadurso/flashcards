"""Contract tests for the UI language feature (it / en).

Like ``test_app_navigation.py`` these are static-source checks (the harness has
no JS runtime): they parse ``i18n.js``, ``index.html`` and ``app.js`` and assert
the translation contract holds — both languages define the same keys, every key
referenced from the HTML/JS exists, placeholders match across languages, and the
language switch is wired up. This catches the most likely i18n regression: a
string added to one language but not the other, or a markup key with no
translation (which would render as the raw key).

Run:
    python3 -m unittest discover -s tests
"""

import os
import re
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TESTS_DIR)

with open(os.path.join(ROOT, "i18n.js"), encoding="utf-8") as _f:
    I18N_JS = _f.read()
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as _f:
    INDEX_HTML = _f.read()
with open(os.path.join(ROOT, "app.js"), encoding="utf-8") as _f:
    APP_JS = _f.read()

# One key/value per line, double-quoted: `  "key": "value",`. Value runs to the
# last quote on the line, so escaped quotes inside it are fine.
_ENTRY = re.compile(r'^\s*"([^"]+)"\s*:\s*"(.*)",?\s*$')
_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def parse_lang_block(src, lang):
    """Return {key: value} for the ``<lang>: { ... }`` block in i18n.js.

    Reads from the line opening that language's object to the line opening the
    next language (or end of file), collecting every quoted key/value line.
    """
    start = src.find(f"{lang}: {{")
    assert start != -1, f"language block '{lang}:' not found in i18n.js"
    rest = src[start:]
    # Stop at the next top-level language opener so 'it' doesn't swallow 'en'.
    other = re.search(r"\n\s*[a-z]{2}:\s*\{", rest[1:])
    block = rest[: other.start() + 1] if other else rest
    out = {}
    for line in block.splitlines():
        m = _ENTRY.match(line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


IT = parse_lang_block(I18N_JS, "it")
EN = parse_lang_block(I18N_JS, "en")


class TestDictionaries(unittest.TestCase):
    """The it/en maps are well-formed and in sync."""

    def test_both_languages_parsed(self):
        self.assertGreater(len(IT), 10, "the Italian dictionary looks empty/unparsed")
        self.assertGreater(len(EN), 10, "the English dictionary looks empty/unparsed")

    def test_key_sets_identical(self):
        only_it = sorted(set(IT) - set(EN))
        only_en = sorted(set(EN) - set(IT))
        self.assertEqual(only_it, [], f"keys present in it but missing in en: {only_it}")
        self.assertEqual(only_en, [], f"keys present in en but missing in it: {only_en}")

    def test_no_empty_values(self):
        for lang, d in (("it", IT), ("en", EN)):
            for key, value in d.items():
                with self.subTest(lang=lang, key=key):
                    self.assertTrue(value.strip(), f"{lang}['{key}'] is empty")

    def test_placeholders_match_across_languages(self):
        for key in set(IT) & set(EN):
            with self.subTest(key=key):
                self.assertEqual(
                    set(_PLACEHOLDER.findall(IT[key])),
                    set(_PLACEHOLDER.findall(EN[key])),
                    f"placeholder mismatch for '{key}': it={IT[key]!r} en={EN[key]!r}",
                )

    def test_next_renamed_to_avanti(self):
        # The original request: rename "Next" -> "Avanti" (Italian default).
        self.assertEqual(IT.get("next"), "Avanti", "Italian 'next' must be 'Avanti'")
        self.assertEqual(EN.get("next"), "Next", "English 'next' must be 'Next'")


class TestMarkupKeysResolve(unittest.TestCase):
    """Every data-i18n* key used in index.html has a translation in BOTH languages."""

    def _markup_keys(self):
        return set(re.findall(
            r'data-i18n(?:-(?:html|title|aria-label))?="([^"]+)"', INDEX_HTML))

    def test_markup_keys_exist(self):
        keys = self._markup_keys()
        self.assertGreater(len(keys), 5, "expected several data-i18n keys in index.html")
        for key in sorted(keys):
            with self.subTest(key=key):
                self.assertIn(key, IT, f"data-i18n='{key}' has no Italian translation")
                self.assertIn(key, EN, f"data-i18n='{key}' has no English translation")


class TestJsKeysResolve(unittest.TestCase):
    """Every literal t('key') referenced in app.js resolves to a translation."""

    def test_literal_t_keys_exist(self):
        # Only complete literal keys: the string must be immediately followed by
        # ) or , — so computed keys like t('diff.' + x) (followed by +) are skipped.
        keys = set(re.findall(r"""\bt\(\s*['"]([^'"]+)['"]\s*[),]""", APP_JS))
        self.assertGreater(len(keys), 5, "expected several t('...') calls in app.js")
        for key in sorted(keys):
            with self.subTest(key=key):
                self.assertIn(key, IT, f"t('{key}') has no Italian translation")
                self.assertIn(key, EN, f"t('{key}') has no English translation")


class TestLanguageSwitchWiring(unittest.TestCase):
    """The it/en switch exists in the markup and is wired in app.js."""

    def test_switch_markup_present(self):
        self.assertIn('id="lang-switch"', INDEX_HTML, "no #lang-switch in index.html")
        self.assertIn('data-lang="it"', INDEX_HTML, "language switch missing the 'it' option")
        self.assertIn('data-lang="en"', INDEX_HTML, "language switch missing the 'en' option")

    def test_switch_on_setup_screen(self):
        setup = INDEX_HTML.find('id="setup-screen"')
        switch = INDEX_HTML.find('id="lang-switch"')
        first_field = INDEX_HTML.find('class="setup-field"')
        self.assertTrue(
            -1 < setup < switch < first_field,
            "the language switch should sit at the top of the setup screen",
        )

    def test_i18n_script_loaded_before_app(self):
        # Match the <script src=...> tags specifically — "app.js" also appears in a
        # head comment, which would otherwise come first.
        i18n_pos = INDEX_HTML.find('src="i18n.js')
        app_pos = INDEX_HTML.find('src="app.js')
        self.assertTrue(-1 < i18n_pos < app_pos, "i18n.js must be loaded before app.js")

    def test_app_has_language_machinery(self):
        for needle in ("function t(", "function applyLanguage(", "function loadLang(", "LANG_KEY"):
            with self.subTest(needle=needle):
                self.assertIn(needle, APP_JS, f"app.js is missing '{needle}'")

    def test_switch_click_applies_language(self):
        self.assertRegex(
            APP_JS,
            r"langSwitch\.addEventListener\(\s*'click'[\s\S]{0,160}applyLanguage",
            "the #lang-switch click handler must call applyLanguage()",
        )

    def test_language_is_persisted(self):
        self.assertIn(
            "giud_studia.lang.v1", I18N_JS + APP_JS,
            "language preference must be persisted under the giud_studia.lang.v1 key",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
