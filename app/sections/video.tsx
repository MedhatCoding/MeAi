"use client";

import type { Dispatch, SetStateAction } from "react";
import { Video } from "lucide-react";

interface VideoSectionProps {
  setNotice: Dispatch<SetStateAction<string>>;
}

export default function VideoSection({
  setNotice,
}: VideoSectionProps) {
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon orange"><Video size={22}/></div><div><div className="eyebrow">حرّك خيالك</div><h1>توليد الفيديو</h1><p>جهّز وصف المشهد وراجع حالة التوليد والنتيجة.</p></div></div><div className="creative-layout"><div className="form-card"><label>وصف الفيديو</label><textarea placeholder="اشرح المشهد وحركة الكاميرا والإضاءة ومدة الفيديو..."/><label>المدة</label><div className="choice-row"><button className="choice selected">5 ثوانٍ</button><button className="choice">10 ثوانٍ</button><button className="choice">15 ثانية</button></div><label>اتجاه الفيديو</label><div className="choice-row"><button className="choice">أفقي</button><button className="choice selected">عمودي</button><button className="choice">مربع</button></div><button className="primary-btn full-btn" onClick={()=>setNotice("واجهة الفيديو جاهزة؛ يلزم ربطها بخدمة الفيديو الحالية والتحقق من رصيد المزوّد.")}><Video size={16}/> بدء التوليد</button></div><div className="preview-placeholder video-preview"><div className="preview-glow"><Video size={36}/></div><b>معاينة الفيديو</b><p>حالة المهمة ونتيجة التوليد ستظهر هنا بعد التكامل.</p></div></div></div>
  );
}
