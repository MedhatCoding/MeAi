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

- Cloudflare Workers AI: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_MODEL`.
- البحث على الويب: `SERPER_API_KEY`.
- تخزين الحساب والذاكرة السحابية: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`، وأي أسرار خادمية تطلبها المسارات ذات الصلة.
- تكامل Google وميزات الوكيل لها إعدادات اختيارية موضحة في ملفات المسارات والإعدادات ذات الصلة.

## ملاحظات

- التطبيق الحالي هو نسخة Next.js؛ لم يعد يعتمد على Streamlit أو Python لتشغيل التطبيق.
- وجود متغير بيئة لا يثبت وحده أن التكامل يعمل؛ يجب اختبار الاتصال والميزة فعليًا.
- راجع `docs/NEXTJS_DEPLOYMENT.md` و`docs/SECURITY.md` قبل إعداد النشر أو تغيير الصلاحيات.
