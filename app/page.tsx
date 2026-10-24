"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Archive, ArrowDown, ArrowUp, AudioLines, Bot, Check, ChevronDown, CircleHelp,
  Code2, Command, FileText, FolderOpen, Image as ImageIcon, Layers3, Menu, MessageCircle,
  MoreHorizontal, Paperclip, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, SquarePen,
  Video, WandSparkles, X, Zap, Brain, Clock3, PanelLeftClose, PanelLeft, Sun, Moon, Trash2
} from "lucide-react";

type Section = "chat" | "agent" | "tasks" | "workspace" | "images" | "video" | "memory" | "settings";
type Message = { role: "user" | "assistant"; content: string; time: string };
const nav: { id: Section; label: string; icon: typeof MessageCircle; group: string }[] = [
  { id: "chat", label: "المحادثة", icon: MessageCircle, group: "الرئيسية" },
  { id: "agent", label: "الوكيل الذكي", icon: Bot, group: "الرئيسية" },
  { id: "tasks", label: "المهام", icon: Layers3, group: "الرئيسية" },
  { id: "workspace", label: "مساحة العمل", icon: FolderOpen, group: "الأدوات" },
  { id: "images", label: "توليد الصور", icon: ImageIcon, group: "الأدوات" },
  { id: "video", label: "توليد الفيديو", icon: Video, group: "الأدوات" },
  { id: "memory", label: "الذاكرة", icon: Brain, group: "النظام" },
  { id: "settings", label: "الإعدادات", icon: Settings2, group: "النظام" },
];
const suggestions = [
  { icon: Code2, title: "ساعدني في البرمجة", prompt: "ساعدني في مراجعة كود وتحسينه مع شرح التغييرات." },
  { icon: Search, title: "ابحث على الويب", prompt: "ابحث على الويب عن أحدث المعلومات مع مصادر وروابط موثوقة." },
  { icon: FileText, title: "حلّل ملفًا", prompt: "أريد تحليل ملف واستخراج أهم النتائج والتوصيات." },
  { icon: WandSparkles, title: "خطّط لمشروع", prompt: "ساعدني في تحويل فكرة إلى خطة تنفيذ واضحة بخطوات قابلة للقياس." },
];

function readMessages(): Message[] {
  try { const raw = localStorage.getItem("medhat-chat-v1"); return raw ? JSON.parse(raw) as Message[] : []; } catch { return []; }
}
function titleFor(section: Section) { return nav.find(x => x.id === section)?.label ?? "المحادثة"; }

