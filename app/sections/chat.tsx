"use client";

import { useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { Check, Copy, ExternalLink, Paperclip, Send, ShieldCheck, Sparkles } from "lucide-react";
import type { ChatMode, Message } from "../lib/shared";

interface ChatSectionProps {
  messages: Message[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  busy: boolean;
  endRef: RefObject<HTMLDivElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  pendingAttachments: {name:string;content:string;mimeType:string;size:number;extractionError?:string}[];
  setPendingAttachments: Dispatch<SetStateAction<{name:string;content:string;mimeType:string;size:number;extractionError?:string}[]>>;
  handleSend: (value?: string, mode?: ChatMode) => void | Promise<void>;
}

export default function ChatSection({
  messages,
  input,
  setInput,
  busy,
  endRef,
  fileRef,
  pendingAttachments,
  setPendingAttachments,
  handleSend,
}: ChatSectionProps) {
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <div className={"chat-page " + (messages.length ? "has-messages" : "")}>
      {messages.length === 0 ? (
        <div className="welcome-wrap">
          <div className="welcome-orb"><div className="orb-core"><Sparkles size={30}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div>
          <div className="eyebrow"><span/> مساحة الذكاء الاصطناعي الكاملة بتاعتك</div>
          <h1>أهلًا بيك، <em>مدحت</em></h1>
          <p className="welcome-sub">كل حاجة في مكان واحد: محادثة، بحث بمصادر، توليد صور، ووكيل ينفذ مهام كاملة. من غير حدود اشتراكات.</p>
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
                {m.sources && m.sources.length > 0 ? <div className="sources-grid">{m.sources.map((s, si) => <a className="source-card" key={s.url + si} href={s.url} target="_blank" rel="noopener noreferrer"><b>{s.title}</b><p>{s.snippet}</p><span className="source-host"><ExternalLink size={11}/>{s.source || (() => { try { return new URL(s.url).hostname } catch { return s.url } })()}</span>{s.sourceType ? <span className="source-host">نوع المصدر: {s.sourceType === "publisher" ? "ناشر صحفي/إخباري" : s.sourceType === "official" ? "مصدر رسمي" : s.sourceType === "social" ? "منصة اجتماعية" : "مصدر آخر"}</span> : null}{s.provider ? <span className="source-host">محرك البحث: {s.provider === "serper" ? "Google عبر Serper" : s.provider === "brave" ? "Brave Search" : "Tavily"}</span> : null}<span className="source-host">{s.date ? "تاريخ النشر: " + s.date : "تاريخ النشر غير متاح"}{s.contentStatus ? " · " + (s.contentStatus === "read" ? "تم استخراج نص الصفحة" : "المقتطف فقط") : ""}</span></a>)}</div> : null}
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
          {pendingAttachments.length > 0 ? <div className="attachment-list" aria-label="الملفات المرفقة">
            {pendingAttachments.map((file,index) => <div className="attachment-chip" key={file.name + index}>
              <Paperclip size={14}/><span>{file.name}</span><small>{file.content ? "تم استخراج النص" : (file.extractionError || "تعذر استخراج النص")}</small>
              <button type="button" onClick={() => setPendingAttachments(old => old.filter((_,i) => i !== index))} aria-label={"إزالة " + file.name}>×</button>
            </div>)}
          </div> : null}
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(input, "chat"); } }} placeholder="اكتب طلبك هنا... البحث والتنفيذ وإنشاء الصور يتم تلقائيًا حسب طلبك." rows={1}/>
          <div className="composer-toolbar">
            <div className="composer-tools">
              <button className="tool-btn" type="button" onClick={() => fileRef.current?.click()} aria-label="إرفاق ملف"><Paperclip size={19}/><span>إرفاق</span></button>
              
            </div>
            <div className="send-group"><button className="send-btn" onClick={() => void handleSend(input, "chat")} disabled={(!input.trim() && pendingAttachments.length === 0) || busy} aria-label="إرسال"><Send size={19}/></button></div>
          </div>
        </div>
        <div className="privacy-note"><ShieldCheck size={13}/> محادثة وبحث وصور ووكيل من مكان واحد، بلا حدود اشتراكات</div>
      </div>
    </div>
  );
}
