"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, ShieldCheck, Brain, Trash2 } from "lucide-react";

interface MemorySectionProps {
  memories: string[];
  setMemories: Dispatch<SetStateAction<string[]>>;
  addMemory: () => void;
}

export default function MemorySection({
  memories,
  setMemories,
  addMemory,
}: MemorySectionProps) {
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon purple"><Brain size={22}/></div><div><div className="eyebrow">سياقك في متناولك</div><h1>الذاكرة</h1><p>إدارة معلومات تحفظها هذه الواجهة على هذا الجهاز فقط.</p></div><button className="primary-btn heading-action" onClick={addMemory}><Plus size={16}/> إضافة معلومة</button></div><div className="memory-callout"><ShieldCheck size={20}/><div><b>تحكم في بياناتك</b><p>المعلومات محلية افتراضيًا؛ يمكنك مزامنتها يدويًا من الإعدادات بعد ربط حسابك.</p></div></div><div className="list-card"><div className="list-header"><h3>المعلومات المحفوظة</h3><span className="pill">{memories.length}</span></div>{memories.length?memories.map((m,i)=><div className="memory-row" key={i}><Brain size={17}/><span>{m}</span><button className="icon-btn" onClick={()=>{const n=memories.filter((_,j)=>i!==j);setMemories(n);localStorage.setItem("medhat-memory-v1",JSON.stringify(n));}} aria-label="حذف"><Trash2 size={16}/></button></div>):<div className="empty-inline">لا توجد معلومات محفوظة محليًا.</div>}</div></div>
  );
}