export default function Home() {
  const [section, setSection] = useState<Section>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [tasks, setTasks] = useState<{title:string; done:boolean}[]>([
    { title: "مراجعة المشروع واكتشاف الأخطاء", done: false },
    { title: "تحسين واجهة Medhat AI", done: true },
  ]);
  const [memories, setMemories] = useState<string[]>([]);
  const [serviceStatus, setServiceStatus] = useState<{configured:boolean;provider:string|null;model:string|null;features?:{agentExecution:boolean;imageGeneration:boolean;videoGeneration:boolean;persistentCloudMemory:boolean}} | null>(null);
  const [agentTask, setAgentTask] = useState("");
  const [agentPlan, setAgentPlan] = useState<{summary:string;steps:string[];limitations:string[]} | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = useMemo(() => nav.find(n => n.id === section)!, [section]);

  useEffect(() => { setMessages(readMessages()); try { setDark(localStorage.getItem("medhat-theme") !== "light"); setFiles(JSON.parse(localStorage.getItem("medhat-files-v1") || "[]") as string[]); setMemories(JSON.parse(localStorage.getItem("medhat-memory-v1") || "[]") as string[]); setTasks(JSON.parse(localStorage.getItem("medhat-tasks-v1") || JSON.stringify([{title:"مراجعة المشروع واكتشاف الأخطاء",done:false},{title:"تحسين واجهة Medhat AI",done:true}])) as {title:string;done:boolean}[]); } catch {} }, []);
  useEffect(() => { fetch("/api/status", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (data) setServiceStatus(data); }).catch(() => setServiceStatus(null)); }, []);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("medhat-tasks-v1", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("medhat-chat-v1", JSON.stringify(messages)); endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; if (typeof window !== "undefined") localStorage.setItem("medhat-theme", dark ? "dark" : "light"); }, [dark]);

  async function prepareAgentPlan() {
    const task = agentTask.trim();
    if (!task || agentBusy) return;
    setAgentBusy(true); setAgentPlan(null); setNotice("");
    try {
      const response = await fetch("/api/agent/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إعداد خطة المهمة.");
      setAgentPlan(data.plan);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إعداد الخطة.");
    } finally { setAgentBusy(false); }
  }

  async function sendMessage(value = input) {
    const text = value.trim(); if (!text || busy) return;
    const now = () => new Date().toLocaleTimeString("ar-EG", {hour:"2-digit",minute:"2-digit"});
    const next: Message[] = [...messages, { role: "user", content: text, time: now() }, { role: "assistant", content: "", time: now() }];
    setMessages(next); setInput(""); setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages: next.slice(0,-1).map(m => ({role:m.role, content:m.content})) }) });
      if (!res.ok) {
        let detail = "فشل الاتصال بخدمة الذكاء الاصطناعي.";
        try { const data = await res.json() as {error?:string}; if (data.error) detail = data.error; } catch {}
        throw new Error(detail);
      }
      if (!res.body) throw new Error("المزوّد لم يفتح تدفق الإجابة.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let finished = false;
      while (!finished) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, {stream:true});
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") { if (data === "[DONE]") finished = true; continue; }
            try {
              const parsed = JSON.parse(data) as {choices?:{delta?:{content?:string};finish_reason?:string}[];error?:{message?:string}};
              if (parsed.error?.message) throw new Error(parsed.error.message);
              const piece = parsed.choices?.[0]?.delta?.content;
              if (piece) {
                answer += piece;
                setMessages(old => old.map((m,i) => i === old.length-1 ? {...m, content:answer} : m));
              }
              if (parsed.choices?.[0]?.finish_reason) finished = true;
            } catch (err) {
              if (err instanceof Error && err.message !== "Unexpected end of JSON input") throw err;
            }
          }
        }
      }
      if (!answer.trim()) throw new Error("انتهى الاتصال دون نص إجابة. تحقق من النموذج وإعدادات المزوّد.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "تعذر الاتصال بالخدمة.";
      setNotice(message);
      setMessages(old => {
        const last = old[old.length-1];
        if (last?.role === "assistant" && !last.content) return old.slice(0,-1);
        return old;
      });
    } finally { setBusy(false); }
  }
  function uploadFiles(list: FileList | null) {
    if (!list) return;
    const names = Array.from(list).map(f => f.name);
    const merged = [...files, ...names].slice(-30); setFiles(merged); localStorage.setItem("medhat-files-v1", JSON.stringify(merged));
    setNotice("تم تسجيل أسماء الملفات في مساحة العمل المحلية. قراءة محتوى الملفات وربطها بالمحرك يتطلبان خدمة خلفية.");
  }
  function addMemory() {
    const value = window.prompt("اكتب معلومة تريد حفظها على هذا الجهاز:");
    if (!value?.trim()) return;
    const next = [...memories, value.trim()]; setMemories(next); localStorage.setItem("medhat-memory-v1", JSON.stringify(next));
  }
  function changeSection(id: Section) { setSection(id); setMobileNavOpen(false); setNotice(""); }

  return <main className={`app-shell ${dark ? "dark" : "light"}`}>
    {sidebarOpen && <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><Sparkles size={20}/></div><div className="brand-copy"><b>Medhat AI</b><span>مساعدك الذكي</span></div><button className="icon-btn collapse-btn" aria-label="إخفاء القائمة" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={18}/></button></div>
      <button className="new-chat" onClick={() => { setMessages([]); changeSection("chat"); }}><SquarePen size={17}/> محادثة جديدة <span>⌘ K</span></button>
      <div className="nav-scroll">{["الرئيسية","الأدوات","النظام"].map(group => <div className="nav-group" key={group}><div className="group-label">{group}</div>{nav.filter(n=>n.group===group).map(n=><button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>changeSection(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id==="agent"&&<i className="nav-dot"/>}</button>)}</div>)}
        <div className="side-divider"/><div className="group-label">المحادثات الأخيرة</div>{messages.length ? <button className="recent-chat" onClick={()=>changeSection("chat")}><MessageCircle size={16}/><span>{messages.find(m=>m.role==="user")?.content.slice(0,30) || "محادثة جديدة"}</span></button> : <div className="empty-history">لا توجد محادثات سابقة بعد</div>}
      </div>
      <div className="sidebar-bottom"><div className="connection"><span className="status-light"/><div><b>مساحة شخصية</b><small>البيانات محفوظة على الجهاز</small></div><ShieldCheck size={17}/></div><button className="profile-row" onClick={()=>changeSection("settings")}><div className="avatar">م</div><div><b>Medhat</b><small>المساعد الشخصي</small></div><MoreHorizontal size={18}/></button></div>
    </aside>}
    <section className="main-area">
      <header className="topbar"><div className="topbar-left">{!sidebarOpen&&<button className="icon-btn" onClick={()=>setSidebarOpen(true)} aria-label="إظهار القائمة"><PanelLeft size={19}/></button>}<button className="icon-btn mobile-menu" onClick={()=>setMobileNavOpen(v=>!v)} aria-label="القائمة"><Menu size={19}/></button><div className="crumb">{active.label}<ChevronDown size={15}/></div><span className="topbar-badge"><span/> نسخة الويب الجديدة</span></div><div className="topbar-right"><button className="icon-btn" onClick={()=>setDark(v=>!v)} aria-label="تغيير المظهر">{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="help-btn" onClick={()=>setNotice("Medhat AI — الواجهة الجديدة. التكاملات الخلفية تُربط تدريجيًا.")}><CircleHelp size={17}/><span>مساعدة</span></button><div className="avatar small-avatar">م</div></div></header>
      {mobileNavOpen&&<button className="mobile-scrim" onClick={()=>setMobileNavOpen(false)} aria-label="إغلاق القائمة"/>}
      <div className="content-area">
        {section==="chat"&&<div className={`chat-page ${messages.length?"has-messages":""}`}>
          {messages.length===0 ? <div className="welcome-wrap"><div className="welcome-orb"><div className="orb-core"><Sparkles size={30}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div><div className="eyebrow"><span/> مساحة الذكاء الاصطناعي الخاصة بك</div><h1>أهلًا بيك، <em>مدحت</em></h1><p className="welcome-sub">أنا جاهز أساعدك تفكّر، تبرمج، تبحث، وتحوّل أفكارك لخطوات عملية.</p><div className="suggestion-grid">{suggestions.map(s=><button key={s.title} className="suggestion-card" onClick={()=>sendMessage(s.prompt)}><div className="suggestion-icon"><s.icon size={19}/></div><span>{s.title}</span><ArrowUp size={15}/></button>)}</div></div>
          : <div className="conversation">{messages.map((m,i)=><div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role==="assistant"?<Sparkles size={17}/>:<span>م</span>}</div><div className="message-main"><div className="message-meta"><b>{m.role==="assistant"?"Medhat AI":"أنت"}</b><time>{m.time}</time></div><div className="message-text">{m.content}</div></div></div>)}{busy&&<div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={17}/></div><div className="typing"><i/><i/><i/> جاري التفكير</div></div>}<div ref={endRef}/></div>}
          <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage();}}} placeholder="اسأل Medhat AI أي حاجة..." rows={1}/><div className="composer-toolbar"><div className="composer-tools"><button className="tool-btn" onClick={()=>fileRef.current?.click()}><Paperclip size={17}/><span>إرفاق</span></button><button className="tool-btn" onClick={()=>changeSection("agent")}><Bot size={17}/><span>الوكيل</span></button><button className="tool-btn" onClick={()=>changeSection("workspace")}><FolderOpen size={17}/><span>الملفات</span></button></div><div className="send-group"><span className="model-pill"><Sparkles size={13}/> تلقائي <ChevronDown size={13}/></span><button className="send-btn" onClick={()=>void sendMessage()} disabled={!input.trim()||busy} aria-label="إرسال"><Send size={17}/></button></div></div></div><div className="privacy-note"><ShieldCheck size={13}/> راجع المعلومات المهمة قبل الاعتماد عليها</div></div>
        </div>}
        {section==="agent"&&<div className="section-page"><div className="page-heading"><div className="page-icon purple"><Bot size={22}/></div><div><div className="eyebrow">تنفيذ بمساعدة الذكاء الاصطناعي</div><h1>الوكيل الذكي</h1><p>حوّل الهدف إلى خطوات، وتابع التنفيذ والنتائج من مكان واحد.</p></div></div><div className="agent-banner"><div><span className="pill purple-pill"><Activity size={14}/> وضع التنفيذ</span><h2>إيه المهمة اللي عايز تنجزها؟</h2><p>اكتب المطلوب بوضوح. تنفيذ المهام المتصلة بالمشروع يحتاج ربط خدمة الوكيل الحالية.</p></div><div className="agent-graphic"><Bot size={54}/><span/></div></div><div className="form-card"><label htmlFor="agent-task">وصف المهمة</label><textarea id="agent-task" value={agentTask} onChange={e=>setAgentTask(e.target.value)} placeholder="مثال: افحص المشروع، حدد الأخطاء، واقترح إصلاحات واختبارات..."/><div className="form-footer"><span><ShieldCheck size={14}/> تخطيط آمن — لا ينفّذ تغييرات تلقائيًا</span><button className="primary-btn" disabled={agentBusy || !agentTask.trim()} onClick={prepareAgentPlan}>{agentBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {agentBusy?"جاري إعداد الخطة":"إعداد خطة المهمة"}</button></div></div>{agentPlan?<><div className="subheading"><h3>{agentPlan.summary}</h3><span className="pill">خطة مقترحة</span></div><div className="list-card"><div className="list-header"><h3>الخطوات المقترحة</h3><span className="pill">{agentPlan.steps.length} خطوات</span></div>{agentPlan.steps.map((step,i)=><div className="task-row" key={i}><span className="check-circle">{i+1}</span><span>{step}</span></div>)}{agentPlan.limitations.length>0&&<div className="notice-card"><b>حدود التنفيذ</b>{agentPlan.limitations.map((item,i)=><p key={i}>{item}</p>)}</div>}</div></>:<div className="empty-card"><div className="empty-icon"><Clock3 size={22}/></div><b>ابدأ بوصف المهمة</b><p>سيحوّل الوكيل طلبك إلى خطوات عملية باستخدام مزوّد الذكاء الاصطناعي المضبوط. الخطة لا تنفّذ أو تعدّل ملفات بعد.</p></div>}</div>}
        {section==="tasks"&&<div className="section-page"><div className="page-heading"><div className="page-icon blue"><Layers3 size={22}/></div><div><div className="eyebrow">خططك في مكان واحد</div><h1>المهام</h1><p>تابع ما تعمل عليه وسجّل الإنجاز خطوة بخطوة.</p></div><button className="primary-btn heading-action" onClick={()=>{const t=window.prompt("اسم المهمة الجديدة");if(t?.trim())setTasks(v=>[...v,{title:t.trim(),done:false}]);}}><Plus size={16}/> مهمة جديدة</button></div><div className="metric-grid"><div className="metric-card"><span>إجمالي المهام</span><b>{tasks.length}</b><Layers3 size={18}/></div><div className="metric-card"><span>مكتملة</span><b>{tasks.filter(t=>t.done).length}</b><Check size={18}/></div><div className="metric-card"><span>قيد التنفيذ</span><b>{tasks.filter(t=>!t.done).length}</b><Activity size={18}/></div></div><div className="list-card"><div className="list-header"><h3>قائمة المهام</h3><span className="pill">محلية</span></div>{tasks.map((t,i)=><button key={i} className="task-row" onClick={()=>setTasks(old=>old.map((x,j)=>j===i?{...x,done:!x.done}:x))}><span className={`check-circle ${t.done?"checked":""}`}>{t.done&&<Check size={14}/>}</span><span className={t.done?"task-done":""}>{t.title}</span><span className={`task-status ${t.done?"done":""}`}>{t.done?"مكتملة":"مفتوحة"}</span></button>)}</div></div>}
        {section==="workspace"&&<div className="section-page"><div className="page-heading"><div className="page-icon green"><FolderOpen size={22}/></div><div><div className="eyebrow">ملفاتك ومخرجاتك</div><h1>مساحة العمل</h1><p>اجمع ملفات المشروع والنتائج في مساحة منظمة.</p></div><button className="primary-btn heading-action" onClick={()=>fileRef.current?.click()}><Plus size={16}/> إضافة ملفات</button></div><div className="drop-zone" onClick={()=>fileRef.current?.click()}><div className="drop-icon"><Paperclip size={24}/></div><b>أضف ملفات إلى مساحة العمل</b><p>اختر ملفات من جهازك. هذه النسخة تسجل أسماءها محليًا فقط.</p><button className="secondary-btn"><FolderOpen size={15}/> تصفح الملفات</button></div><div className="list-card"><div className="list-header"><h3>الملفات المضافة</h3><span className="pill">{files.length} ملف</span></div>{files.length?files.map((f,i)=><div className="file-row" key={i}><div className="file-type"><FileText size={18}/></div><span>{f}</span><button className="icon-btn" aria-label="حذف الملف" onClick={()=>{const n=files.filter((_,j)=>i!==j);setFiles(n);localStorage.setItem("medhat-files-v1",JSON.stringify(n));}}><Trash2 size={16}/></button></div>):<div className="empty-inline">لم تضف ملفات بعد.</div>}</div></div>}
        {section==="images"&&<div className="section-page"><div className="page-heading"><div className="page-icon pink"><ImageIcon size={22}/></div><div><div className="eyebrow">من الفكرة إلى الصورة</div><h1>توليد الصور</h1><p>صف الصورة التي تتخيلها واضبط إعدادات التوليد.</p></div></div><div className="creative-layout"><div className="form-card"><label>وصف الصورة</label><textarea placeholder="صف المشهد، الأسلوب، الإضاءة، الألوان، والتفاصيل..."/><label>النمط الفني</label><div className="choice-row"><button className="choice selected">واقعي</button><button className="choice">سينمائي</button><button className="choice">رسومي</button><button className="choice">أنمي</button></div><label>نسبة الأبعاد</label><div className="choice-row"><button className="choice selected">1:1</button><button className="choice">16:9</button><button className="choice">9:16</button></div><button className="primary-btn full-btn" onClick={()=>setNotice("واجهة التوليد جاهزة؛ يلزم ربطها بمزوّد الصور الموجود في المشروع قبل إنتاج صور فعلية.")}><WandSparkles size={16}/> إنشاء صورة</button></div><div className="preview-placeholder"><div className="preview-glow"><ImageIcon size={36}/></div><b>مساحة معاينة الصورة</b><p>ستظهر الصورة هنا بعد ربط مزوّد التوليد.</p></div></div></div>}
        {section==="video"&&<div className="section-page"><div className="page-heading"><div className="page-icon orange"><Video size={22}/></div><div><div className="eyebrow">حرّك خيالك</div><h1>توليد الفيديو</h1><p>جهّز وصف المشهد وراجع حالة التوليد والنتيجة.</p></div></div><div className="creative-layout"><div className="form-card"><label>وصف الفيديو</label><textarea placeholder="اشرح المشهد وحركة الكاميرا والإضاءة ومدة الفيديو..."/><label>المدة</label><div className="choice-row"><button className="choice selected">5 ثوانٍ</button><button className="choice">10 ثوانٍ</button><button className="choice">15 ثانية</button></div><label>اتجاه الفيديو</label><div className="choice-row"><button className="choice">أفقي</button><button className="choice selected">عمودي</button><button className="choice">مربع</button></div><button className="primary-btn full-btn" onClick={()=>setNotice("واجهة الفيديو جاهزة؛ يلزم ربطها بخدمة الفيديو الحالية والتحقق من رصيد المزوّد.")}><Video size={16}/> بدء التوليد</button></div><div className="preview-placeholder video-preview"><div className="preview-glow"><Video size={36}/></div><b>معاينة الفيديو</b><p>حالة المهمة ونتيجة التوليد ستظهر هنا بعد التكامل.</p></div></div></div>}
        {section==="memory"&&<div className="section-page"><div className="page-heading"><div className="page-icon purple"><Brain size={22}/></div><div><div className="eyebrow">سياقك في متناولك</div><h1>الذاكرة</h1><p>إدارة معلومات تحفظها هذه الواجهة على هذا الجهاز فقط.</p></div><button className="primary-btn heading-action" onClick={addMemory}><Plus size={16}/> إضافة معلومة</button></div><div className="memory-callout"><ShieldCheck size={20}/><div><b>تحكم في بياناتك</b><p>المعلومات هنا محلية في المتصفح، وليست متزامنة حاليًا مع قاعدة الذاكرة الخلفية.</p></div></div><div className="list-card"><div className="list-header"><h3>المعلومات المحفوظة</h3><span className="pill">{memories.length}</span></div>{memories.length?memories.map((m,i)=><div className="memory-row" key={i}><Brain size={17}/><span>{m}</span><button className="icon-btn" onClick={()=>{const n=memories.filter((_,j)=>i!==j);setMemories(n);localStorage.setItem("medhat-memory-v1",JSON.stringify(n));}} aria-label="حذف"><Trash2 size={16}/></button></div>):<div className="empty-inline">لا توجد معلومات محفوظة محليًا.</div>}</div></div>}
        {section==="settings"&&<div className="section-page"><div className="page-heading"><div className="page-icon blue"><Settings2 size={22}/></div><div><div className="eyebrow">تجربتك على طريقتك</div><h1>الإعدادات</h1><p>تفضيلات الواجهة والخصوصية.</p></div></div><div className="settings-card"><div className="setting-row"><div className="setting-icon"><Sun size={18}/></div><div className="setting-copy"><b>المظهر</b><small>التبديل بين الوضع الداكن والفاتح</small></div><button className="secondary-btn" onClick={()=>setDark(v=>!v)}>{dark?"داكن":"فاتح"} <ChevronDown size={14}/></button></div><div className="setting-row"><div className="setting-icon"><ShieldCheck size={18}/></div><div className="setting-copy"><b>الخصوصية</b><small>المحادثات والملفات التجريبية محفوظة محليًا في المتصفح</small></div><span className="pill">محلي</span></div><div className="setting-row"><div className="setting-icon"><Zap size={18}/></div><div className="setting-copy"><b>مزوّد الذكاء الاصطناعي</b><small>{serviceStatus?.configured ? `متصل: ${serviceStatus.provider} — ${serviceStatus.model}` : "أضف مفاتيح المزوّد في إعدادات الاستضافة لتفعيل المحادثة"}</small></div><span className={`pill ${serviceStatus?.configured ? "" : "warning-pill"}`}>{serviceStatus ? (serviceStatus.configured ? "مهيأ" : "غير مهيأ") : "جارٍ الفحص"}</span></div><div className="setting-row"><div className="setting-icon"><Archive size={18}/></div><div className="setting-copy"><b>مسح البيانات المحلية</b><small>حذف سجل المحادثة والملفات والذاكرة من هذا المتصفح</small></div><button className="secondary-btn danger-btn" onClick={()=>{if(confirm("هل تريد مسح المحادثة والملفات والذاكرة المحلية؟")){setMessages([]);setFiles([]);setMemories([]);localStorage.removeItem("medhat-chat-v1");localStorage.removeItem("medhat-files-v1");localStorage.removeItem("medhat-memory-v1");setNotice("تم مسح البيانات المحلية.");}}}><Trash2 size={15}/> مسح البيانات</button></div></div></div>}
      </div>
      {notice&&<div className="toast"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="إغلاق"><X size={16}/></button></div>}
      <input ref={fileRef} type="file" multiple hidden onChange={e=>uploadFiles(e.target.files)}/>
      {section!=="chat"&&<footer className="app-footer">Medhat AI <span>•</span> واجهة تجريبية متجاوبة <span>•</span> التكاملات الخلفية تُفعّل تدريجيًا</footer>}
    </section>
    <nav className="mobile-bottom-nav">{nav.filter(n=>["chat","agent","tasks","workspace","images"].includes(n.id)).map(n=><button key={n.id} className={section===n.id?"selected":""} onClick={()=>changeSection(n.id)}><n.icon size={19}/><span>{n.label==="توليد الصور"?"الصور":n.label==="مساحة العمل"?"الملفات":n.label==="الوكيل الذكي"?"الوكيل":n.label}</span></button>)}<button onClick={()=>setMobileNavOpen(v=>!v)}><Menu size={19}/><span>المزيد</span></button></nav>
  </main>;
}
