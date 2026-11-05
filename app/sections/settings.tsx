"use client";

import type { Dispatch, SetStateAction } from "react";
import { Archive, ChevronDown, Plug, Settings2, ShieldCheck, Zap, Sun, Trash2 } from "lucide-react";
import type { AccountUser, ConnectorInfo, Message, ServiceStatus } from "../lib/shared";

interface SettingsSectionProps {
  setMessages: Dispatch<SetStateAction<Message[]>>;
  files: string[];
  setFiles: Dispatch<SetStateAction<string[]>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setMemories: Dispatch<SetStateAction<string[]>>;
  accountUser: AccountUser | null;
  accountEmail: string;
  setAccountEmail: Dispatch<SetStateAction<string>>;
  accountPassword: string;
  setAccountPassword: Dispatch<SetStateAction<string>>;
  accountBusy: boolean;
  cloudMemoryStatus: string;
  signOutAccount: () => void;
  syncCloudMemory: (mode: "save" | "load") => Promise<void>;
  authenticateAccount: (action: "login" | "signup") => Promise<void>;
  dark: boolean;
  setDark: Dispatch<SetStateAction<boolean>>;
  serviceStatus: ServiceStatus | null;
  connectors: ConnectorInfo[];
  connectorsChecked: boolean;
  refreshConnectors: () => Promise<void>;
  googleConnected: boolean;
  googleBusy: boolean;
  googleView: "drive" | "calendar" | null;
  googleItems: Record<string, unknown>[];
  googleStatusMessage: string;
  runGoogleView: (view: "drive" | "calendar") => Promise<void>;
  disconnectGoogle: () => Promise<void>;
}

