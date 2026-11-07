"use client";

import type { Dispatch, SetStateAction } from "react";
import { Archive, Cloud, LogOut, Moon, Plug, RefreshCw, Settings2, ShieldCheck, Sun, Trash2, Zap } from "lucide-react";
import type { AccountUser, ConnectorInfo, Message, ServiceStatus } from "../lib/shared";

interface SettingsSectionProps {
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setConversations: Dispatch<SetStateAction<{ id: string; title: string; updatedAt: string; messages: Message[] }[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
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
  setConversations,
  setActiveId,
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
    <div className="section-page">
      <div className="section-hero">
        <div className="welcome-orb small"><div className="orb-core"><Settings2 size={26}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div>
        <div className="hero-copy">
          <div className="eyebrow"><span/> تجربتك على طريقتك</div>
          <h1>الإعدادات</h1>
          <p>تفضيلات الواجهة، الحساب، الموصلات والخصوصية. كل حاجة شفافة وتحت سيطرتك بالكامل.</p>
        </div>
      </div>
      <div className="settings-card">
        <div className="list-header"><div><h3>الحساب والذاكرة السحابية</h3><small className="card-sub">مزامنة بياناتك بين الأجهزة باستخدام Supabase Auth وRLS</small></div><span className={accountUser?"pill purple-pill":"pill warning-pill"}>{accountUser?"مسجل الدخول":"غير مسجل"}</span></div>
        {accountUser ? <>
          <div className="setting-row"><div className="setting-icon"><Cloud size={18}/></div><div className="setting-copy"><b>{accountUser.email}</b><small>الجلسة محفوظة لهذا التبويب فقط وتنتهي وفق إعدادات Supabase.</small></div><button className="secondary-btn" onClick={signOutAccount}><LogOut size={15}/> تسجيل الخروج</button></div>
          <div className="action-row"><button className="primary-btn" disabled={accountBusy} onClick={()=>void syncCloudMemory("save")}>حفظ في السحابة</button><button className="secondary-btn" disabled={accountBusy} onClick={()=>void syncCloudMemory("load")}>تحميل من السحابة</button></div>
        </> : <div className="auth-grid">
          <input aria-label="البريد الإلكتروني" type="email" autoComplete="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="البريد الإلكتروني"/>
          <input aria-label="كلمة المرور" type="password" autoComplete="current-password" value={accountPassword} onChange={e=>setAccountPassword(e.target.value)} placeholder="كلمة المرور (8 أحرف على الأقل)"/>
          <div className="action-row"><button className="primary-btn" disabled={accountBusy||!accountEmail.trim()||accountPassword.length<8} onClick={()=>void authenticateAccount("login")}>{accountBusy?"جارٍ التنفيذ…":"تسجيل الدخول"}</button><button className="secondary-btn" disabled={accountBusy||!accountEmail.trim()||accountPassword.length<8} onClick={()=>void authenticateAccount("signup")}>إنشاء حساب</button></div>
        </div>}
        {cloudMemoryStatus?<p role="status" className="status-line">{cloudMemoryStatus}</p>:null}
        <p className="hint-line">يتطلب هذا القسم ضبط NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY وتطبيق ملف supabase/migrations/20261029_meai_cloud_memory.sql. لا تُرفع البيانات تلقائيًا دون ضغطك على الحفظ.</p>
      </div>
      <div className="settings-card">
        <div className="list-header"><h3>الواجهة والخصوصية</h3></div>
        <div className="setting-row"><div className="setting-icon">{dark?<Moon size={18}/>:<Sun size={18}/>}</div><div className="setting-copy"><b>المظهر</b><small>بدّل بين الوضع الداكن والفاتح</small></div><button className="secondary-btn" onClick={()=>setDark(v=>!v)}>{dark?"الوضع الفاتح":"الوضع الداكن"}</button></div>
        <div className="setting-row"><div className="setting-icon"><ShieldCheck size={18}/></div><div className="setting-copy"><b>الخصوصية</b><small>البيانات محلية افتراضيًا؛ استخدم الحفظ السحابي اليدوي لمزامنتها بين الأجهزة</small></div><span className="pill">{accountUser?"سحابي يدوي":"محلي"}</span></div>
        <div className="setting-row"><div className="setting-icon"><Zap size={18}/></div><div className="setting-copy"><b>مزوّد الذكاء الاصطناعي</b><small>{serviceStatus?.configured ? "متصل: " + serviceStatus.provider + " — " + serviceStatus.model : "أضف مفاتيح المزوّد في إعدادات الاستضافة لتفعيل المحادثة"}</small></div><span className={"pill "+(serviceStatus?.configured?"purple-pill":"warning-pill")}>{serviceStatus ? (serviceStatus.configured?"مهيأ":"غير مهيأ") : "جارٍ الفحص"}</span></div>
        <div className="setting-row"><div className="setting-icon"><Archive size={18}/></div><div className="setting-copy"><b>مسح البيانات المحلية</b><small>حذف كل المحادثات والملفات والذاكرة من هذا المتصفح</small></div><button className="secondary-btn danger-btn" onClick={()=>{if(confirm("هل تريد مسح كل المحادثات والملفات والذاكرة المحلية؟")){setMessages([]);setConversations([]);setActiveId("");setFiles([]);setMemories([]);localStorage.removeItem("medhat-chat-v1");localStorage.removeItem("medhat-conversations-v1");localStorage.removeItem("medhat-active-chat-v1");localStorage.removeItem("medhat-files-v1");localStorage.removeItem("medhat-documents-v1");localStorage.removeItem("medhat-memory-v1");setNotice("تم مسح البيانات المحلية.");}}}><Trash2 size={15}/> مسح البيانات</button></div>
      </div>
      <div className="settings-card">
        <div className="list-header"><h3>حالة الموصلات</h3><button className="secondary-btn" onClick={()=>void refreshConnectors()}><RefreshCw size={14}/> تحديث الحالة</button></div>
        {connectors.length?connectors.map(connector=><div className="setting-row" key={connector.id}><div className="setting-icon"><Plug size={18}/></div><div className="setting-copy"><b>{connector.label}</b><small>{connector.detail}</small></div><span className={"pill "+(connector.connected?"purple-pill":"warning-pill")}>{connector.connected?"متصل ومتحقق":connector.configured?(connector.verified?"مهيأ فقط":"إعداد غير متحقق"):"غير مهيأ"}</span></div>):<div className="empty-inline">{connectorsChecked?"لم يتم إرجاع حالة الموصلات.":"جارٍ فحص الموصلات..."}</div>}
      </div>
      <div className="settings-card">
        <div className="list-header"><div><h3>Google Workspace</h3><small className="card-sub">قراءة ملفات Drive وأحداث التقويم عبر OAuth</small></div><span className={googleConnected?"pill purple-pill":"pill warning-pill"}>{googleConnected?"متصل":"غير مربوط"}</span></div>
        {googleConnected ? <div className="action-row"><button className="secondary-btn" disabled={googleBusy} onClick={()=>void runGoogleView("drive")}>عرض ملفات Drive</button><button className="secondary-btn" disabled={googleBusy} onClick={()=>void runGoogleView("calendar")}>عرض التقويم</button><button className="secondary-btn danger-btn" disabled={googleBusy} onClick={()=>void disconnectGoogle()}>فصل Google</button></div> : <div><a className="primary-btn" href="/api/integrations/google/start" style={{display:"inline-flex",textDecoration:"none"}}>ربط حساب Google</a><p className="hint-line">يتطلب إعداد OAuth في Google Cloud وإضافة رابط callback الموثوق على الخادم.</p></div>}
        {googleBusy?<p className="status-line">جارٍ تحميل البيانات…</p>:null}
        {googleStatusMessage?<p role="status" className="status-line">{googleStatusMessage}</p>:null}
        {googleView&&googleItems.length>0?<div className="trace-list">{googleItems.map((item,index)=>{const title=String(item.name||item.summary||"عنصر Google");const url=String(item.webViewLink||item.htmlLink||"");const start=item.start&&typeof item.start==="object"?String((item.start as Record<string,unknown>).dateTime||(item.start as Record<string,unknown>).date||""):"";const date=String(item.modifiedTime||start||"");return <div className="trace-item" key={String(item.id||index)}><div><b>{title}</b>{date?<small>{date}</small>:null}{url.startsWith("https://")?<a href={url} target="_blank" rel="noreferrer" style={{marginTop:4}}>فتح في Google</a>:null}</div></div>;})}</div>:googleView?<p className="status-line">لا توجد عناصر لعرضها.</p>:null}
      </div>
    </div>
  );
}
