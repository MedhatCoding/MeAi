import unittest

from file_extract import extract_file


class FakeUpload:
    def __init__(self, name, payload):
        self.name = name
        self._payload = payload

    def getvalue(self):
        return self._payload


class ExtractFileTests(unittest.TestCase):
    def test_reads_text_file(self):
        upload = FakeUpload("notes.txt", "محتوى تجريبي".encode("utf-8"))
        self.assertEqual(extract_file(upload), "محتوى تجريبي")

    def test_reads_python_file(self):
        upload = FakeUpload("script.py", b"print('hi')")
        self.assertEqual(extract_file(upload), "print('hi')")

    def test_unknown_binary_type_returns_friendly_message(self):
        upload = FakeUpload("photo.png", b"\x89PNG")
        output = extract_file(upload)
        self.assertIn("لا يحلل الصور", output)

    def test_invalid_pdf_reports_error(self):
        upload = FakeUpload("doc.pdf", b"not a real pdf")
        output = extract_file(upload)
        self.assertIn("تعذر قراءة PDF", output)


if __name__ == "__main__":
    unittest.main()
