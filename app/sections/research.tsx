"use client";

import type { Dispatch, SetStateAction } from "react";
import { Activity, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { ResearchResult, Section } from "../lib/shared";

interface ResearchSectionProps {
  researchQuery: string;
  setResearchQuery: Dispatch<SetStateAction<string>>;
  researchBusy: boolean;
  researchData: ResearchResult[];
  busy: boolean;
  setSection: (id: Section) => void;
  sendMessage: (value?: string) => void | Promise<void>;
  runResearch: () => Promise<void>;
}

export default function ResearchSection({
  researchQuery,
  setResearchQuery,
  researchBusy,
  researchData,
  busy,
  setSection,
  sendMessage,
  runResearch,
}: ResearchSectionProps) {
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon blue"><Search size={22}/></div><div><div className="eyebrow">بحث عام عبر الويب</div><h1>ابحث في أي موضوع</h1><p>اعثر على صفحات ومراجع أولية، وافتح المصدر لمراجعة التفاصيل بنفسك.</p></div></div><form className="research-search" onSubmit={e=>{e.preventDefault();void runResearch();}}><input value={researchQuery} onChange={e=>setResearchQuery(e.target.value)} maxLength={300} minLength={2} placeholder="اكتب موضوع البحث أو سؤالًا..." aria-label="عبارة البحث"/><button className="primary-btn" type="submit" disabled={researchBusy||researchQuery.trim().length<2}>{researchBusy?<Activity size={16} className="spin"/>:<Search size={16}/>} {researchBusy?"جاري البحث":"ابحث"}</button></form><div className="research-note"><ShieldCheck size={16}/><span>النتائج مختصرات من محرك البحث وليست تحققًا مستقلًا. راجع المصدر وتاريخ النشر قبل الاعتماد عليها.</span></div>{researchData.length>0&&<div className="research-actions"><span className="pill">{researchData.length} نتائج</span><button className="primary-btn" type="button" disabled={busy} onClick={()=>{const evidence=researchData.map((r,i)=>`${i+1}. ${r.title}
${r.date?`التاريخ: ${r.date}
`:""}${r.snippet}
المصدر: ${r.url}`).join("\n\n");setSection("chat");void sendMessage(`حلّل نتائج البحث التالية للإجابة عن سؤالي: ${researchQuery}

اكتب خلاصة واضحة، أهم النقاط، ما يتفق وما يختلف بين المصادر، وما لا يمكن الجزم به. اربط كل معلومة بمصدرها ورابطها، وميّز بين تاريخ النشر وتاريخ الحدث. لا تضف حقائق غير مدعومة بالمقتطفات، واذكر أن التحليل أولي لأن المحتوى الكامل للصفحات لم يُقرأ.

${evidence}`);}}> <Sparkles size={16}/> حلّل النتائج بالمساعد</button></div>}<div className="research-results">{researchData.map((r,i)=><article className="list-card research-card" key={r.url+i}><div className="list-header"><span className="pill">نتيجة {r.position??i+1}</span>{r.date&&<small>{r.date}</small>}</div><h3><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a></h3><p>{r.snippet||"لا يوجد وصف متاح."}</p><a className="research-source" href={r.url} target="_blank" rel="noopener noreferrer">{(()=>{try{return new URL(r.url).hostname}catch{return r.url}})()} ↗</a></article>)}</div>{researchData.length===0&&!researchBusy&&<div className="empty-inline">ابدأ بكتابة موضوع للبحث. البحث متاح لأي مجال، وليس مجالًا واحدًا.</div>}</div>
  );
}