export default function SettingsSection({
  setMessages,
  files,
  setFiles,
  setNotice,
  setMemories,
  accountUser,
  accountEmail,
  setAccountEmail,
  accountPassword,
  setAccountPassword,
  accountBusy,
  cloudMemoryStatus,
  signOutAccount,
  syncCloudMemory,
  authenticateAccount,
  dark,
  setDark,
  serviceStatus,
  connectors,
  connectorsChecked,
  refreshConnectors,
  googleConnected,
  googleBusy,
  googleView,
  googleItems,
  googleStatusMessage,
  runGoogleView,
  disconnectGoogle,
}: SettingsSectionProps) {
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon blue"><Settings2 size={22}/></div><div><div className="eyebrow">تجربتك على طريقتك</div><h1>الإعدادات</h1><p>تفضيلات الواجهة والخصوصية.</p></div></div><div className="settings-card" style={{marginBottom:16,padding:16}}><div className="list-header" style={{padding:0,marginBottom:12}}><div><h3>الحساب والذاكرة السحابية</h3><small style={{opacity:.75}}>مزامنة بياناتك بين الأجهزة باستخدام Supabase Auth وRLS</small></div><span className={accountUser?"pill":"pill warning-pill"}>{accountUser?"مسجل الدخول":"غير مسجل"}</span></div>{accountUser?<><div className="setting-row" style={{padding:"10px 0"}}><div className="setting-copy"><b>{accountUser.email}</b><small>الجلسة محفوظة لهذا التبويب فقط، وتنتهي وفق إعدادات Supabase.</small></div><button className="secondary-btn" onClick={signOutAccount}>تسجيل الخروج</button></div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><button className="primary-btn" disabled={accountBusy} onClick={()=>void syncCloudMemory("save")}>حفظ في السحابة</button><button className="secondary-btn" disabled={accountBusy} onClick={()=>void syncCloudMemory("load")}>تحميل من السحابة</button></div></>:<><div style={{display:"grid",gap:10}}><input aria-label="البريد الإلكتروني" type="email" autoComplete="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="البريد الإلكتروني" style={{width:"100%",padding:12,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"inherit"}}/><input aria-label="كلمة المرور" type="password" autoComplete="current-password" value={accountPassword} onChange={e=>setAccountPassword(e.target.value)} placeholder="كلمة المرور (8 أحرف على الأقل)" style={{width:"100%",padding:12,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"inherit"}}/><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="primary-btn" disabled={accountBusy||!accountEmail.trim()||accountPassword.length<8} onClick={()=>void authenticateAccount("login")}>{accountBusy?"جارٍ التنفيذ…":"تسجيل الدخول"}</button><button className="secondary-btn" disabled={accountBusy||!accountEmail.trim()||accountPassword.length<8} onClick={()=>void authenticateAccount("signup")}>إنشاء حساب</button></div></div></>}{cloudMemoryStatus?<p role="status" style={{margin:"12px 0 0",fontSize:13,lineHeight:1.7}}>{cloudMemoryStatus}</p>:null}<p style={{margin:"12px 0 0",fontSize:12,opacity:.7,lineHeight:1.7}}>يتطلب هذا القسم ضبط NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY وتطبيق ملف supabase/migrations/20261029_meai_cloud_memory.sql. لا تُرفع البيانات تلقائيًا دون ضغطك على الحفظ.</p></div><div className="settings-card"><div className="setting-row"><div className="setting-icon"><Sun size={18}/></div><div className="setting-copy"><b>المظهر</b><small>التبديل بين الوضع الداكن والفاتح</small></div><button className="secondary-btn" onClick={()=>setDark(v=>!v)}>{dark?"داكن":"فاتح"} <ChevronDown size={14}/></button></div><div className="setting-row"><div className="setting-icon"><ShieldCheck size={18}/></div><div className="setting-copy"><b>الخصوصية</b><small>البيانات محلية افتراضيًا؛ استخدم الحفظ السحابي اليدوي لمزامنتها بين الأجهزة</small></div><span className="pill">{accountUser?"سحابي يدوي":"محلي"}</span></div><div className="setting-row"><div className="setting-icon"><Zap size={18}/></div><div className="setting-copy"><b>مزوّد الذكاء الاصطناعي</b><small>{serviceStatus?.configured ? `متصل: ${serviceStatus.provider} — ${serviceStatus.model}` : "أضف مفاتيح المزوّد في إعدادات الاستضافة لتفعيل المحادثة"}</small></div><span className={`pill ${serviceStatus?.configured ? "" : "warning-pill"}`}>{serviceStatus ? (serviceStatus.configured ? "مهيأ" : "غير مهيأ") : "جارٍ الفحص"}</span></div><div className="setting-row"><div className="setting-icon"><Archive size={18}/></div><div className="setting-copy"><b>مسح البيانات المحلية</b><small>حذف سجل المحادثة والملفات والذاكرة من هذا المتصفح</small></div><button className="secondary-btn danger-btn" onClick={()=>{if(confirm("هل تريد مسح المحادثة والملفات والذاكرة المحلية؟")){setMessages([]);setFiles([]);setMemories([]);localStorage.removeItem("medhat-chat-v1");localStorage.removeItem("medhat-files-v1");localStorage.removeItem("medhat-memory-v1");setNotice("تم مسح البيانات المحلية.");}}}><Trash2 size={15}/> مسح البيانات</button></div></div><div className="settings-card" style={{marginTop:16}}><div className="list-header" style={{padding:16}}><h3>حالة الموصلات</h3><button className="secondary-btn" onClick={()=>void refreshConnectors()}>تحديث الحالة</button></div>{connectors.length?connectors.map(connector=><div className="setting-row" key={connector.id}><div className="setting-icon"><Plug size={18}/></div><div className="setting-copy"><b>{connector.label}</b><small>{connector.detail}</small></div><span className={`pill ${connector.connected?"":"warning-pill"}`}>{connector.connected?"متصل ومتحقق":connector.configured?(connector.verified?"مهيأ فقط":"إعداد غير متحقق"):"غير مهيأ"}</span></div>):<div style={{padding:"0 16px 16px",opacity:.75}}>{connectorsChecked?"لم يتم إرجاع حالة الموصلات.":"جارٍ فحص الموصلات..."}</div>}</div><div className="settings-card" style={{marginTop:16,padding:16}}><div className="list-header" style={{padding:0,marginBottom:12}}><div><h3>Google Workspace</h3><small style={{opacity:.75}}>قراءة ملفات Drive وأحداث التقويم عبر OAuth</small></div><span className={googleConnected?"pill":"pill warning-pill"}>{googleConnected?"متصل":"غير مربوط"}</span></div>{googleConnected?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary-btn" disabled={googleBusy} onClick={()=>void runGoogleView("drive")}>عرض ملفات Drive</button><button className="secondary-btn" disabled={googleBusy} onClick={()=>void runGoogleView("calendar")}>عرض التقويم</button><button className="secondary-btn danger-btn" disabled={googleBusy} onClick={()=>void disconnectGoogle()}>فصل Google</button></div>:<div><a className="primary-btn" href="/api/integrations/google/start" style={{display:"inline-flex",textDecoration:"none",alignItems:"center",gap:8}}>ربط حساب Google</a><p style={{fontSize:12,opacity:.7,lineHeight:1.7,marginTop:10}}>يتطلب إعداد OAuth في Google Cloud وإضافة رابط callback الموثوق على الخادم.</p></div>}{googleBusy?<p style={{fontSize:13}}>جارٍ تحميل البيانات…</p>:null}{googleStatusMessage?<p role="status" style={{fontSize:13,lineHeight:1.7}}>{googleStatusMessage}</p>:null}{googleView&&googleItems.length>0?<div style={{display:"grid",gap:8,marginTop:12}}>{googleItems.map((item,index)=>{const title=String(item.name||item.summary||"عنصر Google");const url=String(item.webViewLink||item.htmlLink||"");const start=item.start&&typeof item.start==="object"?String((item.start as Record<string,unknown>).dateTime||(item.start as Record<string,unknown>).date||""):"";const date=String(item.modifiedTime||start||"");return <div key={String(item.id||index)} style={{padding:10,border:"1px solid var(--border)",borderRadius:10}}><b>{title}</b>{date?<small style={{display:"block",opacity:.7,marginTop:4}}>{date}</small>:null}{url.startsWith("https://")?<a href={url} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:5}}>فتح في Google</a>:null}</div>;})}</div>:googleView?<p style={{fontSize:13,opacity:.75}}>لا توجد عناصر لعرضها.</p>:null}</div></div>
  );
}
