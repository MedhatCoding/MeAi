import unittest
from unittest import mock

import ai_providers


class FakeResponse:
    def __init__(self, status_code=200, data=None, text=""):
        self.status_code = status_code
        self._data = data if data is not None else {}
        self.text = text

    def json(self):
        return self._data


def provider(name="TestProvider", kind="openai"):
    return {
        "name": name,
        "kind": kind,
        "url": "https://example.com/v1/chat/completions",
        "key": "test-key",
        "model": "test-model",
        "headers": {},
    }


class CallModelTests(unittest.TestCase):
    def test_raises_without_configured_providers(self):
        with mock.patch.object(ai_providers, "_provider_configs", return_value=[]):
            with self.assertRaisesRegex(RuntimeError, "لا يوجد مزوّد"):
                ai_providers.call_model([{"role": "user", "content": "hi"}])

    def test_returns_answer_and_records_provider(self):
        response = FakeResponse(data={"choices": [{"message": {"content": "أهلاً"}}]})
        with mock.patch.object(ai_providers, "_provider_configs", return_value=[provider()]):
            with mock.patch.object(ai_providers.requests, "post", return_value=response) as fake_post:
                with mock.patch.object(ai_providers, "st") as fake_st:
                    answer = ai_providers.call_model([{"role": "user", "content": "hi"}])
        self.assertEqual(answer, "أهلاً")
        fake_post.assert_called_once()
        fake_st.session_state.__setitem__.assert_called_once_with("last_ai_provider", "TestProvider")

    def test_http_error_falls_over_to_next_provider(self):
        failing = FakeResponse(status_code=500, text="server error")
        working = FakeResponse(data={"choices": [{"message": {"content": "من المزوّد الثاني"}}]})
        with mock.patch.object(ai_providers, "_provider_configs", return_value=[provider("First"), provider("Second")]):
            with mock.patch.object(ai_providers.requests, "post", side_effect=[failing, working]) as fake_post:
                with mock.patch.object(ai_providers, "st"):
                    answer = ai_providers.call_model([{"role": "user", "content": "hi"}])
        self.assertEqual(answer, "من المزوّد الثاني")
        self.assertEqual(fake_post.call_count, 2)

    def test_all_providers_failing_raises_with_details(self):
        bad = FakeResponse(status_code=503, text="unavailable")
        with mock.patch.object(ai_providers, "_provider_configs", return_value=[provider()]):
            with mock.patch.object(ai_providers.requests, "post", return_value=bad):
                with self.assertRaisesRegex(RuntimeError, "فشل كل مزوّدي"):
                    ai_providers.call_model([{"role": "user", "content": "hi"}])


if __name__ == "__main__":
    unittest.main()
