"use client";

import type { Dispatch, SetStateAction } from "react";
import { Activity, ArrowUp, ExternalLink, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { ResearchResult, Section } from "../lib/shared";

const topics = [
  { title: "تطورات الذكاء الاصطناعي", query: "أحدث تطورات الذكاء الاصطناعي مفتوحة المصدر" },
  { title: "اتجاهات الأسواق", query: "اتجاهات أسعار الذهب هذا الأسبوع" },
  { title: "أدوات وبرامج", query: "أفضل أدوات إدارة المهام المجانية" },
  { title: "مراجع للتعلم", query: "مراجع حديثة لتعلم علوم البيانات للمبتدئين" },
];

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
  const analyze = () => {
    const evidence = researchData.map((r,i)=> (i+1) + ". " + r.title + "\n" + (r.date ? "التاريخ: " + r.date + "\n" : "") + (r.snippet || "") + "\nالمصدر: " + r.url).join("\n\n");
    const message = "حلّل نتائج البحث التالية للإجابة عن سؤالي: " + researchQuery + "\n\nاكتب خلاصة واضحة، أهم النقاط، ما يتفق وما يختلف بين المصادر، وما لا يمكن الجزم به. اربط كل معلومة بمصدرها ورابطها، وميّز بين تاريخ النشر وتاريخ الحدث. لا تضف حقائق غير مدعومة بالمقتطفات، واذكر أن التحليل أولي لأن المحتوى الكامل للصفحات لم يُقرأ.\n\n" + evidence;
    setSection("chat");
    void sendMessage(message);
  };
  return (
    <div className="section-page">
      <div className="section-hero">
        <div className="welcome-orb small"><div className="orb-core"><Search size={26}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div>
        <div className="hero-copy">
          <div className="eyebrow"><span/> بحث بمصادر موثوقة</div>
          <h1>دوّر في الويب كله</h1>
          <p>نتائج حية مع مقتطفات وتواريخ، وتحليل فوري بالذكاء الاصطناعي جوه المحادثة.</p>
        </div>
      </div>
      <div className="composer-wrap plain">
        <form className="composer" onSubmit={e=>{e.preventDefault();void runResearch();}}>
          <label htmlFor="research-query" className="field-label">سؤال البحث</label>
          <textarea id="research-query" value={researchQuery} onChange={e=>setResearchQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void runResearch();}}} maxLength={1000} placeholder="اكتب موضوع البحث أو سؤالًا..." rows={2}/>
          <div className="composer-toolbar">
            <div className="composer-tools"><span className="pill"><ShieldCheck size={12}/> نتائج حية من محرك البحث</span></div>
            <button className="primary-btn" type="submit" disabled={researchBusy||researchQuery.trim().length<2}>{researchBusy?<Activity size={16} className="spin"/>:<Search size={16}/>} {researchBusy?"جاري البحث…":"ابحث"}</button>
          </div>
        </form>
        <div className="privacy-note"><ShieldCheck size={13}/> النتائج مختصرات وليست تحققًا مستقلًا؛ افتح المصدر قبل الاعتماد عليه</div>
      </div>
      {researchData.length>0 ? <div className="list-card">
        <div className="list-header"><h3>النتائج <span className="pill purple-pill">{researchData.length}</span></h3><button className="primary-btn" type="button" disabled={busy} onClick={analyze}><Sparkles size={15}/> حلّل النتائج بالمساعد</button></div>
        <div className="sources-grid">{researchData.map((r,i)=><a className="source-card" key={r.url+i} href={r.url} target="_blank" rel="noopener noreferrer"><b>{r.title}</b><p>{r.snippet||"لا يوجد وصف متاح."}</p><span className="source-host"><ExternalLink size={11}/>{(()=>{try{return new URL(r.url).hostname}catch{return r.url}})()}{r.date?" • "+r.date:""}</span></a>)}</div>
      </div> : researchBusy ? <div className="empty-card"><div className="empty-icon"><Activity size={22} className="spin"/></div><b>جاري البحث في الويب...</b><p>ثواني وتظهر النتائج مع المصادر.</p></div> : <div className="template-grid">{topics.map(t=><button key={t.title} type="button" className="suggestion-card" onClick={()=>setResearchQuery(t.query)}><div className="suggestion-icon"><Search size={19}/></div><span>{t.title}</span><ArrowUp size={15}/></button>)}</div>}
      {researchData.length===0&&!researchBusy?<div className="empty-inline">ابدأ بكتابة موضوع للبحث. البحث متاح لأي مجال، مش مجالًا واحدًا.</div>:null}
    </div>
  );
}
