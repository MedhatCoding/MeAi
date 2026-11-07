"use client";

import { useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { ArrowUp, Bot, Check, ChevronDown, Copy, ExternalLink, Image as ImageIcon, MessageCircle, Paperclip, Search, Send, ShieldCheck, Sparkles, Code2 } from "lucide-react";
import type { ChatMode, Message } from "../lib/shared";

const modes: { id: ChatMode; label: string; icon: typeof MessageCircle; placeholder: string }[] = [
  { id: "chat", label: "محادثة", icon: MessageCircle, placeholder: "اسأل Medhat AI أي حاجة..." },
  { id: "research", label: "بحث", icon: Search, placeholder: "إيه اللي تحب أدوّر عليه على الويب؟" },
  { id: "image", label: "صورة", icon: ImageIcon, placeholder: "وصّف الصورة اللي تتخيلها..." },
  { id: "agent", label: "وكيل", icon: Bot, placeholder: "اكتب مهمة كاملة للوكيل ينفذها..." },
];

const suggestions = [
  { icon: Code2, title: "ساعدني في البرمجة", mode: "chat" as ChatMode, prompt: "ساعدني في مراجعة كود وتحسينه مع شرح التغييرات." },
  { icon: Search, title: "ابحث على الويب", mode: "research" as ChatMode, prompt: "أحدث تطورات الذكاء الاصطناعي مفتوحة المصدر هذا الشهر" },
  { icon: ImageIcon, title: "ارسم لي صورة", mode: "image" as ChatMode, prompt: "غروب الشمس فوق الكورنيش بأسلوب سينمائي دافئ" },
  { icon: Bot, title: "نفّذ مهمة كاملة", mode: "agent" as ChatMode, prompt: "ابحث عن أفضل أدوات إدارة المهام مفتوحة المصدر وقارن بينها مع مصادر موثوقة." },
];

interface ChatSectionProps {
  messages: Message[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  busy: boolean;
  endRef: RefObject<HTMLDivElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  composerMode: ChatMode;
  setComposerMode: Dispatch<SetStateAction<ChatMode>>;
  handleSend: (value?: string, mode?: ChatMode) => void | Promise<void>;
}

export default function ChatSection({
  messages,
  input,
  setInput,
  busy,
  endRef,
  fileRef,
  composerMode,
  setComposerMode,
  handleSend,
}: ChatSectionProps) {
  const [copied, setCopied] = useState<number | null>(null);
  const activeMode = modes.find(m => m.id === composerMode) ?? modes[0];
  return (
    <div className={"chat-page " + (messages.length ? "has-messages" : "")}>
      {messages.length === 0 ? (
        <div className="welcome-wrap">
          <div className="welcome-orb"><div className="orb-core"><Sparkles size={30}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div>
          <div className="eyebrow"><span/> مساحة الذكاء الاصطناعي الكاملة بتاعتك</div>
          <h1>أهلًا بيك، <em>مدحت</em></h1>
          <p className="welcome-sub">كل حاجة في مكان واحد: محادثة، بحث بمصادر، توليد صور، ووكيل ينفذ مهام كاملة. من غير حدود اشتراكات.</p>
          <div className="suggestion-grid">{suggestions.map(s => <button key={s.title} className="suggestion-card" onClick={() => { setComposerMode(s.mode); void handleSend(s.prompt, s.mode); }}><div className="suggestion-icon"><s.icon size={19}/></div><span>{s.title}</span><ArrowUp size={15}/></button>)}</div>
        </div>
      ) : (
        <div className="conversation">
          {messages.map((m, i) => (
            <div className={"message-row " + m.role} key={i}>
              <div className={"message-avatar " + m.role}>{m.role === "assistant" ? <Sparkles size={17}/> : <span>م</span>}</div>
              <div className="message-main">
                <div className="message-meta"><b>{m.role === "assistant" ? "Medhat AI" : "أنت"}</b><time>{m.time}</time>{m.role === "assistant" && m.content ? <button className="msg-action-btn" aria-label="نسخ الرد" onClick={() => { void navigator.clipboard?.writeText(m.content).then(() => { setCopied(i); window.setTimeout(() => setCopied(null), 1500); }).catch(() => {}); }}>{copied === i ? <Check size={13}/> : <Copy size={13}/>}</button> : null}</div>
                <div className="message-text">{m.content}</div>
                {m.image ? <img className="chat-image" src={m.image} alt="صورة مولّدة بالذكاء الاصطناعي"/> : null}
                {m.sources && m.sources.length > 0 ? <div className="sources-grid">{m.sources.map((s, si) => <a className="source-card" key={s.url + si} href={s.url} target="_blank" rel="noopener noreferrer"><b>{s.title}</b><p>{s.snippet}</p><span className="source-host"><ExternalLink size={11}/>{(() => { try { return new URL(s.url).hostname } catch { return s.url } })()}</span></a>)}</div> : null}
                {m.tools && m.tools.length > 0 ? <div className="trace-chips">{m.tools.map((t, ti) => <span className="pill purple-pill" key={t + ti}>{t === "web_search" ? "بحث ويب" : t === "github_read" ? "قراءة GitHub" : t === "github_source_read" ? "قراءة ملفات المشروع" : t === "file_analysis" ? "تحليل ملفات" : t}</span>)}</div> : null}
                {m.trace && m.trace.length > 0 ? <div className="trace-list">{m.trace.map((item, ti) => <div className="trace-item" key={item.tool + "-" + ti}><span className={"pill " + (item.status === "success" ? "trace-ok" : item.status === "failed" ? "trace-fail" : item.status === "unavailable" ? "trace-warn" : "")}>{item.status === "success" ? "نجح" : item.status === "unavailable" ? "غير مهيأ" : item.status === "failed" ? "فشل" : "لم يلزم"}</span><div><b>{item.tool === "web_search" ? "بحث الويب" : item.tool === "github_read" ? "قراءة بيانات GitHub" : item.tool === "github_source_read" ? "قراءة ملفات المشروع" : item.tool === "file_analysis" ? "تحليل الملفات" : item.tool}</b><small>{item.detail}</small></div></div>)}</div> : null}
              </div>
            </div>
          ))}
          {busy ? <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={17}/></div><div className="typing"><i/><i/><i/> جاري التنفيذ</div></div> : null}
          <div ref={endRef}/>
        </div>
      )}
      <div className="composer-wrap">
        <div className="composer">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }} placeholder={activeMode.placeholder} rows={1}/>
          <div className="composer-toolbar">
            <div className="composer-tools">
              <button className="tool-btn" onClick={() => fileRef.current?.click()} aria-label="إرفاق ملف"><Paperclip size={16}/></button>
              {modes.map(m => <button key={m.id} type="button" className={"mode-chip" + (composerMode === m.id ? " selected" : "")} onClick={() => setComposerMode(m.id)}><m.icon size={14}/><span>{m.label}</span></button>)}
            </div>
            <div className="send-group"><span className="model-pill"><Sparkles size={13}/> {activeMode.label} <ChevronDown size={13}/></span><button className="send-btn" onClick={() => void handleSend()} disabled={!input.trim() || busy} aria-label="إرسال"><Send size={17}/></button></div>
          </div>
        </div>
        <div className="privacy-note"><ShieldCheck size={13}/> محادثة وبحث وصور ووكيل من مكان واحد، بلا حدود اشتراكات</div>
      </div>
    </div>
  );
}
