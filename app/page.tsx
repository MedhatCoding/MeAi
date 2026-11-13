"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleHelp, Menu, MessageCircle, MoreHorizontal, ShieldCheck, Sparkles, SquarePen, Trash2, X, PanelLeftClose, PanelLeft, Sun, Moon } from "lucide-react";
import { nav, readConversations } from "./lib/shared";
import type { AgentSource, AgentTraceItem, ChatMode, Message, ResearchResult, Section } from "./lib/shared";
import AgentSection from "./sections/agent";
import ChatSection from "./sections/chat";
import ImagesSection from "./sections/images";
import MemorySection from "./sections/memory";
import ResearchSection from "./sections/research";
import SettingsSection from "./sections/settings";
import TasksSection from "./sections/tasks";
import VideoSection from "./sections/video";
import WorkspaceSection from "./sections/workspace";


export default function Home() {
  const [section, setSection] = useState<Section>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: string; messages: Message[] }[]>([]);
  const [activeId, setActiveId] = useState("");
  const [composerMode, setComposerMode] = useState<ChatMode>("chat");
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
  useEffect(() => {
    const convs = readConversations();
    setConversations(convs);
    const savedActive = localStorage.getItem("medhat-active-chat-v1") || "";
    const active = convs.find(c => c.id === savedActive) || convs[0];
    if (active) { setActiveId(active.id); setMessages(active.messages); }
    try { setDark(localStorage.getItem("medhat-theme") !== "light"); setFiles(JSON.parse(localStorage.getItem("medhat-files-v1") || "[]") as string[]); setDocuments(JSON.parse(localStorage.getItem("medhat-documents-v1") || "[]") as {name:string;content:string;size:number;updatedAt:string}[]); setArtifacts(JSON.parse(localStorage.getItem("medhat-artifacts-v1") || "[]") as {filename:string;content:string;summary:string;createdAt:string}[]); setMemories(JSON.parse(localStorage.getItem("medhat-memory-v1") || "[]") as string[]); setTasks(JSON.parse(localStorage.getItem("medhat-tasks-v1") || JSON.stringify([{title:"مراجعة المشروع واكتشاف الأخطاء",done:false},{title:"تحسين واجهة Medhat AI",done:true}])) as {title:string;done:boolean}[]); } catch {} }, []);
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
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("medhat-chat-v1", JSON.stringify(messages));
    if (activeId) {
      const idx = conversations.findIndex(c => c.id === activeId);
      if (idx !== -1) {
        const title = conversations[idx].title || (messages.find(m => m.role === "user")?.content.slice(0, 42) ?? "");
        const next = conversations.slice();
        next[idx] = { ...conversations[idx], title, updatedAt: new Date().toISOString(), messages };
        setConversations(next);
        if (!busy) persistConversations(next);
      }
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; if (typeof window !== "undefined") localStorage.setItem("medhat-theme", dark ? "dark" : "light"); }, [dark]);

  async function executeAgentTask() {
    const task = agentTask.trim();
    if (!task || agentBusy) return;
    setAgentBusy(true); setAgentResult(""); setAgentSources([]); setAgentTools([]); setAgentTrace([]); setNotice("");
    try {
      const response = await fetch("/api/agent/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, documents: documents.map(d => ({ name: d.name, content: d.content.slice(0, 40000) })) }),
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

  async function runAgentCode() {
    if (!codeInput.trim() || codeBusy) return;
    if (!window.confirm("سيتم إرسال الكود إلى بيئة E2B سحابية معزولة لتنفيذه. لا تضع كلمات مرور أو مفاتيح API أو بيانات خاصة داخل الكود. هل تريد التشغيل؟")) return;
    setCodeBusy(true); setCodeOutput("");
    try {
      const response = await fetch("/api/agent/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeInput, language: codeLanguage }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تشغيل الكود.");
      setCodeOutput((data.output || "") + (data.error ? `\
${data.error.name}: ${data.error.value}` : ""));
    } catch (error) { setCodeOutput(error instanceof Error ? error.message : "حدث خطأ أثناء التشغيل."); }
    finally { setCodeBusy(false); }
  }

  async function applyProjectEdit() {
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
      const response = await fetch("/api/agent/artifact", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({task:requestTask,format:"markdown",documents:documents.map(d=>({name:d.name,content:d.content.slice(0,20000)}))}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الملف.");
      const a = data.artifact as {filename:string;content:string;summary:string};
      const next = [{...a, createdAt:new Date().toISOString()}, ...artifacts].slice(0,50);
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
    const stamp = () => new Date().toLocaleTimeString("ar-EG", {hour:"2-digit",minute:"2-digit"});
    const next: Message[] = [...messages, { role: "user", content: text, time: stamp() }, { role: "assistant", content: "", time: stamp() }];
    setMessages(next); setInput(""); setBusy(true); setNotice("");
    await streamInto(next.slice(0, -1), "");
  }

  async function streamInto(history: Message[], prefix: string) {
    let answer = "";
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages: history.map(m => ({role:m.role, content:m.content})), documents: documents.map(d => ({ name:d.name, content:d.content.slice(0,20000) })) }) });
      if (!res.ok) {
        let detail = "فشل الاتصال بخدمة الذكاء الاصطناعي.";
        try { const data = await res.json() as {error?:string}; if (data.error) detail = data.error; } catch {}
        throw new Error(detail);
      }
      if (!res.body) throw new Error("المزوّد لم يفتح تدفق الإجابة.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
                const text = prefix + answer;
                setMessages(old => old.map((m,i) => i === old.length-1 ? {...m, content:text} : m));
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
    }
  }

  async function handleSend(value = input, mode = composerMode) {
    const text = value.trim();
    if (!text || busy) return;
    if (mode === "chat") { await sendMessage(text); return; }
    const stamp = () => new Date().toLocaleTimeString("ar-EG", {hour:"2-digit",minute:"2-digit"});
    const next: Message[] = [...messages, { role: "user", content: text, time: stamp() }, { role: "assistant", content: "", time: stamp() }];
    setMessages(next); setInput(""); setBusy(true); setNotice("");
    const patchLast = (patch: Partial<Message>) => setMessages(old => old.map((m,i) => i === old.length-1 ? { ...m, ...patch } : m));
    try {
      if (mode === "image") {
        patchLast({ content: "جارٍ توليد الصورة..." });
        const res = await fetch("/api/images/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ prompt: text, aspect: "1:1", style: "واقعي" }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذر توليد الصورة.");
        patchLast({ content: "اتفضل الصورة المولّدة. تحب أعدّل فيها أي تفاصيل؟", image: String(data.image || "") });
      } else if (mode === "research") {
        patchLast({ content: "جارٍ البحث على الويب..." });
        const res = await fetch("/api/search", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ query: text }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذر البحث.");
        const results = Array.isArray(data.results) ? data.results as ResearchResult[] : [];
        if (!results.length) { patchLast({ content: "لم أجد نتائج لهذا البحث. جرّب صياغة أدق أو كلمات مفتاحية أوضح." }); return; }
        patchLast({ sources: results });
        const evidence = results.map((r, i) => String(i+1) + ". " + r.title + "\n" + (r.date ? "التاريخ: " + r.date + "\n" : "") + (r.snippet || "") + "\nالمصدر: " + r.url).join("\n\n");
        const enriched = text + "\n\nحلّل نتائج البحث التالية وأجب عن طلبي بخلاصة واضحة مع ربط كل معلومة بمصدرها ورابطها. لا تضف حقائق غير مدعومة بالمقتطفات، واذكر أن التحليل أولي لأن المحتوى الكامل للصفحات لم يُقرأ.\n\n" + evidence;
        const history = next.slice(0, -1);
        history[history.length - 1] = { ...history[history.length - 1], content: enriched };
        await streamInto(history, "وجدت " + results.length + " نتائج لبحثك، ودي خلاصة التحليل:\n\n");
      } else if (mode === "agent") {
        patchLast({ content: "جارٍ تنفيذ المهمة بالوكيل والأدوات..." });
        const res = await fetch("/api/agent/execute", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ task: text, documents: documents.map(d => ({ name:d.name, content:d.content.slice(0,40000) })) }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذر تنفيذ المهمة.");
        const tools = Array.isArray(data.toolsUsed) ? (data.toolsUsed as string[]).filter(t => typeof t === "string") : [];
        const trace = Array.isArray(data.toolTrace) ? (data.toolTrace as AgentTraceItem[]).filter(t => t && typeof t.tool === "string" && typeof t.detail === "string") : [];
        const sources = Array.isArray(data.searchSources) ? (data.searchSources as AgentSource[]).filter(s => s && typeof s.title === "string" && typeof s.url === "string").map(s => ({ title: s.title, url: s.url, snippet: typeof s.date === "string" ? "التاريخ: " + s.date : "", date: typeof s.date === "string" ? s.date : null, position: null })) : [];
        patchLast({ content: String(data.answer || ""), tools, trace, sources });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "تعذر إتمام الطلب.";
      setNotice(message);
      setMessages(old => {
        const last = old[old.length-1];
        if (last?.role === "assistant" && !last.content) return old.slice(0,-1);
        return old.map((m,i) => i === old.length-1 && m.role === "assistant" && m.content.indexOf("جارٍ") === 0 ? { ...m, content: "تعذر إتمام الطلب: " + message } : m);
      });
    } finally { setBusy(false); }
  }

  function persistConversations(list: { id: string; title: string; updatedAt: string; messages: Message[] }[]) {
    try { localStorage.setItem("medhat-conversations-v1", JSON.stringify(list)); } catch {}
  }

  function newChat() {
    const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const conv = { id, title: "", updatedAt: new Date().toISOString(), messages: [] as Message[] };
    const next = [conv, ...conversations].slice(0, 60);
    setConversations(next); setActiveId(id); setMessages([]);
    persistConversations(next);
    try { localStorage.setItem("medhat-active-chat-v1", id); } catch {}
    setSection("chat"); setMobileNavOpen(false); setNotice("");
  }

  function switchConversation(id: string) {
    const conv = conversations.find(c => c.id === id); if (!conv) return;
    setActiveId(id); setMessages(conv.messages);
    try { localStorage.setItem("medhat-active-chat-v1", id); } catch {}
    setSection("chat"); setMobileNavOpen(false); setNotice("");
  }

  function deleteConversation(id: string, e: { stopPropagation: () => void }) {
    e.stopPropagation();
    const next = conversations.filter(c => c.id !== id);
    setConversations(next); persistConversations(next);
    if (activeId === id) {
      const fallback = next[0];
      if (fallback) {
        setActiveId(fallback.id); setMessages(fallback.messages);
        try { localStorage.setItem("medhat-active-chat-v1", fallback.id); } catch {}
      } else { setActiveId(""); setMessages([]); }
    }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list?.length) return;
    const supported = /\.(txt|md|csv|json|ya?ml|toml|html?|xml|js|jsx|ts|tsx|py|css|sql|log)$/i;
    const incoming = Array.from(list);
    const accepted = incoming.filter(file => supported.test(file.name) && file.size <= 2_000_000);
    const skipped = incoming.length - accepted.length;
    const parsed: {name:string;content:string;size:number;updatedAt:string}[] = [];
    for (const file of accepted) {
      try {
        const content = (await file.text()).slice(0, 40_000);
        parsed.push({name:file.name,content,size:file.size,updatedAt:new Date().toISOString()});
      } catch { /* ignore unreadable file */ }
    }
    const mergedDocs = [...documents.filter(d => !parsed.some(p => p.name === d.name)), ...parsed].slice(-40);
    try {
      localStorage.setItem("medhat-documents-v1", JSON.stringify(mergedDocs));
      const names = [...new Set([...files, ...incoming.map(file=>file.name)])].slice(-200);
      localStorage.setItem("medhat-files-v1", JSON.stringify(names));
      setDocuments(mergedDocs); setFiles(names);
      setNotice(`تمت قراءة محتوى ${parsed.length} ملف وحفظه على هذا الجهاز.${skipped ? ` تم تخطي ${skipped} ملف: الأنواع المدعومة نصية فقط وبحد أقصى 2MB للملف.` : ""}`);
    } catch {
      setNotice("مساحة التخزين المحلية ممتلئة. قلّل عدد الملفات أو أحجامها ثم أعد المحاولة.");
    }
  }
  function analyzeDocument(doc:{name:string;content:string}) {
    const prompt = `حلّل الملف التالي اعتمادًا على محتواه فقط. ابدأ بملخص، ثم أهم النقاط، والأخطاء أو المخاطر، وخطوات عملية مقترحة. إذا كان كودًا فراجع الأخطاء المحتملة دون ادعاء تشغيله.
اسم الملف: ${doc.name}

--- بداية المحتوى ---
${doc.content.slice(0,40000)}
--- نهاية المحتوى ---`;
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
      <button className="new-chat" onClick={() => { newChat(); }}><SquarePen size={17}/> محادثة جديدة <span>⌘ K</span></button>
      <div className="nav-scroll">{["الرئيسية","الأدوات","النظام"].map(group => <div className="nav-group" key={group}><div className="group-label">{group}</div>{nav.filter(n=>n.group===group).map(n=><button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>changeSection(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id==="agent"&&<i className="nav-dot"/>}</button>)}</div>)}
        <div className="side-divider"/><div className="group-label">سجل المحادثات</div><div className="chats-scroll">{conversations.length ? conversations.map(c => <div key={c.id} className={"chat-item" + (activeId === c.id && section === "chat" ? " active" : "")} onClick={() => switchConversation(c.id)}><MessageCircle size={15}/><span>{c.title || "محادثة جديدة"}</span><button className="chat-del" aria-label="حذف المحادثة" onClick={e => deleteConversation(c.id, e)}><Trash2 size={13}/></button></div>) : <div className="empty-history">لا توجد محادثات سابقة بعد</div>}</div>
      </div>
      <div className="sidebar-bottom"><div className="connection"><span className="status-light"/><div><b>مساحة شخصية</b><small>البيانات محفوظة على الجهاز</small></div><ShieldCheck size={17}/></div><button className="profile-row" onClick={()=>changeSection("settings")}><div className="avatar">م</div><div><b>Medhat</b><small>المساعد الشخصي</small></div><MoreHorizontal size={18}/></button></div>
    </aside>}
    <section className="main-area">
      <header className="topbar"><div className="topbar-left">{!sidebarOpen&&<button className="icon-btn" onClick={()=>setSidebarOpen(true)} aria-label="إظهار القائمة"><PanelLeft size={19}/></button>}<button className="icon-btn mobile-menu" onClick={()=>setMobileNavOpen(v=>!v)} aria-label="القائمة"><Menu size={19}/></button><div className="crumb">{active.label}<ChevronDown size={15}/></div></div><div className="topbar-right"><button className="icon-btn" onClick={()=>setDark(v=>!v)} aria-label="تغيير المظهر">{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="help-btn" onClick={()=>setNotice("Medhat AI — الواجهة الجديدة. التكاملات الخلفية تُربط تدريجيًا.")}><CircleHelp size={17}/><span>مساعدة</span></button><div className="avatar small-avatar">م</div></div></header>
      {mobileNavOpen&&<button className="mobile-scrim" onClick={()=>setMobileNavOpen(false)} aria-label="إغلاق القائمة"/>}
      <div className="content-area">
        {section==="research"&&<ResearchSection researchQuery={researchQuery} setResearchQuery={setResearchQuery} researchBusy={researchBusy} researchData={researchData} busy={busy} setSection={setSection} sendMessage={sendMessage} runResearch={runResearch} />}
        {section==="chat"&&<ChatSection messages={messages} input={input} setInput={setInput} busy={busy} endRef={endRef} fileRef={fileRef} composerMode={composerMode} setComposerMode={setComposerMode} handleSend={handleSend} />}
        {section==="agent"&&<AgentSection setInput={setInput} changeSection={changeSection} agentTask={agentTask} setAgentTask={setAgentTask} agentBusy={agentBusy} agentResult={agentResult} agentTools={agentTools} agentTrace={agentTrace} agentSources={agentSources} executeAgentTask={executeAgentTask} codeLanguage={codeLanguage} setCodeLanguage={setCodeLanguage} codeInput={codeInput} setCodeInput={setCodeInput} codeOutput={codeOutput} codeBusy={codeBusy} runAgentCode={runAgentCode} editPath={editPath} setEditPath={setEditPath} editInstruction={editInstruction} setEditInstruction={setEditInstruction} editBusy={editBusy} applyProjectEdit={applyProjectEdit} setNotice={setNotice} />}
        {section==="tasks"&&<TasksSection tasks={tasks} setTasks={setTasks} />}
        {section==="workspace"&&<WorkspaceSection fileRef={fileRef} artifacts={artifacts} setArtifacts={setArtifacts} files={files} setFiles={setFiles} documents={documents} setDocuments={setDocuments} downloadArtifact={downloadArtifact} analyzeDocument={analyzeDocument} accountToken={accountToken} setNotice={setNotice} />}
        {section==="images"&&<ImagesSection setNotice={setNotice} imagePrompt={imagePrompt} setImagePrompt={setImagePrompt} imageAspect={imageAspect} setImageAspect={setImageAspect} imageStyle={imageStyle} setImageStyle={setImageStyle} imageBusy={imageBusy} setImageBusy={setImageBusy} generatedImage={generatedImage} setGeneratedImage={setGeneratedImage} />}
        {section==="video"&&<VideoSection setNotice={setNotice} />}
        {section==="memory"&&<MemorySection memories={memories} setMemories={setMemories} addMemory={addMemory} />}
        {section==="settings"&&<SettingsSection setMessages={setMessages} files={files} setFiles={setFiles} setNotice={setNotice} setMemories={setMemories} accountUser={accountUser} accountEmail={accountEmail} setAccountEmail={setAccountEmail} accountPassword={accountPassword} setAccountPassword={setAccountPassword} accountBusy={accountBusy} cloudMemoryStatus={cloudMemoryStatus} signOutAccount={signOutAccount} syncCloudMemory={syncCloudMemory} authenticateAccount={authenticateAccount} setConversations={setConversations} setActiveId={setActiveId} dark={dark} setDark={setDark} serviceStatus={serviceStatus} connectors={connectors} connectorsChecked={connectorsChecked} refreshConnectors={refreshConnectors} googleConnected={googleConnected} googleBusy={googleBusy} googleView={googleView} googleItems={googleItems} googleStatusMessage={googleStatusMessage} runGoogleView={runGoogleView} disconnectGoogle={disconnectGoogle} />}
      </div>
      {notice&&<div className="toast"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="إغلاق"><X size={16}/></button></div>}
      <input ref={fileRef} type="file" multiple hidden onChange={e=>uploadFiles(e.target.files)}/>
      
    </section>
    <nav className="mobile-bottom-nav">{nav.filter(n=>["chat","agent","tasks","workspace","images"].includes(n.id)).map(n=><button key={n.id} className={section===n.id?"selected":""} onClick={()=>changeSection(n.id)}><n.icon size={19}/><span>{n.label==="توليد الصور"?"الصور":n.label==="مساحة العمل"?"الملفات":n.label==="الوكيل الذكي"?"الوكيل":n.label}</span></button>)}<button onClick={()=>setMobileNavOpen(v=>!v)}><Menu size={19}/><span>المزيد</span></button></nav>
  </main>;
}
