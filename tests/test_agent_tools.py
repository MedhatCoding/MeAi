import tempfile
import unittest
from pathlib import Path

import agent_tools


class WorkspaceToolTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_root = agent_tools.WORKSPACE_ROOT
        agent_tools.WORKSPACE_ROOT = Path(self.temp_dir.name).resolve()

    def tearDown(self):
        agent_tools.WORKSPACE_ROOT = self.original_root
        self.temp_dir.cleanup()

    def test_write_read_and_list_file(self):
        agent_tools.write_workspace_file("src/example.py", "value = 1\n")
        self.assertEqual(agent_tools.read_workspace_file("src/example.py"), "value = 1\n")
        self.assertEqual(agent_tools.list_workspace_files()[0]["path"], "src/example.py")

    def test_python_static_validation(self):
        agent_tools.write_workspace_file("valid.py", "def add(a, b):\n    return a + b\n")
        self.assertTrue(agent_tools.validate_workspace_file("valid.py")["ok"])
        agent_tools.write_workspace_file("invalid.py", "def broken(:\n    pass\n")
        self.assertFalse(agent_tools.validate_workspace_file("invalid.py")["ok"])

    def test_json_validation(self):
        agent_tools.write_workspace_file("config.json", '{"enabled": true}')
        self.assertTrue(agent_tools.validate_workspace_file("config.json")["ok"])

    def test_rejects_parent_traversal_and_hidden_paths(self):
        for path in ("../outside.txt", "nested/../../outside.py", ".env", "nested/.hidden.txt"):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    agent_tools.write_workspace_file(path, "not allowed")

    def test_rejects_disallowed_file_extensions(self):
        with self.assertRaisesRegex(ValueError, "امتداد الملف غير مسموح"):
            agent_tools.write_workspace_file("payload.exe", "not executable")

    def test_rejects_symlinked_parent_directory(self):
        outside = Path(self.temp_dir.name).parent / (Path(self.temp_dir.name).name + "_outside")
        outside.mkdir(exist_ok=True)
        link = agent_tools.WORKSPACE_ROOT / "linked"
        try:
            link.symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "مجلدات رمزية"):
                agent_tools.write_workspace_file("linked/file.txt", "blocked")
        finally:
            if link.is_symlink():
                link.unlink()
            try:
                outside.rmdir()
            except OSError:
                pass


class AgentRuntimeTests(unittest.TestCase):
    def test_rejects_plans_over_six_actions(self):
        from agent_runtime import execute_agent_actions

        actions = [{"type": "list_files"}] * 7
        with self.assertRaisesRegex(ValueError, "الحد الأقصى"):
            execute_agent_actions(actions, search_fn=lambda query: "unused")

    def test_write_requires_explicit_permission(self):
        from agent_runtime import execute_agent_actions

        results = execute_agent_actions(
            [{"type": "write_file", "path": "blocked.txt", "content": "no"}],
            search_fn=lambda query: "unused",
            allow_writes=False,
        )
        self.assertEqual(results[0]["status"], "فشل")
        self.assertIn("الكتابة غير مفعّلة", results[0]["message"])

    def test_unknown_tools_are_rejected(self):
        from agent_runtime import execute_agent_actions

        results = execute_agent_actions(
            [{"type": "run_shell", "command": "echo unsafe"}],
            search_fn=lambda query: "unused",
        )
        self.assertEqual(results[0]["status"], "فشل")
        self.assertIn("غير مسموح", results[0]["message"])


if __name__ == "__main__":
    unittest.main()
