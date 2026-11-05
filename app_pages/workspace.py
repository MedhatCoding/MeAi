import re

import streamlit as st

from agent_tools import list_workspace_files, read_workspace_file, validate_workspace_file, write_workspace_file
from ai_providers import call_model


def render():
    st.title("🛠️ مساحة عمل البرمجة")
    st.write("أنشئ ملفات المشروع وراجعها واحفظها داخل مساحة معزولة عن ملفات التطبيق.")
    st.warning("الأمان: هذه النسخة لا تشغّل الكود الذي تنشئه. تفحص صياغة Python وJSON فقط؛ تشغيل الكود يحتاج حاوية معزولة منفصلة.")
    if "workspace_pending_code" not in st.session_state:
        st.session_state.workspace_pending_code = ""
    if "workspace_pending_path" not in st.session_state:
        st.session_state.workspace_pending_path = "main.py"
    with st.form("workspace_generate_form"):
        requested_path = st.text_input(
            "مسار الملف النسبي",
            value=st.session_state.workspace_pending_path,
            help="أمثلة: main.py أو src/utils.py أو README.md. الامتدادات المخفية والمسارات خارج مساحة العمل مرفوضة.",
        )
        code_request = st.text_area(
            "ماذا تريد أن يحتوي الملف؟",
            placeholder="مثال: أنشئ دالة تقرأ CSV وتتحقق من الأعمدة، مع معالجة أخطاء واضحة.",
            height=120,
        )
        generate_file = st.form_submit_button("توليد مسودة الملف", type="primary", use_container_width=True)
    if generate_file:
        if not requested_path.strip() or not code_request.strip():
            st.warning("اكتب مسار الملف ووصف المطلوب.")
        else:
            file_prompt = f"""اكتب محتوى ملف برمجي كاملًا بناءً على الطلب التالي.
المسار: {requested_path.strip()}
الطلب: {code_request.strip()}
أعد محتوى الملف فقط، بلا Markdown fences أو شرح خارجي. لا تضع أسرارًا أو مفاتيح API حقيقية. أضف معالجة أخطاء وتعليقات مفيدة حيث يلزم. إذا كان المطلوب غير آمن أو غير محدد، اكتب تعليقًا داخل الملف يوضح الافتراضات الآمنة."""
            with st.spinner("جاري توليد مسودة الملف..."):
                try:
                    draft = call_model([
                        {"role": "system", "content": "أنت مهندس برمجيات. أخرج محتوى الملف المطلوب فقط. لا تدّع تشغيله أو اختباره. لا تضمّن أسرارًا أو أوامر لتسريب البيانات."},
                        {"role": "user", "content": file_prompt},
                    ])
                    # Remove a surrounding Markdown fence if the model adds one.
                    draft = re.sub(r"^\s*```[\w+-]*\s*\n", "", draft)
                    draft = re.sub(r"\n```\s*$", "", draft)
                    st.session_state.workspace_pending_code = draft
                    st.session_state.workspace_pending_path = requested_path.strip()
                    st.rerun()
                except Exception as exc:
                    st.error(f"تعذر توليد المسودة: {type(exc).__name__}: {str(exc)[:220]}")
    if st.session_state.workspace_pending_code:
        st.divider()
        st.subheader("مراجعة المسودة قبل الحفظ")
        st.caption(f"المسار المقترح: {st.session_state.workspace_pending_path}")
        edited_draft = st.text_area(
            "محتوى الملف (يمكنك تعديله قبل الحفظ)",
            value=st.session_state.workspace_pending_code,
            height=320,
            key="workspace_draft_editor",
        )
        st.session_state.workspace_pending_code = edited_draft
        save_col, discard_col = st.columns(2)
        with save_col:
            if st.button("حفظ الملف في مساحة العمل", type="primary", use_container_width=True):
                try:
                    saved_path = write_workspace_file(st.session_state.workspace_pending_path, edited_draft)
                    st.success(f"تم حفظ الملف: {saved_path.relative_to(saved_path.parents[0]) if False else st.session_state.workspace_pending_path}")
                    st.session_state.workspace_pending_code = ""
                    st.rerun()
                except Exception as exc:
                    st.error(f"تعذر حفظ الملف: {type(exc).__name__}: {str(exc)[:180]}")
        with discard_col:
            if st.button("إلغاء المسودة", use_container_width=True):
                st.session_state.workspace_pending_code = ""
                st.rerun()
        st.download_button(
            "تنزيل المسودة دون حفظها",
            data=edited_draft.encode("utf-8"),
            file_name=st.session_state.workspace_pending_path.split("/")[-1] or "generated.txt",
            mime="text/plain",
            use_container_width=True,
        )
    st.divider()
    st.subheader("ملفات مساحة العمل")
    try:
        workspace_files = list_workspace_files()
    except Exception as exc:
        workspace_files = []
        st.error(f"تعذر عرض الملفات: {type(exc).__name__}: {str(exc)[:160]}")
    if not workspace_files:
        st.caption("لا توجد ملفات محفوظة حتى الآن.")
    else:
        for item in workspace_files:
            with st.container(border=True):
                st.write(f"**{item['path']}** · {item['size']} بايت")
                c1, c2 = st.columns(2)
                with c1:
                    if st.button("فحص الملف", key=f"validate_{item['path']}", use_container_width=True):
                        result = validate_workspace_file(item["path"])
                        if result["ok"] is True:
                            st.success(result["message"])
                        elif result["ok"] is False:
                            st.error(result["message"])
                        else:
                            st.info(result["message"])
                with c2:
                    try:
                        file_bytes = read_workspace_file(item["path"]).encode("utf-8")
                        st.download_button(
                            "تنزيل",
                            data=file_bytes,
                            file_name=item["path"].split("/")[-1],
                            mime="text/plain",
                            key=f"download_{item['path']}",
                            use_container_width=True,
                        )
                    except Exception as exc:
                        st.caption(f"تعذر قراءة الملف: {type(exc).__name__}")
    st.caption("مساحة العمل مؤقتة على الاستضافة وقد تُمسح عند إعادة تشغيل البيئة؛ نزّل الملفات المهمة أو اربطها لاحقًا بمستودع GitHub.")
