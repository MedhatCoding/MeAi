import json
import unittest
from unittest import mock

import web_search


class FakeStreamResponse:
    def __init__(self, status_code=200, chunks=None):
        self.status_code = status_code
        self._chunks = chunks if chunks is not None else [b""]

    def iter_content(self, chunk_size=None):
        return iter(self._chunks)


class FetchPageTextTests(unittest.TestCase):
    def test_strips_markup_and_collapses_whitespace(self):
        html_body = (
            "<html><head><title>T</title></head><body>"
            "<script>alert('x')</script><style>.a{}</style>"
            "<!-- comment --><noscript>ns</noscript>"
            "<p>Hello&nbsp;world &amp; more</p></body></html>"
        )
        with mock.patch.object(web_search.requests, "get", return_value=FakeStreamResponse(chunks=[html_body.encode("utf-8")])) as fake_get:
            text = web_search._fetch_page_text("https://example.com/article")
        fake_get.assert_called_once()
        self.assertEqual(text, "Hello world & more")

    def test_returns_none_on_http_error(self):
        with mock.patch.object(web_search.requests, "get", return_value=FakeStreamResponse(status_code=403)):
            self.assertIsNone(web_search._fetch_page_text("https://example.com/a"))

    def test_returns_none_on_network_failure(self):
        with mock.patch.object(web_search.requests, "get", side_effect=OSError("boom")):
            self.assertIsNone(web_search._fetch_page_text("https://example.com/a"))

    def test_respects_size_cap(self):
        chunks = [b"a" * 65536] * 40
        with mock.patch.object(web_search.requests, "get", return_value=FakeStreamResponse(chunks=chunks)):
            text = web_search._fetch_page_text("https://example.com/a")
        self.assertLessEqual(len(text), web_search.PAGE_FETCH_LIMIT_BYTES)

    def test_search_web_no_longer_uses_missing_ddgs_extract(self):
        import inspect

        source = inspect.getsource(web_search.search_web)
        self.assertNotIn(".extract(", source)
        self.assertIn("_fetch_page_text", source)


class FormatSearchResultsTests(unittest.TestCase):
    def test_formats_results_with_source_links(self):
        payload = {
            "query": "أخبار التقنية",
            "news_intent": False,
            "results": [
                {
                    "title": "خبر تقنية",
                    "url": "https://example.com/news/tech",
                    "snippet": "مقتطف",
                    "date": "",
                    "source": "example.com",
                }
            ],
            "pages_read": 0,
            "independent_domains_read": 0,
        }
        context = "SEARCH_STATUS=OK\nSEARCH_JSON=" + json.dumps(payload, ensure_ascii=False)
        output = web_search.format_search_results(context)
        self.assertIn("## نتائج البحث", output)
        self.assertIn("https://example.com/news/tech", output)
        self.assertIn("خبر تقنية", output)

    def test_rejects_malformed_context(self):
        output = web_search.format_search_results("ليس سياق بحث صالحًا")
        self.assertIn("تعذر تنسيق", output)


if __name__ == "__main__":
    unittest.main()
