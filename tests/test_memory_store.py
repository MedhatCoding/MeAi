import os
import tempfile
import unittest

_TMP_DIR = tempfile.mkdtemp(prefix="meai_memory_test_")
os.environ["MEDHAT_AI_DB_PATH"] = os.path.join(_TMP_DIR, "memory.db")
for _key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"):
    os.environ.pop(_key, None)

import memory_store

# Bind the test DB explicitly; app_settings may already be imported by an earlier test.
memory_store.DB = os.path.join(_TMP_DIR, "memory.db")


class MemoryStoreTests(unittest.TestCase):
    def setUp(self):
        memory_store.db_init()
        with memory_store.sqlite3.connect(memory_store.DB) as con:
            con.execute("DELETE FROM memories")

    def test_save_then_list(self):
        memory_store.save_memory("مشروع", "أستخدم Medhat AI في تطبيق المهام")
        rows = memory_store.memories()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][1], "مشروع")
        self.assertIn("Medhat AI", rows[0][2])

    def test_retrieve_matches_by_keyword_overlap(self):
        memory_store.save_memory("تفضيل", "أفضل الإجابات بالعربية المصرية")
        matched = memory_store.retrieve_memories("اذكر تفضيلات الإجابات بالعربية")
        self.assertTrue(matched, "expected the saved memory to be retrieved")

    def test_retrieve_falls_back_to_recent_items(self):
        memory_store.save_memory("عام", "معلومة عامة بدون كلمات مشتركة")
        matched = memory_store.retrieve_memories("سؤال مختلف تمامًا xyzabc")
        self.assertTrue(matched)

    def test_delete_memory(self):
        memory_store.save_memory("مؤقت", "عنصر يُحذف")
        row_id = memory_store.memories()[0][0]
        memory_store.delete_memory(row_id)
        self.assertEqual(memory_store.memories(), [])


if __name__ == "__main__":
    unittest.main()
