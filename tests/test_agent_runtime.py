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
        self.assertIn("إنشاء الملفات غير مصرح به", results[0]["message"])

    @patch("agent_runtime.run_code_in_sandbox")
    def test_code_execution_runs_without_file_write_permission(self, run_code):
        run_code.return_value = {
            "language": "python",
            "output": "2",
            "has_error": False,
        }
        results = execute_agent_actions(
            [{"type": "run_code", "language": "python", "code": "print(1 + 1)"}],
            search_fn=lambda q: "",
            e2b_api_key="test-key",
            allow_writes=False,
        )
        self.assertEqual(results[0]["status"], "تم")
        self.assertIn('"output": "2"', results[0]["message"])
        run_code.assert_called_once_with(
            "print(1 + 1)", api_key="test-key", language="python"
        )

    def test_code_execution_requires_e2b_key(self):
        from agent_runtime import run_code_in_sandbox
        with self.assertRaisesRegex(RuntimeError, "E2B_API_KEY"):
            run_code_in_sandbox("print(1)", api_key="")

    def test_code_execution_rejects_unsupported_language(self):
        from agent_runtime import run_code_in_sandbox
        with self.assertRaisesRegex(ValueError, "Python فقط"):
            run_code_in_sandbox("console.log(1)", api_key="test-key", language="javascript")

    def test_action_count_is_bounded(self):
        with self.assertRaises(ValueError):
            execute_agent_actions([{"type": "list_files"}] * 7, search_fn=lambda q: "")


if __name__ == "__main__":
    unittest.main()
