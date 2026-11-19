# Medhat AI

تطبيق مساعد ذكاء اصطناعي عام مبني باستخدام Next.js وReact وTypeScript، بواجهة عربية RTL ومصمم للعمل كتطبيق ويب متوافق مع الهاتف (PWA).

## التشغيل محليًا

يتطلب Node.js 20 أو أحدث.

```bash
npm install
npm run dev
```

لإنشاء نسخة الإنتاج والتحقق من البناء:

```bash
npm run build
npm start
```

## النشر على Vercel

1. اربط مستودع GitHub في Vercel.
2. اترك Framework Preset على Next.js وRoot Directory على `./`.
3. أضف متغيرات البيئة المطلوبة من إعدادات المشروع في Vercel.
4. انشر الفرع `main`.

## متغيرات البيئة

أضف المفاتيح المطلوبة من لوحة الاستضافة فقط، ولا تضعها في ملفات الواجهة أو المستودع.

- مزوّدو الذكاء الاصطناعي: يمكن ضبط واحد أو أكثر من `CLOUDFLARE_ACCOUNT_ID` و`CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_MODEL`، أو `GEMINI_API_KEY` و`GEMINI_MODEL`، أو `GROQ_API_KEY` و`GROQ_MODEL`، أو `OPENROUTER_API_KEY` و`OPENROUTER_MODEL`، أو `DEEPSEEK_API_KEY` و`DEEPSEEK_MODEL`، أو `OPENAI_BASE_URL` و`OPENAI_API_KEY` و`OPENAI_MODEL`. القيم الافتراضية: OpenRouter يستخدم `openai/gpt-oss-120b`، وDeepSeek يستخدم `deepseek-chat`؛ يمكن تغييرها من متغيرات البيئة. يختار MeAI المزود المحدد في `MEAI_MODEL_PROVIDER` إن كان مهيأً، ثم يجرب بقية المزودين المهيئين تلقائيًا عند أخطاء الاتصال أو المصادقة أو حدود الاستخدام أو أخطاء الخادم. لا تُشارك المفاتيح في الواجهة أو المستودع.
- فهم الصور مباشرة: يستخدم MeAI نموذج Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct` عند توفر `CLOUDFLARE_ACCOUNT_ID` و`CLOUDFLARE_API_TOKEN`، ويمكن تخصيصه عبر `CLOUDFLARE_VISION_MODEL`. يتطلب أول تشغيل الموافقة على ترخيص Meta وسياسة الاستخدام من لوحة Cloudflare. كبديل يمكن ضبط `GEMINI_API_KEY` مع `GEMINI_VISION_MODEL`. الصور تُضغط في المتصفح ثم تُرسل مشفرة إلى الخادم، ولا يُستخدم نموذج نصي غير داعم للرؤية لتحليلها.
- البحث على الويب: يكفي مزوّد واحد على الأقل. `SERPER_API_KEY` (Google عبر Serper) مدعوم افتراضيًا، ويمكن إضافة `BRAVE_SEARCH_API_KEY` و`TAVILY_API_KEY` لتجميع النتائج من عدة محركات بالتوازي.
- عند ضبط أكثر من مزوّد، يدمج MeAI النتائج ويزيل الروابط المكررة ويصنّف نوع المصدر دون استبعاد منصات أو فئات مواقع لمجرد نوعها. البحث التلقائي مفعّل في المحادثة العادية، ويُستخدم نفس محرك البحث في مساحة البحث والوكيل.
- مفاتيح Brave وTavily اختيارية؛ لا تظهر نتائجها إلا بعد إضافة المفاتيح إلى بيئة الاستضافة وإعادة النشر.
- تخزين الحساب والذاكرة السحابية: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`، وأي أسرار خادمية تطلبها المسارات ذات الصلة.
- تكامل Google وميزات الوكيل لها إعدادات اختيارية موضحة في ملفات المسارات والإعدادات ذات الصلة.

## ملاحظات

- التطبيق الحالي هو نسخة Next.js؛ لم يعد يعتمد على Streamlit أو Python لتشغيل التطبيق.
- وجود متغير بيئة لا يثبت وحده أن التكامل يعمل؛ يجب اختبار الاتصال والميزة فعليًا.
- راجع `docs/NEXTJS_DEPLOYMENT.md` و`docs/SECURITY.md` قبل إعداد النشر أو تغيير الصلاحيات.
