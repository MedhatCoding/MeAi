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


if __name__ == "__main__":
    unittest.main()
