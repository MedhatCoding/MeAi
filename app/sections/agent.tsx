"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Activity, ArrowUp, Bot, Check, Code2, Copy, Download, FileText, MessageCircle, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { AgentSource, AgentTraceItem, Section } from "../lib/shared";

const templates = [
  { icon: Search, title: "بحث ومقارنة", prompt: "ابحث عن أفضل أدوات إدارة المهام مفتوحة المصدر وقارن بينها مع المصادر." },
  { icon: FileText, title: "تحليل ملفات", prompt: "حلّل الملفات المرفقة واستخرج أهم النقاط والتوصيات العملية." },
  { icon: Sparkles, title: "خطة متكاملة", prompt: "اكتب خطة تسويق رقمي متكاملة لمنتج جديد موجه للسوق المصري." },
  { icon: Code2, title: "مراجعة كود", prompt: "راجع الكود الحالي واقترح تحسينات واضحة للأداء والقراءة." },
];

interface AgentSectionProps {
  setInput: Dispatch<SetStateAction<string>>;
  changeSection: (id: Section) => void;
  agentTask: string;
  setAgentTask: Dispatch<SetStateAction<string>>;
  agentBusy: boolean;
  agentResult: string;
  agentTools: string[];
  agentTrace: AgentTraceItem[];
  agentSources: AgentSource[];
  executeAgentTask: () => Promise<void>;
  codeLanguage: string;
  setCodeLanguage: Dispatch<SetStateAction<string>>;
  codeInput: string;
  setCodeInput: Dispatch<SetStateAction<string>>;
  codeOutput: string;
  codeBusy: boolean;
  runAgentCode: () => Promise<void>;
  editPath: string;
  setEditPath: Dispatch<SetStateAction<string>>;
  editInstruction: string;
  setEditInstruction: Dispatch<SetStateAction<string>>;
  editBusy: boolean;
  applyProjectEdit: () => Promise<void>;
  setNotice: Dispatch<SetStateAction<string>>;
}

