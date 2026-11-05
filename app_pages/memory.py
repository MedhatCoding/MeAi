from datetime import datetime

import streamlit as st

from app_settings import cloud_memory_enabled
from memory_store import delete_memory, memories, save_memory


def render():
    st.title("🧠 الذاكرة")
    st.write("أضف معلومات تريد أن يسترجعها المساعد. لا تحفظ مفاتيح أو كلمات مرور.")
    try:
        memory_rows = memories()
    except Exception as exc:
        memory_rows = []
        st.error(f"تعذر تحميل عناصر الذاكرة: {type(exc).__name__}: {str(exc)[:160]}")
    if memory_rows:
        memory_export = "\\n\\n".join(
            f"## {row[1]}\\n\\n{row[2]}\\n\\nتاريخ الإضافة: {row[3]}"
            for row in memory_rows
        )
        st.download_button(
            "⬇️ تنزيل نسخة من الذاكرة",
            data=memory_export.encode("utf-8"),
            file_name=f"medhat-ai-memory-{datetime.now().strftime('%Y%m%d')}.md",
            mime="text/markdown",
            use_container_width=True,
        )
    with st.form("add_memory", clear_on_submit=True):
        category = st.text_input("التصنيف", "مشروع أو تفضيل")
        content = st.text_area("المعلومة")
        submit = st.form_submit_button("حفظ")
    if submit and content.strip():
        save_memory(category, content)
        st.success("تم الحفظ في قاعدة البيانات الدائمة." if cloud_memory_enabled() else "تم الحفظ مؤقتًا. اربط Supabase للاحتفاظ بالبيانات بعد إعادة تشغيل الاستضافة.")
    for row in memories():
        with st.container(border=True):
            st.caption(f"{row[1]} • {row[3][:10]}")
            st.write(row[2])
            if st.button("حذف", key=f"delete_{row[0]}"):
                delete_memory(row[0])
                st.rerun()
