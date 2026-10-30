"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Archive, ArrowDown, ArrowUp, AudioLines, Bot, Check, ChevronDown, CircleHelp,
  Code2, Command, FileText, FolderOpen, Image as ImageIcon, Layers3, Menu, MessageCircle,
  MoreHorizontal, Paperclip, Plus, Plug, Search, Send, Settings2, ShieldCheck, Sparkles, SquarePen,
  Video, WandSparkles, X, Zap, Brain, Clock3, PanelLeftClose, PanelLeft, Sun, Moon, Trash2
} from "lucide-react";

type Section = "chat" | "research" | "agent" | "tasks" | "workspace" | "images" | "video" | "memory" | "settings";
type Message = { role: "user" | "assistant"; content: string; time: string };
const nav: { id: Section; label: string; icon: typeof MessageCircle; group: string }[] = [
  { id: "chat", label: "المحادثة", icon: MessageCircle, group: "الرئيسية" },
  { id: "research", label: "بحث الويب", icon: Search, group: "الرئيسية" },
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
  const [researchQuery, setResearchQuery] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchData, setResearchData] = useState<{title:string;url:string;snippet:string;date:string|null;position:number|null}[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{name:string;content:string;size:number;updatedAt:string}[]>([]);
  const [artifacts, setArtifacts] = useState<{filename:string;content:string;summary:string;createdAt:string}[]>([]);
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [tasks, setTasks] = useState<{title:string; done:boolean}[]>([
    { title: "مراجعة المشروع واكتشاف الأخطاء", done: false },
    { title: "تحسين واجهة Medhat AI", done: true },
  ]);
  const [memories, setMemories] = useState<string[]>([]);
  const [serviceStatus, setServiceStatus] = useState<{configured:boolean;provider:string|null;model:string|null;features?:{agentExecution:boolean;imageGeneration:boolean;videoGeneration:boolean;persistentCloudMemory:boolean}} | null>(null);
  const [connectors, setConnectors] = useState<{id:string;label:string;configured:boolean;connected:boolean;verified:boolean;mode:string;detail:string}[]>([]);
  const [connectorsChecked, setConnectorsChecked] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountToken, setAccountToken] = useState("");
  const [accountUser, setAccountUser] = useState<{id:string;email:string}|null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [cloudMemoryStatus, setCloudMemoryStatus] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleView, setGoogleView] = useState<"drive"|"calendar"|null>(null);
  const [googleItems, setGoogleItems] = useState<Record<string, unknown>[]>([]);
  const [googleStatusMessage, setGoogleStatusMessage] = useState("");
  const [agentTask, setAgentTask] = useState("");
  const [agentPlan, setAgentPlan] = useState<{summary:string;steps:string[];limitations:string[]} | null>(null);
  const [agentDone, setAgentDone] = useState<boolean[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentResult, setAgentResult] = useState("");
  const [agentSources, setAgentSources] = useState<{title:string;url:string;date?:string}[]>([]);
  const [agentTools, setAgentTools] = useState<string[]>([]);
  const [agentTrace, setAgentTrace] = useState<{tool:string;status:"success"|"unavailable"|"failed"|"skipped";detail:string}[]>([]);
  const [editPath, setEditPath] = useState("app/page.tsx");
  const [editInstruction, setEditInstruction] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState("python");
  const [codeInput, setCodeInput] = useState('print("Hello from MeAI sandbox")');
  const [codeOutput, setCodeOutput] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageAspect, setImageAspect] = useState("1:1");
  const [imageStyle, setImageStyle] = useState("واقعي");
  const [imageBusy, setImageBusy] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = useMemo(() => nav.find(n => n.id === section)!, [section]);

  useEffect(() => { try { const token = sessionStorage.getItem("meai-access-token") || ""; const user = sessionStorage.getItem("meai-account-user"); if (token && user) { setAccountToken(token); setAccountUser(JSON.parse(user) as {id:string;email:string}); } } catch {} }, []);
  useEffect(() => { setMessages(readMessages()); try { setDark(localStorage.getItem("medhat-theme") !== "light"); setFiles(JSON.parse(localStorage.getItem("medhat-files-v1") || "[]") as string[]); setDocuments(JSON.parse(localStorage.getItem("medhat-documents-v1") || "[]") as {name:string;content:string;size:number;updatedAt:string}[]); setArtifacts(JSON.parse(localStorage.getItem("medhat-artifacts-v1") || "[]") as {filename:string;content:string;summary:string;createdAt:string}[]); setMemories(JSON.parse(localStorage.getItem("medhat-memory-v1") || "[]") as string[]); setTasks(JSON.parse(localStorage.getItem("medhat-tasks-v1") || JSON.stringify([{title:"مراجعة المشروع واكتشاف الأخطاء",done:false},{title:"تحسين واجهة Medhat AI",done:true}])) as {title:string;done:boolean}[]); } catch {} }, []);
  useEffect(() => { fetch("/api/status", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (data) setServiceStatus(data); }).catch(() => setServiceStatus(null)); void refreshConnectors(); void refreshGoogleStatus(); }, []);
  async function refreshConnectors() { setConnectorsChecked(false); try { const response = await fetch("/api/integrations", { cache: "no-store" }); const data = await response.json(); setConnectors(Array.isArray(data.connectors) ? data.connectors : []); } catch { setConnectors([]); } finally { setConnectorsChecked(true); } }
  async function refreshGoogleStatus() { try { const response = await fetch("/api/integrations/google?view=status", {cache:"no-store"}); const data = await response.json(); setGoogleConnected(Boolean(response.ok && data.connected)); } catch { setGoogleConnected(false); } }
  async function runGoogleView(view: "drive"|"calendar") { if (googleBusy) return; setGoogleBusy(true); setGoogleStatusMessage(""); try { const response = await fetch(`/api/integrations/google?view=${view}`, {cache:"no-store"}); const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر تحميل بيانات Google."); const items = view === "drive" ? data.files : data.events; setGoogleItems(Array.isArray(items) ? items : []); setGoogleView(view); setGoogleStatusMessage(view === "drive" ? "تم جلب ملفات Google Drive للقراءة فقط." : "تم جلب أحداث التقويم القادمة للقراءة فقط."); setGoogleConnected(true); } catch (error) { setGoogleStatusMessage(error instanceof Error ? error.message : "حدث خطأ في Google."); if (error instanceof Error && /أعد ربط|غير مربوط|انتهت صلاحيته/.test(error.message)) setGoogleConnected(false); } finally { setGoogleBusy(false); } }
  async function disconnectGoogle() { try { await fetch("/api/integrations/google", {method:"DELETE"}); setGoogleConnected(false); setGoogleItems([]); setGoogleView(null); setGoogleStatusMessage("تم فصل Google عن هذا المتصفح."); } catch { setGoogleStatusMessage("تعذر فصل Google."); } }
  async function authenticateAccount(action: "login" | "signup") {
    if (accountBusy) return;
    setAccountBusy(true); setCloudMemoryStatus("");
    try {
      const response = await fetch("/api/account/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email: accountEmail, password: accountPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إتمام عملية الحساب.");
      if (!data.session?.access_token || !data.session?.user?.id) {
        setCloudMemoryStatus(data.message || "راجع بريدك الإلكتروني لتأكيد الحساب.");
        return;
      }
      const session = data.session as {access_token:string;user:{id:string;email:string}};
      setAccountToken(session.access_token); setAccountUser(session.user);
      sessionStorage.setItem("meai-access-token", session.access_token);
      sessionStorage.setItem("meai-account-user", JSON.stringify(session.user));
      setAccountPassword("");
      setCloudMemoryStatus("تم تسجيل الدخول. يمكنك الآن حفظ بياناتك في السحابة أو تحميلها على هذا الجهاز.");
    } catch (error) { setCloudMemoryStatus(error instanceof Error ? error.message : "حدث خطأ في الحساب."); }
    finally { setAccountBusy(false); }
  }
  async function syncCloudMemory(mode: "save" | "load") {
    if (!accountToken || accountBusy) return;
    setAccountBusy(true); setCloudMemoryStatus(mode === "save" ? "جارٍ حفظ البيانات في السحابة…" : "جارٍ تحميل البيانات من السحابة…");
    try {
      const payload = {
        version: 1,
        messages: messages.slice(-30).map(m => ({...m, content:m.content.slice(0,1000)})),
        tasks: tasks.slice(0, 30).map(t => ({...t, title:t.title.slice(0,180)})),
        memories: memories.slice(0, 30).map(m => m.slice(0,200)),
        documents: documents.slice(0, 5).map(d => ({...d, content:d.content.slice(0,2500)})),
        artifacts: artifacts.slice(0, 3).map(a => ({...a, content:a.content.slice(0,3500), summary:a.summary.slice(0,500)})),
      };
      const response = await fetch("/api/account/memory", {
        method: mode === "save" ? "PUT" : "GET",
        headers: { Authorization: `Bearer ${accountToken}`, ...(mode === "save" ? {"Content-Type":"application/json"} : {}) },
        ...(mode === "save" ? { body: JSON.stringify({payload}) } : {}),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذرت مزامنة البيانات.");
      if (mode === "load") {
        const remote = data.payload as Record<string, unknown> | null;
        if (!remote) { setCloudMemoryStatus("لا توجد نسخة سحابية محفوظة لهذا الحساب حتى الآن."); return; }
        if (Array.isArray(remote.messages)) { const value = remote.messages.filter((m): m is Message => Boolean(m && typeof m === "object" && ((m as Message).role === "user" || (m as Message).role === "assistant") && typeof (m as Message).content === "string" && typeof (m as Message).time === "string")).slice(-30); setMessages(value); localStorage.setItem("medhat-chat-v1", JSON.stringify(value)); }
        if (Array.isArray(remote.tasks)) { const value = remote.tasks.filter((x): x is {title:string;done:boolean} => Boolean(x && typeof x === "object" && typeof (x as {title?:unknown}).title === "string" && typeof (x as {done?:unknown}).done === "boolean")).slice(0,30); setTasks(value); localStorage.setItem("medhat-tasks-v1", JSON.stringify(value)); }
        if (Array.isArray(remote.memories)) { const value = remote.memories.filter((x): x is string => typeof x === "string").slice(0,30); setMemories(value); localStorage.setItem("medhat-memory-v1", JSON.stringify(value)); }
        if (Array.isArray(remote.documents)) { const value = remote.documents.filter((x): x is {name:string;content:string;size:number;updatedAt:string} => Boolean(x && typeof x === "object" && typeof (x as {name?:unknown}).name === "string" && typeof (x as {content?:unknown}).content === "string")).slice(0,5); setDocuments(value); setFiles(value.map(d => d.name)); localStorage.setItem("medhat-documents-v1", JSON.stringify(value)); localStorage.setItem("medhat-files-v1", JSON.stringify(value.map(d => d.name))); }
        if (Array.isArray(remote.artifacts)) { const value = remote.artifacts.filter((x): x is {filename:string;content:string;summary:string;createdAt:string} => Boolean(x && typeof x === "object" && typeof (x as {filename?:unknown}).filename === "string" && typeof (x as {content?:unknown}).content === "string" && typeof (x as {summary?:unknown}).summary === "string")).slice(0,3); setArtifacts(value); localStorage.setItem("medhat-artifacts-v1", JSON.stringify(value)); }
        setCloudMemoryStatus("تم تحميل النسخة السحابية إلى هذا الجهاز. البيانات المحلية الحالية استُبدلت بالعناصر الموجودة في النسخة.");
      } else setCloudMemoryStatus("تم حفظ المحادثات والمهام والذاكرة والملفات النصية في حسابك السحابي.");
    } catch (error) { setCloudMemoryStatus(error instanceof Error ? error.message : "حدث خطأ أثناء المزامنة."); }
    finally { setAccountBusy(false); }
  }
  function signOutAccount() {
    sessionStorage.removeItem("meai-access-token"); sessionStorage.removeItem("meai-account-user");
    setAccountToken(""); setAccountUser(null); setAccountPassword(""); setCloudMemoryStatus("تم تسجيل الخروج من هذا الجهاز. لم تُحذف البيانات السحابية.");
  }
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("medhat-tasks-v1", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("medhat-artifacts-v1", JSON.stringify(artifacts)); }, [artifacts]);
  useEffect(() => { try { const raw = localStorage.getItem("medhat-agent-plan-v1"); if (raw) { const saved = JSON.parse(raw) as {plan?:{summary:string;steps:string[];limitations:string[]};done?:boolean[]}; if (saved.plan && Array.isArray(saved.plan.steps)) { setAgentPlan(saved.plan); setAgentDone(saved.plan.steps.map((_,i)=>Boolean(saved.done?.[i]))); } } } catch {} }, []);
  useEffect(() => { if (typeof window !== "undefined" && agentPlan) localStorage.setItem("medhat-agent-plan-v1", JSON.stringify({plan:agentPlan,done:agentDone})); }, [agentPlan,agentDone]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("medhat-chat-v1", JSON.stringify(messages)); endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; if (typeof window !== "undefined") localStorage.setItem("medhat-theme", dark ? "dark" : "light"); }, [dark]);

  async function executeAgentTask() {
    const task = agentTask.trim();
    if (!task || agentBusy) return;
    setAgentBusy(true); setAgentResult(""); setAgentSources([]); setAgentTools([]); setAgentTrace([]); setNotice("");
    try {
      const response = await fetch("/api/agent/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, documents: documents.map(d => ({ name: d.name, content: d.content.slice(0, 5000) })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تنفيذ المهمة.");
      setAgentResult(data.answer || "");
      setAgentSources(Array.isArray(data.searchSources) ? data.searchSources.filter((item: unknown) => item && typeof item === "object" && typeof (item as {title?:unknown}).title === "string" && typeof (item as {url?:unknown}).url === "string") : []);
      setAgentTools(Array.isArray(data.toolsUsed) ? data.toolsUsed.filter((item: unknown) => typeof item === "string") : []);
      setAgentTrace(Array.isArray(data.toolTrace) ? data.toolTrace.filter((item: unknown) => item && typeof item === "object" && typeof (item as {tool?:unknown}).tool === "string" && typeof (item as {detail?:unknown}).detail === "string") : []);
      if (data.searchUsed) setNotice("تم استخدام بحث ويب؛ راجع روابط المصادر المرفقة أسفل النتيجة.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء تنفيذ المهمة.");
    } finally { setAgentBusy(false); }
  }

  async function runAgentCode() {\n    if (!codeInput.trim() || codeBusy) return;\n    if (!window.confirm("سيتم إرسال الكود إلى بيئة E2B سحابية معزولة لتنفيذه. لا تضع كلمات مرور أو مفاتيح API أو بيانات خاصة داخل الكود. هل تريد التشغيل؟")) return;\n    setCodeBusy(true); setCodeOutput("");\n    try {\n      const response = await fetch("/api/agent/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeInput, language: codeLanguage }) });\n      const data = await response.json();\n      if (!response.ok) throw new Error(data.error || "تعذر تشغيل الكود.");\n      setCodeOutput((data.output || "") + (data.error ? `\\n${data.error.name}: ${data.error.value}` : ""));\n    } catch (error) { setCodeOutput(error instanceof Error ? error.message : "حدث خطأ أثناء التشغيل."); }\n    finally { setCodeBusy(false); }\n  }\n\n  async function applyProjectEdit() {
    const path = editPath.trim();
    const instruction = editInstruction.trim();
    if (!path || !instruction || editBusy) return;
    if (!window.confirm(`سيقرأ MeAI الملف "${path}" ويقترح تعديلًا ثم يحفظه في GitHub بعد موافقتك الصريحة هنا. لن يتم تشغيل اختبارات تلقائيًا. هل توافق على تطبيق هذا التعديل؟`)) return;
    setEditBusy(true); setNotice("");
    try {
      const response = await fetch("/api/agent/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accountToken ? { Authorization: `Bearer ${accountToken}` } : {}) },
        body: JSON.stringify({ path, instruction, confirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تعديل الملف.");
      if (!data.changed) {
        setNotice(data.message || "لم يتم إجراء تعديل.");
      } else {
        setNotice(`تم حفظ تعديل ${data.path} في GitHub. Commit: ${String(data.commit || "").slice(0, 12)}. ${data.url || ""}`);
        setEditInstruction("");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تعديل الملف.");
    } finally { setEditBusy(false); }
  }

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
      setAgentPlan(data.plan); setAgentDone(data.plan.steps.map(() => false));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إعداد الخطة.");
    } finally { setAgentBusy(false); }
  }

  async function createAgentArtifact() {
    const task = agentTask.trim();
    if (!task || artifactBusy) return;
    setArtifactBusy(true); setNotice("");
    try {
      const requestTask = agentPlan ? task + "\n\nخطة المهمة:\n" + agentPlan.steps.join("\n") : task;
      const response = await fetch("/api/agent/artifact", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({task:requestTask,format:"markdown",documents:documents.map(d=>({name:d.name,content:d.content.slice(0,7000)}))}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الملف.");
      const a = data.artifact as {filename:string;content:string;summary:string};
      const next = [{...a, createdAt:new Date().toISOString()}, ...artifacts].slice(0,20);
      setArtifacts(next); localStorage.setItem("medhat-artifacts-v1", JSON.stringify(next));
      setNotice("تم إنشاء مسودة الملف وحفظها محليًا. لم يتم تشغيلها أو تعديل ملفات GitHub.");
      setSection("workspace");
    } catch (error) { setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الملف."); }
    finally { setArtifactBusy(false); }
  }
  function downloadArtifact(a:{filename:string;content:string}) {
    const url = URL.createObjectURL(new Blob([a.content], {type:"text/plain;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download=a.filename; link.click(); URL.revokeObjectURL(url);
  }

  async function runResearch() {
    const query=researchQuery.trim(); if(query.length<2||researchBusy) return;
    setResearchBusy(true); setNotice(""); setResearchData([]);
    try {
      const response=await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"تعذر البحث.");
      setResearchData(Array.isArray(data.results)?data.results:[]);
      if(!data.results?.length) setNotice("لم تظهر نتائج. جرّب عبارة بحث أدق.");
    } catch(e) { setNotice(e instanceof Error?e.message:"تعذر البحث حاليًا."); }
    finally { setResearchBusy(false); }
  }

  async function sendMessage(value = input) {
    const text = value.trim(); if (!text || busy) return;
    const now = () => new Date().toLocaleTimeString("ar-EG", {hour:"2-digit",minute:"2-digit"});
    const next: Message[] = [...messages, { role: "user", content: text, time: now() }, { role: "assistant", content: "", time: now() }];
    setMessages(next); setInput(""); setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages: next.slice(0,-1).map(m => ({role:m.role, content:m.content})), documents: documents.map(d => ({ name:d.name, content:d.content.slice(0,7000) })) }) });
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
  async function uploadFiles(list: FileList | null) {
    if (!list?.length) return;
    const supported = /\.(txt|md|csv|json|ya?ml|toml|html?|xml|js|jsx|ts|tsx|py|css|sql|log)$/i;
    const incoming = Array.from(list);
    const accepted = incoming.filter(file => supported.test(file.name) && file.size <= 200_000);
    const skipped = incoming.length - accepted.length;
    const parsed: {name:string;content:string;size:number;updatedAt:string}[] = [];
    for (const file of accepted) {
      try {
        const content = (await file.text()).slice(0, 20_000);
        parsed.push({name:file.name,content,size:file.size,updatedAt:new Date().toISOString()});
      } catch { /* ignore unreadable file */ }
    }
    const mergedDocs = [...documents.filter(d => !parsed.some(p => p.name === d.name)), ...parsed].slice(-12);
    try {
      localStorage.setItem("medhat-documents-v1", JSON.stringify(mergedDocs));
      const names = [...new Set([...files, ...incoming.map(file=>file.name)])].slice(-30);
      localStorage.setItem("medhat-files-v1", JSON.stringify(names));
      setDocuments(mergedDocs); setFiles(names);
      setNotice(`تمت قراءة محتوى ${parsed.length} ملف وحفظه على هذا الجهاز.${skipped ? ` تم تخطي ${skipped} ملف: الأنواع المدعومة نصية فقط وبحد أقصى 200KB للملف.` : ""}`);
    } catch {
      setNotice("مساحة التخزين المحلية ممتلئة. قلّل عدد الملفات أو أحجامها ثم أعد المحاولة.");
    }
  }
  function analyzeDocument(doc:{name:string;content:string}) {
    const prompt = `حلّل الملف التالي اعتمادًا على محتواه فقط. ابدأ بملخص، ثم أهم النقاط، والأخطاء أو المخاطر، وخطوات عملية مقترحة. إذا كان كودًا فراجع الأخطاء المحتملة دون ادعاء تشغيله.\nاسم الملف: ${doc.name}\n\n--- بداية المحتوى ---\n${doc.content.slice(0,12000)}\n--- نهاية المحتوى ---`;
    setSection("chat");
    void sendMessage(prompt);
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
        {section==="research"&&<div className="section-page"><div className="page-heading"><div className="page-icon blue"><Search size={22}/></div><div><div className="eyebrow">بحث عام عبر الويب</div><h1>ابحث في أي موضوع</h1><p>اعثر على صفحات ومراجع أولية، وافتح المصدر لمراجعة التفاصيل بنفسك.</p></div></div><form className="research-search" onSubmit={e=>{e.preventDefault();void runResearch();}}><input value={researchQuery} onChange={e=>setResearchQuery(e.target.value)} maxLength={300} minLength={2} placeholder="اكتب موضوع البحث أو سؤالًا..." aria-label="عبارة البحث"/><button className="primary-btn" type="submit" disabled={researchBusy||researchQuery.trim().length<2}>{researchBusy?<Activity size={16} className="spin"/>:<Search size={16}/>} {researchBusy?"جاري البحث":"ابحث"}</button></form><div className="research-note"><ShieldCheck size={16}/><span>النتائج مختصرات من محرك البحث وليست تحققًا مستقلًا. راجع المصدر وتاريخ النشر قبل الاعتماد عليها.</span></div>{researchData.length>0&&<div className="research-actions"><span className="pill">{researchData.length} نتائج</span><button className="primary-btn" type="button" disabled={busy} onClick={()=>{const evidence=researchData.map((r,i)=>`${i+1}. ${r.title}\n${r.date?`التاريخ: ${r.date}\n`:""}${r.snippet}\nالمصدر: ${r.url}`).join("\n\n");setSection("chat");void sendMessage(`حلّل نتائج البحث التالية للإجابة عن سؤالي: ${researchQuery}\n\nاكتب خلاصة واضحة، أهم النقاط، ما يتفق وما يختلف بين المصادر، وما لا يمكن الجزم به. اربط كل معلومة بمصدرها ورابطها، وميّز بين تاريخ النشر وتاريخ الحدث. لا تضف حقائق غير مدعومة بالمقتطفات، واذكر أن التحليل أولي لأن المحتوى الكامل للصفحات لم يُقرأ.\n\n${evidence}`);}}> <Sparkles size={16}/> حلّل النتائج بالمساعد</button></div>}<div className="research-results">{researchData.map((r,i)=><article className="list-card research-card" key={r.url+i}><div className="list-header"><span className="pill">نتيجة {r.position??i+1}</span>{r.date&&<small>{r.date}</small>}</div><h3><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a></h3><p>{r.snippet||"لا يوجد وصف متاح."}</p><a className="research-source" href={r.url} target="_blank" rel="noopener noreferrer">{(()=>{try{return new URL(r.url).hostname}catch{return r.url}})()} ↗</a></article>)}</div>{researchData.length===0&&!researchBusy&&<div className="empty-inline">ابدأ بكتابة موضوع للبحث. البحث متاح لأي مجال، وليس مجالًا واحدًا.</div>}</div>}
        {section==="chat"&&<div className={`chat-page ${messages.length?"has-messages":""}`}>
          {messages.length===0 ? <div className="welcome-wrap"><div className="welcome-orb"><div className="orb-core"><Sparkles size={30}/></div><i className="orb-ring ring-one"/><i className="orb-ring ring-two"/></div><div className="eyebrow"><span/> مساحة الذكاء الاصطناعي الخاصة بك</div><h1>أهلًا بيك، <em>مدحت</em></h1><p className="welcome-sub">أنا جاهز أساعدك تفكّر، تبرمج، تبحث، وتحوّل أفكارك لخطوات عملية.</p><div className="suggestion-grid">{suggestions.map(s=><button key={s.title} className="suggestion-card" onClick={()=>sendMessage(s.prompt)}><div className="suggestion-icon"><s.icon size={19}/></div><span>{s.title}</span><ArrowUp size={15}/></button>)}</div></div>
          : <div className="conversation">{messages.map((m,i)=><div className={`message-row ${m.role}`} key={i}><div className={`message-avatar ${m.role}`}>{m.role==="assistant"?<Sparkles size={17}/>:<span>م</span>}</div><div className="message-main"><div className="message-meta"><b>{m.role==="assistant"?"Medhat AI":"أنت"}</b><time>{m.time}</time></div><div className="message-text">{m.content}</div></div></div>)}{busy&&<div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={17}/></div><div className="typing"><i/><i/><i/> جاري التفكير</div></div>}<div ref={endRef}/></div>}
          <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage();}}} placeholder="اسأل Medhat AI أي حاجة..." rows={1}/><div className="composer-toolbar"><div className="composer-tools"><button className="tool-btn" onClick={()=>fileRef.current?.click()}><Paperclip size={17}/><span>إرفاق</span></button><button className="tool-btn" onClick={()=>changeSection("agent")}><Bot size={17}/><span>الوكيل</span></button><button className="tool-btn" onClick={()=>changeSection("workspace")}><FolderOpen size={17}/><span>الملفات</span></button></div><div className="send-group"><span className="model-pill"><Sparkles size={13}/> تلقائي <ChevronDown size={13}/></span><button className="send-btn" onClick={()=>void sendMessage()} disabled={!input.trim()||busy} aria-label="إرسال"><Send size={17}/></button></div></div></div><div className="privacy-note"><ShieldCheck size={13}/> راجع المعلومات المهمة قبل الاعتماد عليها</div></div>
        </div>}
        {section==="agent"&&<div className="section-page"><div className="page-heading"><div className="page-icon purple"><Bot size={22}/></div><div><div className="eyebrow">وكيل عام</div><h1>إيه اللي عايز تنجزه؟</h1><p>اكتب طلبك مباشرة؛ تحليل، كتابة، ترجمة، بحث، تلخيص أو مساعدة في الملفات.</p></div></div><div className="form-card"><label htmlFor="agent-task">المهمة</label><textarea id="agent-task" value={agentTask} onChange={e=>setAgentTask(e.target.value)} placeholder="مثال: ابحث عن أفضل الخيارات مع المصادر، حلّل الملف المرفق، اكتب خطة تسويق، أو ساعدني في مشكلة..." rows={5}/><div className="form-footer"><span><ShieldCheck size={14}/> ينجز الجزء المتاح ويصرّح بما يحتاج ربطًا خارجيًا</span><button className="primary-btn" disabled={agentBusy||!agentTask.trim()} onClick={()=>void executeAgentTask()}>{agentBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {agentBusy?"جاري تنفيذ المهمة…":"نفّذ المهمة"}</button></div></div>{agentResult?<div className="list-card"><div className="list-header"><h3>النتيجة</h3><button className="tool-btn" onClick={()=>{void navigator.clipboard?.writeText(agentResult);setNotice("تم نسخ النتيجة إذا سمح المتصفح.");}}>نسخ النتيجة</button></div><div className="agent-result" dir="auto" style={{whiteSpace:"pre-wrap",lineHeight:1.8,padding:"16px"}}>{agentResult}</div>{agentTools.length>0?<div style={{padding:"0 16px 12px",display:"flex",gap:6,flexWrap:"wrap"}}><span className="pill">الأدوات المستخدمة:</span>{agentTools.map(tool=><span className="pill" key={tool}>{tool==="web_search"?"بحث ويب":tool==="github_read"?"قراءة GitHub":tool==="file_analysis"?"تحليل ملفات":tool}</span>)}</div>:null}{agentTrace.length>0?<div style={{padding:"0 16px 12px"}}><b>حالة تنفيذ الأدوات</b><div style={{display:"grid",gap:8,marginTop:8}}>{agentTrace.map((item,index)=><div key={`${item.tool}-${index}`} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:13}}><span className="pill" style={{flexShrink:0}}>{item.status==="success"?"نجح":item.status==="unavailable"?"غير مهيأ":item.status==="failed"?"فشل":"لم يلزم"}</span><div><b>{item.tool==="web_search"?"بحث الويب":item.tool==="github_read"?"قراءة بيانات GitHub":item.tool==="github_source_read"?"قراءة ملفات المشروع":item.tool==="file_analysis"?"تحليل الملفات":item.tool}</b><div style={{opacity:.8,marginTop:2}}>{item.detail}</div></div></div>)}</div></div>:null}{agentSources.length>0?<div style={{padding:"0 16px 16px"}}><b>مصادر البحث</b><ul style={{margin:"8px 0",paddingInlineStart:22}}>{agentSources.map((source,index)=><li key={source.url+index} style={{marginBottom:6}}><a href={source.url} target="_blank" rel="noreferrer" style={{textDecoration:"underline",overflowWrap:"anywhere"}}>{source.title}</a>{source.date?<small style={{display:"block",opacity:.7}}>{source.date}</small>:null}</li>)}</ul></div>:null}<div className="form-footer"><button className="secondary-btn" onClick={()=>{setInput(agentResult);changeSection("chat");}}>متابعة في المحادثة</button><button className="primary-btn" onClick={()=>{const url=URL.createObjectURL(new Blob([agentResult],{type:"text/markdown;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="medhat-ai-result.md";link.click();URL.revokeObjectURL(url);}}>تنزيل النتيجة</button></div></div>:<div className="empty-card"><div className="empty-icon"><Bot size={22}/></div><b>الوكيل جاهز لاستقبال المهمة</b><p>مش لازم تكون المهمة برمجة. لو الطلب محتاج بحثًا حيًا، هيستخدم البحث عند تهيئة مفتاحه؛ وأي إجراء خارجي غير موصول هيقولك بوضوح.</p></div>}<div className="form-card"><h3>مختبر تشغيل الكود المعزول</h3><p>شغّل كودًا عامًا داخل Sandbox مؤقتة منفصلة عن خادم التطبيق. كل تشغيل ينشئ بيئة جديدة ثم يغلقها؛ لا تُشارك أسرارًا أو بيانات حساسة.</p><label htmlFor="code-language">لغة البرمجة</label><select id="code-language" value={codeLanguage} onChange={e=>setCodeLanguage(e.target.value)}><option value="python">Python</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="r">R</option><option value="java">Java</option><option value="bash">Bash</option></select><label htmlFor="agent-code">الكود</label><textarea id="agent-code" value={codeInput} onChange={e=>setCodeInput(e.target.value)} rows={8} spellCheck={false} dir="ltr" style={{fontFamily:"monospace",textAlign:"left"}}/><div className="form-footer"><span><ShieldCheck size={14}/> موافقة قبل كل تشغيل • 12 ثانية كحد أقصى</span><button className="primary-btn" disabled={codeBusy||!codeInput.trim()} onClick={()=>void runAgentCode()}>{codeBusy?<Activity size={16} className="spin"/>:<Zap size={16}/>} {codeBusy?"جاري التشغيل…":"شغّل الكود"}</button></div>{codeOutput?<pre dir="ltr" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:14,borderRadius:10,background:"var(--surface-2, #111827)",maxHeight:320,overflow:"auto"}}>{codeOutput}</pre>:null}</div><div className="form-card"><h3>تعديل ملف فعلي في المشروع</h3><p>حدد ملفًا موجودًا، واكتب التعديل المطلوب. لن يُحفظ أي تغيير قبل معاينته وموافقتك الصريحة.</p><label htmlFor="edit-path">مسار الملف</label><input id="edit-path" value={editPath} onChange={e=>setEditPath(e.target.value)} placeholder="app/page.tsx" /><label htmlFor="edit-instruction">التعديل المطلوب</label><textarea id="edit-instruction" value={editInstruction} onChange={e=>setEditInstruction(e.target.value)} placeholder="مثال: أضف معالجة واضحة لحالة الخطأ..." rows={3}/><div className="form-footer"><span><ShieldCheck size={14}/> تعديل مؤكد • ملفات التطبيق المسموحة فقط</span><button className="primary-btn" disabled={editBusy||!editPath.trim()||!editInstruction.trim()} onClick={()=>void applyProjectEdit()}>{editBusy?<Activity size={16} className="spin"/>:<Code2 size={16}/>} {editBusy?"جاري تعديل الملف…":"عدّل الملف في GitHub"}</button></div></div></div>}
        {section==="tasks"&&<div className="section-page"><div className="page-heading"><div className="page-icon blue"><Layers3 size={22}/></div><div><div className="eyebrow">خططك في مكان واحد</div><h1>المهام</h1><p>تابع ما تعمل عليه وسجّل الإنجاز خطوة بخطوة.</p></div><button className="primary-btn heading-action" onClick={()=>{const t=window.prompt("اسم المهمة الجديدة");if(t?.trim())setTasks(v=>[...v,{title:t.trim(),done:false}]);}}><Plus size={16}/> مهمة جديدة</button></div><div className="metric-grid"><div className="metric-card"><span>إجمالي المهام</span><b>{tasks.length}</b><Layers3 size={18}/></div><div className="metric-card"><span>مكتملة</span><b>{tasks.filter(t=>t.done).length}</b><Check size={18}/></div><div className="metric-card"><span>قيد التنفيذ</span><b>{tasks.filter(t=>!t.done).length}</b><Activity size={18}/></div></div><div className="list-card"><div className="list-header"><h3>قائمة المهام</h3><span className="pill">محلية</span></div>{tasks.map((t,i)=><button key={i} className="task-row" onClick={()=>setTasks(old=>old.map((x,j)=>j===i?{...x,done:!x.done}:x))}><span className={`check-circle ${t.done?"checked":""}`}>{t.done&&<Check size={14}/>}</span><span className={t.done?"task-done":""}>{t.title}</span><span className={`task-status ${t.done?"done":""}`}>{t.done?"مكتملة":"مفتوحة"}</span></button>)}</div></div>}
        {section==="workspace"&&<div className="section-page"><div className="page-heading"><div className="page-icon green"><FolderOpen size={22}/></div><div><div className="eyebrow">ملفاتك ومخرجاتك</div><h1>مساحة العمل</h1><p>اجمع ملفات المشروع والنتائج في مساحة منظمة.</p></div><button className="primary-btn heading-action" onClick={()=>fileRef.current?.click()}><Plus size={16}/> إضافة ملفات</button></div><div className="drop-zone" onClick={()=>fileRef.current?.click()}><div className="drop-icon"><Paperclip size={24}/></div><b>أضف ملفات إلى مساحة العمل</b><p>تُقرأ الملفات النصية المدعومة وتُحفظ محليًا على جهازك. PDF وDOCX والملفات الثنائية غير مدعومة حاليًا.</p><button className="secondary-btn"><FolderOpen size={15}/> تصفح الملفات</button></div><div className="list-card"><div className="list-header"><h3>مخرجات الوكيل</h3><span className="pill">{artifacts.length} ملف</span></div>{artifacts.length?artifacts.map((a,i)=><div className="file-row" key={a.createdAt+i}><div className="file-type"><FileText size={18}/></div><div style={{flex:1,minWidth:0}}><b>{a.filename}</b><p>{a.summary}</p><small>{new Date(a.createdAt).toLocaleString("ar-EG")}</small></div><button className="secondary-btn" onClick={async()=>{if(!confirm(`سيتم نشر "${a.filename}" داخل مجلد .medhat-workspace في مستودع MeAI على GitHub. إذا كان الملف موجودًا فسيتم تحديثه. هل تؤكد؟`))return;setNotice("جاري نشر الملف على GitHub...");try{const response=await fetch("/api/workspace/publish",{method:"POST",headers:{"Content-Type":"application/json",...(accountToken?{Authorization:`Bearer ${accountToken}`}:{})},body:JSON.stringify({filename:a.filename,content:a.content,confirmed:true})});const result=await response.json();if(!response.ok)throw new Error(result.error||"تعذر النشر.");setNotice(`تم ${result.operation==="updated"?"تحديث":"إضافة"} الملف للمشروع • ${result.commit}`); }catch(error){setNotice(error instanceof Error?error.message:"تعذر النشر.");}}}><Code2 size={15}/> إضافة للمشروع</button><button className="secondary-btn" onClick={()=>downloadArtifact(a)}>تنزيل</button><button className="icon-btn" aria-label="حذف المخرج" onClick={()=>setArtifacts(old=>old.filter((_,j)=>j!==i))}><Trash2 size={16}/></button></div>):<div className="empty-inline">الملفات التي ينشئها الوكيل ستظهر هنا ويمكن تنزيلها.</div>}</div><div className="list-card"><div className="list-header"><h3>الملفات المضافة</h3><span className="pill">{files.length} ملف</span></div>{files.length?files.map((f,i)=>{const doc=documents.find(d=>d.name===f);return <div className="file-row" key={f+i}><div className="file-type"><FileText size={18}/></div><div style={{flex:1,minWidth:0}}><b>{f}</b><p>{doc?`تمت قراءة المحتوى • ${Math.max(1,Math.ceil(doc.content.length/1000))} ألف حرف تقريبًا`:"اسم الملف فقط — أعد رفعه لقراءة المحتوى"}</p></div>{doc&&<button className="secondary-btn" onClick={()=>analyzeDocument(doc)}>تحليل بالذكاء الاصطناعي</button>}<button className="icon-btn" aria-label="حذف الملف" onClick={()=>{const n=files.filter((_,j)=>i!==j);const nd=documents.filter(d=>d.name!==f);setFiles(n);setDocuments(nd);localStorage.setItem("medhat-files-v1",JSON.stringify(n));localStorage.setItem("medhat-documents-v1",JSON.stringify(nd));}}><Trash2 size={16}/></button></div>}):<div className="empty-inline">لم تضف ملفات بعد.</div>}</div></div>}
        {section==="images"&&<div className="section-page"><div className="page-heading"><div className="page-icon pink"><ImageIcon size={22}/></div><div><div className="eyebrow">من الفكرة إلى الصورة</div><h1>توليد الصور</h1><p>إنشاء صورة عبر Cloudflare Workers AI عند تهيئة الحساب.</p></div></div><div className="creative-layout"><div className="form-card"><label>وصف الصورة</label><textarea value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} maxLength={1800} placeholder="صف المشهد، الأسلوب، الإضاءة، الألوان، والتفاصيل..."/><label>النمط الفني</label><div className="choice-row">{["واقعي","سينمائي","رسومي","أنمي"].map(x=><button key={x} type="button" className={imageStyle===x?"choice selected":"choice"} onClick={()=>setImageStyle(x)}>{x}</button>)}</div><label>نسبة الأبعاد</label><div className="choice-row">{["1:1","16:9","9:16"].map(x=><button key={x} type="button" className={imageAspect===x?"choice selected":"choice"} onClick={()=>setImageAspect(x)}>{x}</button>)}</div><button className="primary-btn full-btn" disabled={imageBusy||imagePrompt.trim().length<4} onClick={async()=>{setImageBusy(true);setNotice("");setGeneratedImage("");try{const r=await fetch("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:imagePrompt,aspect:imageAspect,style:imageStyle})});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر توليد الصورة.");setGeneratedImage(d.image);setNotice("تم إنشاء الصورة. يمكنك الضغط مطولًا عليها لحفظها.");}catch(e){setNotice(e instanceof Error?e.message:"تعذر توليد الصورة.");}finally{setImageBusy(false);}}}><WandSparkles size={16}/>{imageBusy?"جارٍ إنشاء الصورة…":"إنشاء صورة"}</button></div><div className="preview-placeholder">{generatedImage?<><img src={generatedImage} alt="الصورة التي تم توليدها" style={{width:"100%",height:"auto",borderRadius:16}}/><a href={generatedImage} download="medhat-ai-image.png">حفظ الصورة</a></>:<><div className="preview-glow"><ImageIcon size={36}/></div><b>{imageBusy?"جارٍ التوليد":"معاينة الصورة"}</b><p>{imageBusy?"قد يستغرق التوليد بعض الوقت.":"ستظهر النتيجة هنا بعد اكتمال التوليد."}</p></>}</div></div></div>}
        {section==="video"&&<div className="section-page"><div className="page-heading"><div className="page-icon orange"><Video size={22}/></div><div><div className="eyebrow">حرّك خيالك</div><h1>توليد الفيديو</h1><p>جهّز وصف المشهد وراجع حالة التوليد والنتيجة.</p></div></div><div className="creative-layout"><div className="form-card"><label>وصف الفيديو</label><textarea placeholder="اشرح المشهد وحركة الكاميرا والإضاءة ومدة الفيديو..."/><label>المدة</label><div className="choice-row"><button className="choice selected">5 ثوانٍ</button><button className="choice">10 ثوانٍ</button><button className="choice">15 ثانية</button></div><label>اتجاه الفيديو</label><div className="choice-row"><button className="choice">أفقي</button><button className="choice selected">عمودي</button><button className="choice">مربع</button></div><button className="primary-btn full-btn" onClick={()=>setNotice("واجهة الفيديو جاهزة؛ يلزم ربطها بخدمة الفيديو الحالية والتحقق من رصيد المزوّد.")}><Video size={16}/> بدء التوليد</button></div><div className="preview-placeholder video-preview"><div className="preview-glow"><Video size={36}/></div><b>معاينة الفيديو</b><p>حالة المهمة ونتيجة التوليد ستظهر هنا بعد التكامل.</p></div></div></div>}
        {section==="memory"&&<div className="section-page"><div className="page-heading"><div className="page-icon purple"><Brain size={22}/></div><div><div className="eyebrow">سياقك في متناولك</div><h1>الذاكرة</h1><p>إدارة معلومات تحفظها هذه الواجهة على هذا الجهاز فقط.</p></div><button className="primary-btn heading-action" onClick={addMemory}><Plus size={16}/> إضافة معلومة</button></div><div className="memory-callout"><ShieldCheck size={20}/><div><b>تحكم في بياناتك</b><p>المعلومات محلية افتراضيًا؛ يمكنك مزامنتها يدويًا من الإعدادات بعد ربط حسابك.</p></div></div><div className="list-card"><div className="list-header"><h3>المعلومات المحفوظة</h3><span className="pill">{memories.length}</span></div>{memories.length?memories.map((m,i)=><div className="memory-row" key={i}><Brain size={17}/><span>{m}</span><button className="icon-btn" onClick={()=>{const n=memories.filter((_,j)=>i!==j);setMemories(n);localStorage.setItem("medhat-memory-v1",JSON.stringify(n));}} aria-label="حذف"><Trash2 size={16}/></button></div>):<div className="empty-inline">لا توجد معلومات محفوظة محليًا.</div>}</div></div>}
        {section==="settings"&&<div className="section-page"><div className="page-heading"><div className="page-icon blue"><Settings2 size={22}/></div><div><div className="eyebrow">تجربتك على طريقتك</div><h1>الإعدادات</h1><p>تفضيلات الواجهة والخصوصية.</p></div></div><div className="settings-card" style={{marginBottom:16,padding:16}}><div className="list-header" style={{padding:0,marginBottom:12}}><div><h3>الحساب والذاكرة السحابية</h3><small style={{opacity:.75}}>مزامنة بياناتك بين الأجهزة باستخدام Supabase Auth وRLS</small></div><span className={accountUser?"pill":"pill warning-pill"}>{accountUser?"مسجل الدخول":"غير مسجل"}</span></div>{accountUser?<><div className="setting-row" style={{padding:"10px 0"}}><div className="setting-copy"><b>{accountUser.email}</b><small>الجلسة محفوظة لهذا التبويب فقط، وتنتهي وفق إعدادات Supabase.</small></div><button className="secondary-btn" onClick={signOutAccount}>تسجيل الخروج</button></div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><button className="primary-btn" disabled={accountBusy} onClick={()=>void syncCloudMemory("save")}>حفظ في السحابة</button><button className="secondary-btn" disabled={accountBusy} onClick={()=>void syncCloudMemory("load")}>تحميل من السحابة</button></div></>:<><div style={{display:"grid",gap:10}}><input aria-label="البريد الإلكتروني" type="email" autoComplete="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="البريد الإلكتروني" style={{width:"100%",padding:12,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"inherit"}}/><input aria-label="كلمة المرور" type="password" autoComplete="current-password" value={accountPassword} onChange={e=>setAccountPassword(e.target.value)} placeholder="كلمة المرور (8 أحرف على الأقل)" style={{width:"100%",padding:12,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"inherit"}}/><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="primary-btn" disabled={accountBusy||!accountEmail.trim()||accountPassword.length<8} onClick={()=>void authenticateAccount("login")}>{accountBusy?"جارٍ التنفيذ…":"تسجيل الدخول"}</button><button className="secondary-btn" disabled={accountBusy||!accountEmail.trim()||accountPassword.length<8} onClick={()=>void authenticateAccount("signup")}>إنشاء حساب</button></div></div></>}{cloudMemoryStatus?<p role="status" style={{margin:"12px 0 0",fontSize:13,lineHeight:1.7}}>{cloudMemoryStatus}</p>:null}<p style={{margin:"12px 0 0",fontSize:12,opacity:.7,lineHeight:1.7}}>يتطلب هذا القسم ضبط NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY وتطبيق ملف supabase/migrations/20261029_meai_cloud_memory.sql. لا تُرفع البيانات تلقائيًا دون ضغطك على الحفظ.</p></div><div className="settings-card"><div className="setting-row"><div className="setting-icon"><Sun size={18}/></div><div className="setting-copy"><b>المظهر</b><small>التبديل بين الوضع الداكن والفاتح</small></div><button className="secondary-btn" onClick={()=>setDark(v=>!v)}>{dark?"داكن":"فاتح"} <ChevronDown size={14}/></button></div><div className="setting-row"><div className="setting-icon"><ShieldCheck size={18}/></div><div className="setting-copy"><b>الخصوصية</b><small>البيانات محلية افتراضيًا؛ استخدم الحفظ السحابي اليدوي لمزامنتها بين الأجهزة</small></div><span className="pill">{accountUser?"سحابي يدوي":"محلي"}</span></div><div className="setting-row"><div className="setting-icon"><Zap size={18}/></div><div className="setting-copy"><b>مزوّد الذكاء الاصطناعي</b><small>{serviceStatus?.configured ? `متصل: ${serviceStatus.provider} — ${serviceStatus.model}` : "أضف مفاتيح المزوّد في إعدادات الاستضافة لتفعيل المحادثة"}</small></div><span className={`pill ${serviceStatus?.configured ? "" : "warning-pill"}`}>{serviceStatus ? (serviceStatus.configured ? "مهيأ" : "غير مهيأ") : "جارٍ الفحص"}</span></div><div className="setting-row"><div className="setting-icon"><Archive size={18}/></div><div className="setting-copy"><b>مسح البيانات المحلية</b><small>حذف سجل المحادثة والملفات والذاكرة من هذا المتصفح</small></div><button className="secondary-btn danger-btn" onClick={()=>{if(confirm("هل تريد مسح المحادثة والملفات والذاكرة المحلية؟")){setMessages([]);setFiles([]);setMemories([]);localStorage.removeItem("medhat-chat-v1");localStorage.removeItem("medhat-files-v1");localStorage.removeItem("medhat-memory-v1");setNotice("تم مسح البيانات المحلية.");}}}><Trash2 size={15}/> مسح البيانات</button></div></div><div className="settings-card" style={{marginTop:16}}><div className="list-header" style={{padding:16}}><h3>حالة الموصلات</h3><button className="secondary-btn" onClick={()=>void refreshConnectors()}>تحديث الحالة</button></div>{connectors.length?connectors.map(connector=><div className="setting-row" key={connector.id}><div className="setting-icon"><Plug size={18}/></div><div className="setting-copy"><b>{connector.label}</b><small>{connector.detail}</small></div><span className={`pill ${connector.connected?"":"warning-pill"}`}>{connector.connected?"متصل ومتحقق":connector.configured?(connector.verified?"مهيأ فقط":"إعداد غير متحقق"):"غير مهيأ"}</span></div>):<div style={{padding:"0 16px 16px",opacity:.75}}>{connectorsChecked?"لم يتم إرجاع حالة الموصلات.":"جارٍ فحص الموصلات..."}</div>}</div><div className="settings-card" style={{marginTop:16,padding:16}}><div className="list-header" style={{padding:0,marginBottom:12}}><div><h3>Google Workspace</h3><small style={{opacity:.75}}>قراءة ملفات Drive وأحداث التقويم عبر OAuth</small></div><span className={googleConnected?"pill":"pill warning-pill"}>{googleConnected?"متصل":"غير مربوط"}</span></div>{googleConnected?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary-btn" disabled={googleBusy} onClick={()=>void runGoogleView("drive")}>عرض ملفات Drive</button><button className="secondary-btn" disabled={googleBusy} onClick={()=>void runGoogleView("calendar")}>عرض التقويم</button><button className="secondary-btn danger-btn" disabled={googleBusy} onClick={()=>void disconnectGoogle()}>فصل Google</button></div>:<div><a className="primary-btn" href="/api/integrations/google/start" style={{display:"inline-flex",textDecoration:"none",alignItems:"center",gap:8}}>ربط حساب Google</a><p style={{fontSize:12,opacity:.7,lineHeight:1.7,marginTop:10}}>يتطلب إعداد OAuth في Google Cloud وإضافة رابط callback الموثوق على الخادم.</p></div>}{googleBusy?<p style={{fontSize:13}}>جارٍ تحميل البيانات…</p>:null}{googleStatusMessage?<p role="status" style={{fontSize:13,lineHeight:1.7}}>{googleStatusMessage}</p>:null}{googleView&&googleItems.length>0?<div style={{display:"grid",gap:8,marginTop:12}}>{googleItems.map((item,index)=>{const title=String(item.name||item.summary||"عنصر Google");const url=String(item.webViewLink||item.htmlLink||"");const start=item.start&&typeof item.start==="object"?String((item.start as Record<string,unknown>).dateTime||(item.start as Record<string,unknown>).date||""):"";const date=String(item.modifiedTime||start||"");return <div key={String(item.id||index)} style={{padding:10,border:"1px solid var(--border)",borderRadius:10}}><b>{title}</b>{date?<small style={{display:"block",opacity:.7,marginTop:4}}>{date}</small>:null}{url.startsWith("https://")?<a href={url} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:5}}>فتح في Google</a>:null}</div>;})}</div>:googleView?<p style={{fontSize:13,opacity:.75}}>لا توجد عناصر لعرضها.</p>:null}</div></div>}
      </div>
      {notice&&<div className="toast"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="إغلاق"><X size={16}/></button></div>}
      <input ref={fileRef} type="file" multiple hidden onChange={e=>uploadFiles(e.target.files)}/>
      {section!=="chat"&&<footer className="app-footer">Medhat AI <span>•</span> واجهة تجريبية متجاوبة <span>•</span> التكاملات الخلفية تُفعّل تدريجيًا</footer>}
    </section>
    <nav className="mobile-bottom-nav">{nav.filter(n=>["chat","agent","tasks","workspace","images"].includes(n.id)).map(n=><button key={n.id} className={section===n.id?"selected":""} onClick={()=>changeSection(n.id)}><n.icon size={19}/><span>{n.label==="توليد الصور"?"الصور":n.label==="مساحة العمل"?"الملفات":n.label==="الوكيل الذكي"?"الوكيل":n.label}</span></button>)}<button onClick={()=>setMobileNavOpen(v=>!v)}><Menu size={19}/><span>المزيد</span></button></nav>
  </main>;
}
