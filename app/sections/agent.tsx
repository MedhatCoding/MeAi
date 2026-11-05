"use client";

import type { Dispatch, SetStateAction } from "react";
import { Activity, Bot, Code2, ShieldCheck, Zap } from "lucide-react";
import type { AgentSource, AgentTraceItem, Section } from "../lib/shared";

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
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon purple"><Bot size={22}/></div><div><div className="eyebrow">وكيل عام</div><h1>إيه اللي عايز تنجزه؟</h1><p>اكتب طلبك مباشرة؛ تحليل، كتابة، ترجمة، بحث، تلخيص أو مساعدة في الملفات.</p></div></div><div className="form-card"><label htmlFor="agent-task">المهمة</label><textarea id="agent-task" value={agentTask} onChange={e=>setAgentTask(e.target.value)} placeholder="مثال: ابحث عن أفضل الخيارات مع المصادر، حلّل الملف المرفق، اكتب خطة تسويق، أو ساعدني في مشكلة..." rows={5}/><div className="form-footer"><span><ShieldCheck size={14}/> ينجز الجزء المتاح ويصرّح بما يحتاج ربطًا خارجيًا</span><button className="primary-btn" disabled={agentBusy||!agentTask.trim()} onClick={()=>void executeAgentTask()}>{agentBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {agentBusy?"جاري تنفيذ المهمة…":"نفّذ المهمة"}</button></div></div>{agentResult?<div className="list-card"><div className="list-header"><h3>النتيجة</h3><button className="tool-btn" onClick={()=>{void navigator.clipboard?.writeText(agentResult);setNotice("تم نسخ النتيجة إذا سمح المتصفح.");}}>نسخ النتيجة</button></div><div className="agent-result" dir="auto" style={{whiteSpace:"pre-wrap",lineHeight:1.8,padding:"16px"}}>{agentResult}</div>{agentTools.length>0?<div style={{padding:"0 16px 12px",display:"flex",gap:6,flexWrap:"wrap"}}><span className="pill">الأدوات المستخدمة:</span>{agentTools.map(tool=><span className="pill" key={tool}>{tool==="web_search"?"بحث ويب":tool==="github_read"?"قراءة GitHub":tool==="file_analysis"?"تحليل ملفات":tool}</span>)}</div>:null}{agentTrace.length>0?<div style={{padding:"0 16px 12px"}}><b>حالة تنفيذ الأدوات</b><div style={{display:"grid",gap:8,marginTop:8}}>{agentTrace.map((item,index)=><div key={`${item.tool}-${index}`} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:13}}><span className="pill" style={{flexShrink:0}}>{item.status==="success"?"نجح":item.status==="unavailable"?"غير مهيأ":item.status==="failed"?"فشل":"لم يلزم"}</span><div><b>{item.tool==="web_search"?"بحث الويب":item.tool==="github_read"?"قراءة بيانات GitHub":item.tool==="github_source_read"?"قراءة ملفات المشروع":item.tool==="file_analysis"?"تحليل الملفات":item.tool}</b><div style={{opacity:.8,marginTop:2}}>{item.detail}</div></div></div>)}</div></div>:null}{agentSources.length>0?<div style={{padding:"0 16px 16px"}}><b>مصادر البحث</b><ul style={{margin:"8px 0",paddingInlineStart:22}}>{agentSources.map((source,index)=><li key={source.url+index} style={{marginBottom:6}}><a href={source.url} target="_blank" rel="noreferrer" style={{textDecoration:"underline",overflowWrap:"anywhere"}}>{source.title}</a>{source.date?<small style={{display:"block",opacity:.7}}>{source.date}</small>:null}</li>)}</ul></div>:null}<div className="form-footer"><button className="secondary-btn" onClick={()=>{setInput(agentResult);changeSection("chat");}}>متابعة في المحادثة</button><button className="primary-btn" onClick={()=>{const url=URL.createObjectURL(new Blob([agentResult],{type:"text/markdown;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="medhat-ai-result.md";link.click();URL.revokeObjectURL(url);}}>تنزيل النتيجة</button></div></div>:<div className="empty-card"><div className="empty-icon"><Bot size={22}/></div><b>الوكيل جاهز لاستقبال المهمة</b><p>مش لازم تكون المهمة برمجة. لو الطلب محتاج بحثًا حيًا، هيستخدم البحث عند تهيئة مفتاحه؛ وأي إجراء خارجي غير موصول هيقولك بوضوح.</p></div>}<div className="form-card"><h3>مختبر تشغيل الكود المعزول</h3><p>شغّل كودًا عامًا داخل Sandbox مؤقتة منفصلة عن خادم التطبيق. كل تشغيل ينشئ بيئة جديدة ثم يغلقها؛ لا تُشارك أسرارًا أو بيانات حساسة.</p><label htmlFor="code-language">لغة البرمجة</label><select id="code-language" value={codeLanguage} onChange={e=>setCodeLanguage(e.target.value)}><option value="python">Python</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="r">R</option><option value="java">Java</option><option value="bash">Bash</option></select><label htmlFor="agent-code">الكود</label><textarea id="agent-code" value={codeInput} onChange={e=>setCodeInput(e.target.value)} rows={8} spellCheck={false} dir="ltr" style={{fontFamily:"monospace",textAlign:"left"}}/><div className="form-footer"><span><ShieldCheck size={14}/> موافقة قبل كل تشغيل • 12 ثانية كحد أقصى</span><button className="primary-btn" disabled={codeBusy||!codeInput.trim()} onClick={()=>void runAgentCode()}>{codeBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {codeBusy?"جاري التشغيل…":"شغّل الكود"}</button></div>{codeOutput?<pre dir="ltr" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:14,borderRadius:10,background:"var(--surface-2, #111827)",maxHeight:320,overflow:"auto"}}>{codeOutput}</pre>:null}</div><div className="form-card"><h3>تعديل ملف فعلي في المشروع</h3><p>حدد ملفًا موجودًا، واكتب التعديل المطلوب. لن يُحفظ أي تغيير قبل معاينته وموافقتك الصريحة.</p><label htmlFor="edit-path">مسار الملف</label><input id="edit-path" value={editPath} onChange={e=>setEditPath(e.target.value)} placeholder="app/page.tsx" /><label htmlFor="edit-instruction">التعديل المطلوب</label><textarea id="edit-instruction" value={editInstruction} onChange={e=>setEditInstruction(e.target.value)} placeholder="مثال: أضف معالجة واضحة لحالة الخطأ..." rows={3}/><div className="form-footer"><span><ShieldCheck size={14}/> تعديل مؤكد • ملفات التطبيق المسموحة فقط</span><button className="primary-btn" disabled={editBusy||!editPath.trim()||!editInstruction.trim()} onClick={()=>void applyProjectEdit()}>{editBusy?<Activity size={16} className="spin"/>:<Code2 size={16}/>} {editBusy?"جاري تعديل الملف…":"عدّل الملف في GitHub"}</button></div></div></div>
  );
}
