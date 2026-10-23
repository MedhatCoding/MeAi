import unittest

from agent_json import parse_agent_json_response


class AgentJsonParserTests(unittest.TestCase):
    def test_parses_plain_json_object(self):
        self.assertEqual(
            parse_agent_json_response('{"actions": [{"type": "list_files"}]}'),
            {"actions": [{"type": "list_files"}]},
        )

    def test_parses_json_fenced_in_markdown(self):
        result = parse_agent_json_response('Here is the plan:\n```json\n{"actions": []}\n```')
        self.assertEqual(result, {"actions": []})

    def test_repairs_unquoted_keys_and_trailing_comma(self):
        self.assertEqual(
            parse_agent_json_response("{actions: [],}"),
            {"actions": []},
        )

    def test_skips_prose_before_json_object(self):
        self.assertEqual(
            parse_agent_json_response('Plan follows: {"actions": []} done.'),
            {"actions": []},
        )

    def test_rejects_empty_and_non_string_responses(self):
        for value in ("", "   ", None, 123):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_agent_json_response(value)

    def test_rejects_arrays_and_invalid_json(self):
        for value in ('["not", "an object"]', '{"actions": ['):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_agent_json_response(value)

    def test_rejects_oversized_response(self):
        with self.assertRaisesRegex(ValueError, "أكبر من الحد"):
            parse_agent_json_response(" " + "x" * 100_001)


if __name__ == "__main__":
    unittest.main()
