"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { ArrowUp, Bot, ChevronDown, FolderOpen, Paperclip, Send, ShieldCheck, Sparkles, Code2, Search, FileText, WandSparkles } from "lucide-react";
import type { Message, Section } from "../lib/shared";

const suggestions = [
  { icon: Code2, title: "ساعدني في البرمجة", prompt: "ساعدني في مراجعة كود وتحسينه مع شرح التغييرات." },
  { icon: Search, title: "ابحث على الويب", prompt: "ابحث على الويب عن أحدث المعلومات مع مصادر وروابط موثوقة." },
  { icon: FileText, title: "حلّل ملفًا", prompt: "أريد تحليل ملف واستخراج أهم النتائج والتوصيات." },
  { icon: WandSparkles, title: "خطّط لمشروع", prompt: "ساعدني في تحويل فكرة إلى خطة تنفيذ واضحة بخطوات قابلة للقياس." },
];

interface ChatSectionProps {
  messages: Message[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  busy: boolean;
  endRef: RefObject<HTMLDivElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  sendMessage: (value?: string) => void | Promise<void>;
  changeSection: (id: Section) => void;
}

export default function ChatSection({
  messages,
  input,
  setInput,
  busy,
  endRef,
  fileRef,
  sendMessage,
  changeSection,
}: ChatSectionProps) {
  return (
    <div className={`chat-page ${messages.length?"has-messages":""}`}>
          {messages.length===0 ? <div className="welcome-wrap"><div className="welcome-orb"><div className="orb-core"><Sparkles size={30}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div><div className="eyebrow"><span/> مساحة الذكاء الاصطناعي الخاصة بك</div><h1>أهلًا بيك، <em>مدحت</em></h1><p className="welcome-sub">أنا جاهز أساعدك تفكّر، تبرمج، تبحث، وتحوّل أفكارك لخطوات عملية.</p><div className="suggestion-grid">{suggestions.map(s=><button key={s.title} className="suggestion-card" onClick={()=>sendMessage(s.prompt)}><div className="suggestion-icon"><s.icon size={19}/></div><span>{s.title}</span><ArrowUp size={15}/></button>)}</div></div>
          : <div className="conversation">{messages.map((m,i)=><div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role==="assistant"?<Sparkles size={17}/>:<span>م</span>}</div><div className="message-main"><div className="message-meta"><b>{m.role==="assistant"?"Medhat AI":"أنت"}</b><time>{m.time}</time></div><div className="message-text">{m.content}</div></div></div>)}{busy&&<div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={17}/></div><div className="typing"><i/><i/><i/> جاري التفكير</div></div>}<div ref={endRef}/></div>}
          <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage();}}} placeholder="اسأل Medhat AI أي حاجة..." rows={1}/><div className="composer-toolbar"><div className="composer-tools"><button className="tool-btn" onClick={()=>fileRef.current?.click()}><Paperclip size={17}/><span>إرفاق</span></button><button className="tool-btn" onClick={()=>changeSection("agent")}><Bot size={17}/><span>الوكيل</span></button><button className="tool-btn" onClick={()=>changeSection("workspace")}><FolderOpen size={17}/><span>الملفات</span></button></div><div className="send-group"><span className="model-pill"><Sparkles size={13}/> تلقائي <ChevronDown size={13}/></span><button className="send-btn" onClick={()=>void sendMessage()} disabled={!input.trim()||busy} aria-label="إرسال"><Send size={17}/></button></div></div></div><div className="privacy-note"><ShieldCheck size={13}/> راجع المعلومات المهمة قبل الاعتماد عليها</div></div>
        </div>
  );
}
