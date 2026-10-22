import unittest
from unittest.mock import patch
from agent_runtime import execute_agent_actions


class AgentRuntimeTests(unittest.TestCase):
    def test_search_tool_runs_and_is_logged(self):
        results = execute_agent_actions(
            [{"type": "search_web", "query": "python testing"}],
            search_fn=lambda q: "results for " + q,
        )
        self.assertEqual(results[0]["status"], "تم")
        self.assertIn("results for python testing", results[0]["message"])

    def test_unknown_tool_is_rejected(self):
        results = execute_agent_actions(
            [{"type": "run_shell", "command": "whoami"}],
            search_fn=lambda q: "",
        )
        self.assertEqual(results[0]["status"], "فشل")
        self.assertIn("غير مسموح", results[0]["message"])

    def test_write_requires_explicit_permission(self):
        results = execute_agent_actions(
            [{"type": "write_file", "path": "agent_test.txt", "content": "hello"}],
            search_fn=lambda q: "",
            allow_writes=False,
        )
        self.assertEqual(results[0]["status"], "فشل")
        self.assertIn("الكتابة غير مفعّلة", results[0]["message"])

    def test_action_count_is_bounded(self):
        with self.assertRaises(ValueError):
            execute_agent_actions([{"type": "list_files"}] * 7, search_fn=lambda q: "")


if __name__ == "__main__":
    unittest.main()
