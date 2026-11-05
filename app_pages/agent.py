import os
import json
from datetime import datetime

import streamlit as st

from agent_json import parse_agent_json_response
from agent_runtime import execute_agent_actions
from agent_tools import initialize_workspace
from ai_providers import call_model
from app_settings import APP_DIR
from web_search import search_web


def render():
    st.title("🤖 الوكيل التنفيذي")
    try:
        workspace_status = initialize_workspace(APP_DIR)
        if workspace_status.get("seeded", 0):
            st.info(f"تم تجهيز مساحة العمل تلقائيًا بـ {workspace_status['seeded']} ملفًا آمنًا من المشروع لفحصها.")
        elif workspace_status.get("existing", 0):
            st.caption(f"مساحة العمل تحتوي على {workspace_status['existing']} ملفًا.")
        else:
            st.warning("لم يتم العثور على ملفات نصية مسموحة لتهيئة مساحة العمل.")
    except Exception as workspace_exc:
        st.warning(f"تعذر تهيئة ملفات المشروع: {type(workspace_exc).__name__}: {workspace_exc}")
    st.write("الوكيل يشغّل كود Python تلقائيًا داخل بيئة E2B سحابية مؤقتة، ويعرض المخرجات والأخطاء.")
    st.info("تشغيل الكود لا يحتاج موافقة لكل مرة. إنشاء ملفات مساحة العمل يظل اختياريًا وبموافقتك، ولا تُعدّل ملفات GitHub تلقائيًا.")
    try:
        e2b_api_key = str(st.secrets.get("E2B_API_KEY", os.getenv("E2B_API_KEY", ""))).strip()
    except Exception:
        e2b_api_key = os.getenv("E2B_API_KEY", "").strip()
    if e2b_api_key:
        st.success("مفتاح E2B موجود في إعدادات Streamlit.")
    else:
        st.warning("أضف E2B_API_KEY إلى Streamlit Secrets لتفعيل تشغيل الكود.")
    if "agent_runs" not in st.session_state:
        st.session_state.agent_runs = []
    with st.form("agent_execute_form"):
        agent_goal = st.text_area("المهمة المطلوب تنفيذها", placeholder="مثال: أنشئ أداة Python تنظف ملف CSV وتتحقق من الأعمدة، مع اختبارات وREADME.", height=120)
        agent_mode = st.selectbox("نطاق التنفيذ", ["تنفيذ وتشغيل الكود تلقائيًا", "خطة فقط"], index=0)
        agent_confirm = st.checkbox("أسمح أيضًا بإنشاء ملفات داخل مساحة العمل المؤقتة (اختياري)", value=False, disabled=(agent_mode == "خطة فقط"))
        run_agent = st.form_submit_button("تشغيل الوكيل", type="primary", use_container_width=True)
    if run_agent:
        if not agent_goal.strip():
            st.warning("اكتب المهمة أولًا.")
        else:
            with st.spinner("الوكيل ينفذ المهمة ويشغّل الكود في بيئة معزولة..."):
                try:
                    tool_policy = """أنت وكيل تنفيذي. أخرج JSON صالحًا فقط:
{"summary":"ملخص المهمة","actions":[{"type":"run_code","language":"python","code":"print(1+1)"}],"checks":["معيار تحقق"]}
الأدوات: search_web(query)، list_files، read_file(path)، validate_file(path)، run_code(language,code)، write_file(path,content).
في وضع التنفيذ شغّل كود Python المطلوب واختبره تلقائيًا عبر run_code دون طلب موافقة منفصلة. التشغيل يتم في E2B Sandbox مؤقتة وليس على خادم التطبيق. لا تضع أسرارًا أو مفاتيح داخل الكود. إنشاء الملفات مسموح فقط إذا كان خيار المستخدم مفعّلًا؛ وإلا لا تستخدم write_file. لا تنفذ إجراءات خارجية أو نشرًا أو إرسالًا أو شراءً. ضع من 1 إلى 6 إجراءات ولا تدّع تنفيذ شيء لم يحدث. في وضع التخطيط فقط لا تنفذ الأدوات."""
                    response = call_model([
                        {"role":"system","content":tool_policy},
                        {"role":"user","content":"المهمة: "+agent_goal.strip()+"\nوضع التنفيذ: "+agent_mode+"\nأخرج JSON فقط."}
                    ])
                    try:
                        payload = parse_agent_json_response(response)
                    except ValueError:
                        # Retry once with a short, schema-constrained repair request.
                        repaired_response = call_model([
                            {"role": "system", "content": 'Return one valid JSON object only, with exactly these top-level keys: "summary" (string), "actions" (array), "checks" (array). Convert the supplied text into valid JSON. Do not add actions or invent details. No Markdown fences or prose.'},
                            {"role": "user", "content": "Normalize this model response into valid JSON, preserving its meaning:\n" + str(response)[:10000]},
                        ])
                        payload = parse_agent_json_response(repaired_response)
                    if not isinstance(payload, dict):
                        raise ValueError("خطة الوكيل يجب أن تكون كائنًا.")
                    actions = payload.get("actions", [])
                    if not isinstance(actions, list):
                        raise ValueError("خطة الوكيل غير صالحة: يجب أن تكون الإجراءات قائمة.")
                    # Some models ignore the requested limit. Keep the first six ordered
                    # actions rather than failing the entire agent cycle.
                    if len(actions) > 6:
                        actions = actions[:6]
                        payload["actions"] = actions
                        note = "تم تقليص الخطة تلقائيًا إلى أول ستة إجراءات مسموحة."
                        payload["checks"] = payload.get("checks", [])
                        if not isinstance(payload["checks"], list):
                            payload["checks"] = []
                        payload["checks"].append(note)

                    # Execution mode must contain a real sandbox action. If the model
                    # returns only a narrative/plan, request an executable Python action.
                    if agent_mode != "خطة فقط" and not any(
                        isinstance(item, dict) and item.get("type") == "run_code"
                        for item in actions
                    ):
                        code_response = call_model([
                            {"role": "system", "content": 'حوّل طلب المستخدم إلى كود Python قابل للتنفيذ. أخرج JSON فقط بهذا الشكل: {"summary":"...","actions":[{"type":"run_code","language":"python","code":"..."}],"checks":["..."]}. يجب أن يحتوي actions على إجراء run_code واحد على الأقل. لا تدّع التنفيذ؛ المطلوب كتابة الكود فقط ليشغله التطبيق.'},
                            {"role": "user", "content": agent_goal.strip()},
                        ])
                        code_payload = parse_agent_json_response(code_response)
                        code_actions = code_payload.get("actions", []) if isinstance(code_payload, dict) else []
                        if not isinstance(code_actions, list) or not any(
                            isinstance(item, dict) and item.get("type") == "run_code"
                            for item in code_actions
                        ):
                            raise ValueError("لم يُنشئ النموذج إجراء تشغيل Python؛ لم يتم الادعاء بتنفيذ المهمة.")
                        actions = (actions + code_actions)[:6]
                        payload["actions"] = actions

                    log = []
                    if agent_mode == "خطة فقط":
                        log.append("وضع التخطيط فقط: لم تُنفذ أي أداة أو تُكتب ملفات.")
                    else:
                        results = execute_agent_actions(
                            actions,
                            search_fn=search_web,
                            allow_writes=bool(agent_confirm),
                            e2b_api_key=e2b_api_key,
                            max_actions=6,
                        )
                        for item in results:
                            log.append(f"{item['action']}: {item['status']} — {item['message']}")
                        # Build the status from tool results, never from a model's claim.
                        code_results = [
                            item for item in results
                            if item.get("action", "").endswith("run_code")
                        ]
                        if code_results and all(item.get("status") == "تم" for item in code_results):
                            payload["summary"] = "اكتمل تشغيل الكود داخل E2B. راجع المخرجات الفعلية أدناه."
                        elif code_results:
                            payload["summary"] = "فشل تشغيل الكود أو لم يكتمل. راجع رسالة الخطأ الفعلية أدناه."
                        else:
                            payload["summary"] = "لم يتم تشغيل أي كود؛ لا يمكن اعتبار المهمة منفذة."
                        for item in results:
                            if item.get("action", "").endswith("run_code"):
                                log.append("مخرجات التنفيذ الفعلية: " + item.get("message", ""))
                    captured_runs = []
                    if agent_mode != "خطة فقط":
                        for result in results:
                            if result.get("action", "").endswith("run_code"):
                                item = {
                                    "status": result.get("status", "غير معروف"),
                                    "raw": result.get("message", ""),
                                    "output": "",
                                    "has_error": result.get("status") != "تم",
                                }
                                try:
                                    decoded = json.loads(item["raw"])
                                    if isinstance(decoded, dict):
                                        item["output"] = str(decoded.get("output", ""))
                                        item["has_error"] = bool(decoded.get("has_error", item["has_error"]))
                                except Exception:
                                    item["output"] = item["raw"]
                                captured_runs.append(item)
                    st.session_state.agent_runs.insert(0, {
                        "goal":agent_goal.strip(),"summary":str(payload.get("summary","")),
                        "actions":actions if agent_mode != "خطة فقط" else [],
                        "checks":payload.get("checks",[]),"log":log,
                        "execution_results": captured_runs,
                        "time":datetime.now().isoformat(timespec="minutes")
                    })
                    st.success("انتهت دورة الوكيل. راجع سجل الأدوات والنتائج الفعلية والملفات الناتجة.")
                except Exception as exc:
                    st.error(f"تعذر إكمال دورة الوكيل: {type(exc).__name__}: {str(exc)[:240]}")
    for idx, run in enumerate(st.session_state.agent_runs[:5]):
        with st.container(border=True):
            st.subheader(run.get("summary") or run.get("goal","مهمة"))
            st.caption(run.get("time",""))
            st.write(run.get("goal",""))
            if run.get("checks"):
                st.markdown("**معايير التحقق**")
                for item in run["checks"]:
                    st.write("• "+str(item))
            for item in run.get("log",[]):
                st.info(item)
            for execution_idx, result in enumerate(run.get("execution_results", []), start=1):
                st.markdown(f"**نتيجة تشغيل Python الفعلية #{execution_idx}**")
                if result.get("has_error") or result.get("status") != "تم":
                    st.error("حالة التشغيل: فشل")
                else:
                    st.success("حالة أداة التشغيل: اكتملت دون خطأ مُبلغ عنه")
                st.code(result.get("output") or result.get("raw") or "لم ترجع الأداة مخرجات.", language="text")
            for action in run.get("actions",[]):
                if action.get("type") == "write_file":
                    st.caption("ملف: "+str(action.get("path","")))
                    if action.get("content"):
                        st.download_button("تنزيل "+str(action.get("path","ملف")), data=str(action["content"]).encode("utf-8"), file_name=str(action["path"]).split("/")[-1], mime="text/plain", key=f"agent_download_{idx}_{action.get('path')}")
    if st.button("مسح سجل الوكيل"):
        st.session_state.agent_runs = []
        st.rerun()