export default function AgentSection({
  setInput,
  changeSection,
  agentTask,
  setAgentTask,
  agentBusy,
  agentResult,
  agentTools,
  agentTrace,
  agentSources,
  executeAgentTask,
  codeLanguage,
  setCodeLanguage,
  codeInput,
  setCodeInput,
  codeOutput,
  codeBusy,
  runAgentCode,
  editPath,
  setEditPath,
  editInstruction,
  setEditInstruction,
  editBusy,
  applyProjectEdit,
  setNotice,
}: AgentSectionProps) {
  const [copied, setCopied] = useState(false);
  const copyResult = () => {
    void navigator.clipboard?.writeText(agentResult).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => setNotice("تعذر النسخ من المتصفح."));
  };
  const downloadResult = () => {
    const url = URL.createObjectURL(new Blob([agentResult], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "medhat-ai-result.md"; link.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="section-page">
      <div className="section-hero">
        <div className="welcome-orb small"><div className="orb-core"><Bot size={26}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div>
        <div className="hero-copy">
          <div className="eyebrow"><span/> وكيل عام بلا حدود</div>
          <h1>نفّذ أي مهمة من أولها لآخرها</h1>
          <p>بحث حي، تحليل ملفات، كتابة، ترجمة وتخطيط، والنتيجة بتفصيل خطوات التنفيذ والمصادر.</p>
        </div>
      </div>
      <div className="template-grid">{templates.map(t => <button key={t.title} type="button" className="suggestion-card" onClick={() => setAgentTask(t.prompt)}><div className="suggestion-icon"><t.icon size={19}/></div><span>{t.title}</span><ArrowUp size={15}/></button>)}</div>
      <div className="composer-wrap plain">
        <div className="composer">
          <label htmlFor="agent-task" className="field-label">المهمة</label>
          <textarea id="agent-task" value={agentTask} onChange={e=>setAgentTask(e.target.value)} placeholder="اكتب المهمة كاملة... مثال: ابحث عن أفضل الخيارات مع المصادر، حلّل الملف المرفق، اكتب خطة تسويق..." rows={5}/>
          <div className="composer-toolbar">
            <div className="composer-tools"><span className="pill"><ShieldCheck size={12}/> ينجز المتاح ويصرّح بأي قيد</span></div>
            <button className="primary-btn" disabled={agentBusy||!agentTask.trim()} onClick={()=>void executeAgentTask()}>{agentBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {agentBusy?"جاري تنفيذ المهمة…":"نفّذ المهمة"}</button>
          </div>
        </div>
        <div className="privacy-note"><ShieldCheck size={13}/> وكيل كامل من غير حدود اشتراكات أو قيود مصطنعة</div>
      </div>
      {agentResult ? <div className="list-card">
        <div className="list-header"><h3>نتيجة المهمة</h3><button className="msg-action-btn" aria-label="نسخ النتيجة" onClick={copyResult}>{copied?<Check size={14}/>:<Copy size={14}/>}</button></div>
        <div className="result-text" dir="auto">{agentResult}</div>
        {agentTools.length>0?<div className="trace-chips"><span className="pill">الأدوات:</span>{agentTools.map(tool=><span className="pill purple-pill" key={tool}>{tool==="web_search"?"بحث ويب":tool==="github_read"?"قراءة GitHub":tool==="github_source_read"?"قراءة ملفات المشروع":tool==="file_analysis"?"تحليل ملفات":tool}</span>)}</div>:null}
        {agentTrace.length>0?<div className="trace-list">{agentTrace.map((item,index)=><div className="trace-item" key={item.tool+"-"+index}><span className={"pill "+(item.status==="success"?"trace-ok":item.status==="failed"?"trace-fail":item.status==="unavailable"?"trace-warn":"")}>{item.status==="success"?"نجح":item.status==="unavailable"?"غير مهيأ":item.status==="failed"?"فشل":"لم يلزم"}</span><div><b>{item.tool==="web_search"?"بحث الويب":item.tool==="github_read"?"قراءة بيانات GitHub":item.tool==="github_source_read"?"قراءة ملفات المشروع":item.tool==="file_analysis"?"تحليل الملفات":item.tool}</b><small>{item.detail}</small></div></div>)}</div>:null}
        {agentSources.length>0?<div className="sources-grid">{agentSources.map((source,index)=><a className="source-card" key={source.url+index} href={source.url} target="_blank" rel="noopener noreferrer"><b>{source.title}</b><p>{source.date?"التاريخ: "+source.date:""}</p><span className="source-host">{(()=>{try{return new URL(source.url).hostname}catch{return source.url}})()}</span></a>)}</div>:null}
        <div className="action-row"><button className="secondary-btn" onClick={()=>{setInput(agentResult);changeSection("chat");}}><MessageCircle size={15}/> متابعة في المحادثة</button><button className="secondary-btn" onClick={downloadResult}><Download size={15}/> تنزيل النتيجة</button></div>
      </div> : agentBusy ? <div className="empty-card"><div className="empty-icon"><Activity size={22} className="spin"/></div><b>جاري تنفيذ المهمة...</b><p>الوكيل بيجمع الأدلة وينفذ الخطوات، لحظات وتظهر النتيجة.</p></div> : <div className="empty-card"><div className="empty-icon"><Bot size={22}/></div><b>الوكيل جاهز لأي مهمة</b><p>مش لازم المهمة تكون برمجة. لو محتاجة بحث حي هيستخدمه لو مفتاحه مهيأ، وهيقولك بوضوح أي إجراء خارجي مش متاح.</p></div>}
      <div className="form-card">
        <div className="list-header"><h3>مختبر الكود المعزول</h3><span className="pill purple-pill">Sandbox</span></div>
        <p className="card-sub">شغّل كودًا داخل بيئة معزولة مؤقتة منفصلة عن خادم التطبيق؛ كل تشغيل بيئة جديدة تتغلق بعده، فمينفعش تتحط أسرار أو بيانات حساسة.</p>
        <label htmlFor="code-language">لغة البرمجة</label>
        <select id="code-language" value={codeLanguage} onChange={e=>setCodeLanguage(e.target.value)}><option value="python">Python</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="r">R</option><option value="java">Java</option><option value="bash">Bash</option></select>
        <label htmlFor="agent-code">الكود</label>
        <textarea id="agent-code" value={codeInput} onChange={e=>setCodeInput(e.target.value)} rows={8} spellCheck={false} dir="ltr"/>
        <div className="form-footer"><span><ShieldCheck size={14}/> موافقة قبل كل تشغيل • 12 ثانية كحد أقصى</span><button className="primary-btn" disabled={codeBusy||!codeInput.trim()} onClick={()=>void runAgentCode()}>{codeBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {codeBusy?"جاري التشغيل…":"شغّل الكود"}</button></div>
        {codeOutput?<pre className="code-output" dir="ltr">{codeOutput}</pre>:null}
      </div>
      <div className="form-card">
        <div className="list-header"><h3>تعديل ملف في المشروع</h3><span className="pill purple-pill">GitHub</span></div>
        <p className="card-sub">حدد ملفًا موجودًا واكتب التعديل المطلوب. مفيش تغيير بيتاحفظ قبل معاينته وموافقتك الصريحة.</p>
        <label htmlFor="edit-path">مسار الملف</label>
        <input id="edit-path" value={editPath} onChange={e=>setEditPath(e.target.value)} placeholder="app/page.tsx"/>
        <label htmlFor="edit-instruction">التعديل المطلوب</label>
        <textarea id="edit-instruction" value={editInstruction} onChange={e=>setEditInstruction(e.target.value)} placeholder="مثال: أضف معالجة واضحة لحالة الخطأ..." rows={3}/>
        <div className="form-footer"><span><ShieldCheck size={14}/> تعديل مؤكد • ملفات التطبيق المسموحة فقط</span><button className="primary-btn" disabled={editBusy||!editPath.trim()||!editInstruction.trim()} onClick={()=>void applyProjectEdit()}>{editBusy?<Activity size={16} className="spin"/>:<Code2 size={16}/>} {editBusy?"جاري تعديل الملف…":"عدّل الملف في GitHub"}</button></div>
      </div>
    </div>
  );
}
