import unittest
from unittest.mock import patch

import video_tools


class VideoToolTests(unittest.TestCase):
    def test_rejects_empty_prompt_before_provider_call(self):
        with self.assertRaises(ValueError):
            video_tools.generate_video("   ")

    def test_requires_token(self):
        with patch.object(video_tools, "_secret", return_value=""):
            with self.assertRaisesRegex(RuntimeError, "HF_TOKEN"):
                video_tools.generate_video("A short test video")


if __name__ == "__main__":
    unittest.main()
