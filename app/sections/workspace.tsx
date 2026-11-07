"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { Code2, FileText, FolderOpen, Paperclip, Plus, Trash2 } from "lucide-react";
import type { AgentArtifact, WorkspaceDocument } from "../lib/shared";

interface WorkspaceSectionProps {
  fileRef: RefObject<HTMLInputElement | null>;
  artifacts: AgentArtifact[];
  setArtifacts: Dispatch<SetStateAction<AgentArtifact[]>>;
  files: string[];
  setFiles: Dispatch<SetStateAction<string[]>>;
  documents: WorkspaceDocument[];
  setDocuments: Dispatch<SetStateAction<WorkspaceDocument[]>>;
  downloadArtifact: (a: { filename: string; content: string }) => void;
  analyzeDocument: (doc: { name: string; content: string }) => void;
  accountToken: string;
  setNotice: Dispatch<SetStateAction<string>>;
}

export default function WorkspaceSection({
  fileRef,
  artifacts,
  setArtifacts,
  files,
  setFiles,
  documents,
  setDocuments,
  downloadArtifact,
  analyzeDocument,
  accountToken,
  setNotice,
}: WorkspaceSectionProps) {
  return (
    <div className="section-page"><div className="section-hero"><div className="welcome-orb small"><div className="orb-core"><FolderOpen size={26}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div><div className="hero-copy"><div className="eyebrow"><span/> ملفاتك ومخرجاتك</div><h1>مساحة العمل</h1><p>اجمع ملفات المشروع والنتائج في مساحة منظمة.</p></div><button className="primary-btn hero-action" onClick={()=>fileRef.current?.click()}><Plus size={16}/> إضافة ملفات</button></div><div className="drop-zone" onClick={()=>fileRef.current?.click()}><div className="drop-icon"><Paperclip size={24}/></div><b>أضف ملفات إلى مساحة العمل</b><p>تُقرأ الملفات النصية المدعومة وتُحفظ محليًا على جهازك. PDF وDOCX والملفات الثنائية غير مدعومة حاليًا.</p><button className="secondary-btn"><FolderOpen size={15}/> تصفح الملفات</button></div><div className="list-card"><div className="list-header"><h3>مخرجات الوكيل</h3><span className="pill">{artifacts.length} ملف</span></div>{artifacts.length?artifacts.map((a,i)=><div className="file-row" key={a.createdAt+i}><div className="file-type"><FileText size={18}/></div><div style={{flex:1,minWidth:0}}><b>{a.filename}</b><p>{a.summary}</p><small>{new Date(a.createdAt).toLocaleString("ar-EG")}</small></div><button className="secondary-btn" onClick={async()=>{if(!confirm(`سيتم نشر "${a.filename}" داخل مجلد .medhat-workspace في مستودع MeAI على GitHub. إذا كان الملف موجودًا فسيتم تحديثه. هل تؤكد؟`))return;setNotice("جاري نشر الملف على GitHub...");try{const response=await fetch("/api/workspace/publish",{method:"POST",headers:{"Content-Type":"application/json",...(accountToken?{Authorization:`Bearer ${accountToken}`}:{})},body:JSON.stringify({filename:a.filename,content:a.content,confirmed:true})});const result=await response.json();if(!response.ok)throw new Error(result.error||"تعذر النشر.");setNotice(`تم ${result.operation==="updated"?"تحديث":"إضافة"} الملف للمشروع • ${result.commit}`); }catch(error){setNotice(error instanceof Error?error.message:"تعذر النشر.");}}}><Code2 size={15}/> إضافة للمشروع</button><button className="secondary-btn" onClick={()=>downloadArtifact(a)}>تنزيل</button><button className="icon-btn" aria-label="حذف المخرج" onClick={()=>setArtifacts(old=>old.filter((_,j)=>j!==i))}><Trash2 size={16}/></button></div>):<div className="empty-inline">الملفات التي ينشئها الوكيل ستظهر هنا ويمكن تنزيلها.</div>}</div><div className="list-card"><div className="list-header"><h3>الملفات المضافة</h3><span className="pill">{files.length} ملف</span></div>{files.length?files.map((f,i)=>{const doc=documents.find(d=>d.name===f);return <div className="file-row" key={f+i}><div className="file-type"><FileText size={18}/></div><div style={{flex:1,minWidth:0}}><b>{f}</b><p>{doc?`تمت قراءة المحتوى • ${Math.max(1,Math.ceil(doc.content.length/1000))} ألف حرف تقريبًا`:"اسم الملف فقط — أعد رفعه لقراءة المحتوى"}</p></div>{doc&&<button className="secondary-btn" onClick={()=>analyzeDocument(doc)}>تحليل بالذكاء الاصطناعي</button>}<button className="icon-btn" aria-label="حذف الملف" onClick={()=>{const n=files.filter((_,j)=>i!==j);const nd=documents.filter(d=>d.name!==f);setFiles(n);setDocuments(nd);localStorage.setItem("medhat-files-v1",JSON.stringify(n));localStorage.setItem("medhat-documents-v1",JSON.stringify(nd));}}><Trash2 size={16}/></button></div>}):<div className="empty-inline">لم تضف ملفات بعد.</div>}</div></div>
  );
}
