import os

import streamlit as st

from app_settings import secret


def render():
    st.title("🎬 توليد الفيديو")
    st.caption("اختر المسار المناسب: تجربة مجانية عبر مساحة عامة، أو مزوّد API.")
    free_tab, api_tab = st.tabs(["🆓 مجاني بدون API", "⚙️ مزوّد API"])
    with free_tab:
        st.subheader("توليد مجاني عبر Hugging Face Space")
        st.success("هذا المسار لا يستخدم HF Inference Providers ولا يحتاج مفتاح API مدفوعًا. يعتمد على حصة GPU عامة مشتركة؛ قد تنتظر في الطابور أو تصل إلى حد الاستخدام.")
        st.warning("الوصف والصور التي تدخلها في المساحة العامة تُرسل إلى Hugging Face ومساحة النموذج. لا ترفع صورًا خاصة أو مواد سرية.")
        st.markdown("**طريقة الاستخدام:** اكتب وصف الفيديو داخل الأداة أدناه، ويمكنك اختيار صورة بداية إن كانت متاحة، ثم اضغط Generate وانتظر النتيجة لتنزيلها.")
        try:
            import streamlit.components.v1 as components
            components.iframe("https://arpitkgoyal-ltx-2-5-demo.static.hf.space/index.html", height=900, scrolling=True)
        except Exception:
            st.link_button("فتح مولّد الفيديو المجاني", "https://arpitkgoyal-ltx-2-5-demo.static.hf.space/index.html", use_container_width=True)
        st.link_button("فتح المولّد في صفحة مستقلة", "https://arpitkgoyal-ltx-2-5-demo.static.hf.space/index.html", use_container_width=True)
        st.caption("إذا ظهرت رسالة quota exceeded أو no GPU available، فهذه حدود الخدمة العامة وليست مشكلة في التطبيق. جرّب لاحقًا.")
    with api_tab:
        st.write("هذا المسار يستخدم Hugging Face Inference Providers وقد يستهلك رصيدًا مدفوعًا.")
        st.info("لن يُرسل الطلب إلا عند الضغط على زر الإنشاء. لتجنب الدفع غير المقصود، جرّب المسار المجاني أولًا.")
        st.markdown("إذا لم تضف المفتاح إلى Secrets، يمكنك إدخاله مؤقتًا هنا. لا تحفظه في المستودع ولا ترسله في المحادثات.")
        with st.form("video_generation_form"):
            video_prompt = st.text_area("وصف المشهد", placeholder="مشهد سينمائي واقعي لشوارع القاهرة وقت الغروب، حركة كاميرا بطيئة، إضاءة ذهبية، تفاصيل واضحة...", height=130, max_chars=1800)
            video_model = st.text_input("معرّف النموذج", value=secret("HF_VIDEO_MODEL", "Wan-AI/Wan2.2-TI2V-5B"))
            video_negative = st.text_input("عناصر يجب تجنبها (اختياري)", value="low quality, flicker, distorted objects")
            video_token_input = st.text_input("HF Token (اختياري إذا لم تضفه إلى Secrets)", type="password", help="يلزم رمز Hugging Face بصلاحية Make calls to Inference Providers. يُستخدم لهذا الطلب فقط ولا يُحفظ في قاعدة البيانات.")
            generate_video = st.form_submit_button("إنشاء الفيديو عبر API", type="primary", use_container_width=True)
        if generate_video:
            if not video_prompt.strip():
                st.warning("اكتب وصف الفيديو أولًا.")
            else:
                try:
                    from video_tools import generate_video as make_video
                    with st.spinner("جاري إرسال الطلب إلى مزوّد الفيديو؛ قد يستغرق عدة دقائق..."):
                        import inspect
                        supplied_token = video_token_input.strip()
                        if "api_key" in inspect.signature(make_video).parameters:
                            video_bytes, provider_label = make_video(
                                video_prompt.strip(), model=video_model.strip(),
                                negative_prompt=video_negative.strip(), api_key=supplied_token or None
                            )
                        elif supplied_token:
                            old_token = os.environ.get("HF_TOKEN")
                            os.environ["HF_TOKEN"] = supplied_token
                            try:
                                video_bytes, provider_label = make_video(
                                    video_prompt.strip(), model=video_model.strip(),
                                    negative_prompt=video_negative.strip()
                                )
                            finally:
                                if old_token is None:
                                    os.environ.pop("HF_TOKEN", None)
                                else:
                                    os.environ["HF_TOKEN"] = old_token
                        else:
                            video_bytes, provider_label = make_video(
                                video_prompt.strip(), model=video_model.strip(),
                                negative_prompt=video_negative.strip()
                            )
                    st.session_state["last_generated_video"] = video_bytes
                    st.session_state["last_generated_video_model"] = provider_label
                    st.success("تم إنشاء الفيديو بنجاح عبر "+provider_label)
                except Exception as exc:
                    st.error(f"تعذر إنشاء الفيديو: {type(exc).__name__}: {str(exc)[:350]}")
        if st.session_state.get("last_generated_video"):
            st.video(st.session_state["last_generated_video"])
            st.download_button("⬇️ تنزيل الفيديو MP4", data=st.session_state["last_generated_video"], file_name="medhat-ai-generated.mp4", mime="video/mp4", use_container_width=True)
