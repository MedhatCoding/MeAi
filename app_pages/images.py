import streamlit as st


def render():
    st.title("🎨 توليد الصور")
    st.write("اكتب وصفًا للصورة، وحدد المقاس والجودة، ثم أنشئ الصورة واحفظها على هاتفك.")
    st.info("اختيار مزوّد الصور من Secrets عبر IMAGE_PROVIDER. الوضع auto يجرّب Cloudflare أولًا ثم OpenAI عند إعداد كليهما. حصة Cloudflare محدودة، وOpenAI مدفوع؛ لن يُستدعَ أي مزوّد إلا عند الضغط على إنشاء.")
    with st.form("image_generation_form"):
        image_prompt = st.text_area(
            "وصف الصورة",
            placeholder="مثال: غلاف احترافي لتطبيق Medhat AI، تصميم عربي حديث، ألوان كحلية ولمسات تركواز، بدون نصوص مشوهة...",
            height=140,
            max_chars=8000,
        )
        c1, c2 = st.columns(2)
        with c1:
            image_size = st.selectbox("المقاس", ["1024x1024", "1536x1024", "1024x1536"], format_func=lambda x: {"1024x1024":"مربع", "1536x1024":"أفقي", "1024x1536":"رأسي"}[x])
        with c2:
            image_quality = st.selectbox("الجودة (التكلفة والوقت)", ["low", "medium", "high"], index=0, format_func=lambda x: {"low":"اقتصادية", "medium":"متوسطة", "high":"عالية"}[x])
        make_image = st.form_submit_button("إنشاء الصورة", type="primary", use_container_width=True)
    if make_image:
        if not image_prompt.strip():
            st.warning("اكتب وصف الصورة أولًا.")
        else:
            try:
                from image_tools import generate_image
                with st.spinner("جاري إنشاء الصورة؛ قد يستغرق ذلك حتى دقيقتين..."):
                    image_bytes, image_model = generate_image(image_prompt, size=image_size, quality=image_quality)
                st.session_state["last_generated_image"] = image_bytes
                st.session_state["last_generated_image_model"] = image_model
                st.success(f"تم إنشاء الصورة باستخدام {image_model}.")
            except Exception as exc:
                st.error(f"تعذر إنشاء الصورة: {type(exc).__name__}: {str(exc)[:350]}")
    if st.session_state.get("last_generated_image"):
        st.image(st.session_state["last_generated_image"], caption="الصورة التي تم إنشاؤها")
        st.download_button(
            "⬇️ تنزيل الصورة PNG",
            data=st.session_state["last_generated_image"],
            file_name="medhat-ai-generated.png",
            mime="image/png",
            use_container_width=True,
        )
