"use client";

import { useState, type Dispatch, type SetStateAction, type FormEvent } from "react";
import { Activity, Check, Layers3, Plus, X } from "lucide-react";
import type { TaskItem } from "../lib/shared";

interface TasksSectionProps {
  tasks: TaskItem[];
  setTasks: Dispatch<SetStateAction<TaskItem[]>>;
}

export default function TasksSection({ tasks, setTasks }: TasksSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [error, setError] = useState("");

  function closeDialog() {
    setDialogOpen(false);
    setTaskTitle("");
    setError("");
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) {
      setError("اكتب اسم المهمة أولاً.");
      return;
    }
    setTasks(current => [...current, { title, done: false }]);
    closeDialog();
  }

  return (
    <div className="section-page">
      <div className="section-hero">
        <div className="welcome-orb small"><div className="orb-core"><Layers3 size={26}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div>
        <div className="hero-copy"><div className="eyebrow"><span/> خططك في مكان واحد</div><h1>المهام</h1><p>تابع ما تعمل عليه وسجّل الإنجاز خطوة بخطوة.</p></div>
        <button className="primary-btn hero-action" onClick={() => { setTaskTitle(""); setError(""); setDialogOpen(true); }}><Plus size={16}/> مهمة جديدة</button>
      </div>
      <div className="metric-grid">
        <div className="metric-card"><span>إجمالي المهام</span><b>{tasks.length}</b><Layers3 size={18}/></div>
        <div className="metric-card"><span>مكتملة</span><b>{tasks.filter(t=>t.done).length}</b><Check size={18}/></div>
        <div className="metric-card"><span>قيد التنفيذ</span><b>{tasks.filter(t=>!t.done).length}</b><Activity size={18}/></div>
      </div>
      <div className="list-card">
        <div className="list-header"><h3>قائمة المهام</h3><span className="pill">محلية</span></div>
        {tasks.length ? tasks.map((t,i)=><button key={i} className="task-row" onClick={()=>setTasks(old=>old.map((x,j)=>j===i?{...x,done:!x.done}:x))}><span className={`check-circle ${t.done?"checked":""}`}>{t.done&&<Check size={14}/>}</span><span className={t.done?"task-done":""}>{t.title}</span><span className={`task-status ${t.done?"done":""}`}>{t.done?"مكتملة":"مفتوحة"}</span></button>) : <div className="empty-card"><div className="empty-icon"><Layers3 size={19}/></div><b>لا توجد مهام حتى الآن</b><p>أضف أول مهمة وابدأ متابعة إنجازك.</p></div>}
      </div>

      {dialogOpen && (
        <div className="task-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
          <form className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onSubmit={addTask}>
            <div className="task-dialog-heading"><div><span className="task-dialog-icon"><Plus size={19}/></span><div><h2 id="task-dialog-title">إنشاء مهمة جديدة</h2><p>اكتب عنوانًا واضحًا للمهمة لتتمكن من متابعتها.</p></div></div><button type="button" className="icon-btn" aria-label="إغلاق" onClick={closeDialog}><X size={19}/></button></div>
            <label className="task-dialog-label" htmlFor="new-task-title">اسم المهمة</label>
            <input id="new-task-title" className="task-dialog-input" autoFocus maxLength={180} value={taskTitle} onChange={event => { setTaskTitle(event.target.value); if (error) setError(""); }} placeholder="مثال: مراجعة ملفات المشروع" />
            {error && <p className="task-dialog-error" role="alert">{error}</p>}
            <div className="task-dialog-actions"><button type="button" className="secondary-btn" onClick={closeDialog}>إلغاء</button><button type="submit" className="primary-btn"><Plus size={16}/> إضافة المهمة</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
