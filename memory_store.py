import re
import sqlite3
from datetime import datetime

from app_settings import DB, cloud_memory_enabled, cloud_memory_request

def db_init():
    # Local fallback remains available until Supabase is configured.
    with sqlite3.connect(DB) as con:
        con.execute("""CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")

def memories():
    if cloud_memory_enabled():
        rows = cloud_memory_request("GET", {"select": "id,category,content,created_at", "order": "id.desc", "limit": "40"})
        return [(r["id"], r["category"], r["content"], str(r["created_at"])) for r in rows]
    with sqlite3.connect(DB) as con:
        return con.execute("SELECT id, category, content, created_at FROM memories ORDER BY id DESC LIMIT 40").fetchall()

def retrieve_memories(query, limit=10):
    """Rank saved memories by simple keyword overlap, with recent items as fallback."""
    rows = memories()
    if not rows:
        return []
    words = set(re.findall(r"[\w]{3,}", query.lower(), flags=re.UNICODE))
    stop = {"الذي", "التي", "على", "إلى", "من", "في", "عن", "مع", "هذا", "هذه", "ذلك", "كيف", "ماذا", "هل", "كان", "كانت", "عايز", "اريد", "ممكن", "please", "what", "when", "where", "how", "the", "and", "for"}
    words -= stop
    scored = []
    for index, row in enumerate(rows):
        text = f"{row[1]} {row[2]}".lower()
        tokens = set(re.findall(r"[\w]{3,}", text, flags=re.UNICODE))
        overlap = len(words & tokens)
        scored.append((overlap, -index, row))
    matched = [item for item in sorted(scored, reverse=True, key=lambda x: (x[0], x[1])) if item[0] > 0]
    if matched:
        return [item[2] for item in matched[:limit]]
    return rows[:min(5, limit)]

def save_memory(category, content):
    if cloud_memory_enabled():
        cloud_memory_request("POST", payload={"category": category[:80], "content": content[:4000]})
        return
    with sqlite3.connect(DB) as con:
        con.execute("INSERT INTO memories(category,content,created_at) VALUES(?,?,?)", (category[:80], content[:4000], datetime.utcnow().isoformat()))

def delete_memory(mid):
    if cloud_memory_enabled():
        cloud_memory_request("DELETE", params={"id": f"eq.{int(mid)}"})
        return
    with sqlite3.connect(DB) as con:
        con.execute("DELETE FROM memories WHERE id=?", (int(mid),))
