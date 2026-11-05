"use client";

import type { Dispatch, SetStateAction } from "react";
import { Activity, Check, Layers3, Plus } from "lucide-react";
import type { TaskItem } from "../lib/shared";

interface TasksSectionProps {
  tasks: TaskItem[];
  setTasks: Dispatch<SetStateAction<TaskItem[]>>;
}

export default function TasksSection({
  tasks,
  setTasks,
}: TasksSectionProps) {
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon blue"><Layers3 size={22}/></div><div><div className="eyebrow">خططك في مكان واحد</div><h1>المهام</h1><p>تابع ما تعمل عليه وسجّل الإنجاز خطوة بخطوة.</p></div><button className="primary-btn heading-action" onClick={()=>{const t=window.prompt("اسم المهمة الجديدة");if(t?.trim())setTasks(v=>[...v,{title:t.trim(),done:false}]);}}><Plus size={16}/> مهمة جديدة</button></div><div className="metric-grid"><div className="metric-card"><span>إجمالي المهام</span><b>{tasks.length}</b><Layers3 size={18}/></div><div className="metric-card"><span>مكتملة</span><b>{tasks.filter(t=>t.done).length}</b><Check size={18}/></div><div className="metric-card"><span>قيد التنفيذ</span><b>{tasks.filter(t=>!t.done).length}</b><Activity size={18}/></div></div><div className="list-card"><div className="list-header"><h3>قائمة المهام</h3><span className="pill">محلية</span></div>{tasks.map((t,i)=><button key={i} className="task-row" onClick={()=>setTasks(old=>old.map((x,j)=>j===i?{...x,done:!x.done}:x))}><span className={`check-circle ${t.done?"checked":""}`}>{t.done&&<Check size={14}/>}</span><span className={t.done?"task-done":""}>{t.title}</span><span className={`task-status ${t.done?"done":""}`}>{t.done?"مكتملة":"مفتوحة"}</span></button>)}</div></div>
  );
}
