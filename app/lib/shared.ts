"use client";

import { Bot, Brain, FolderOpen, Image as ImageIcon, Layers3, MessageCircle, Search, Settings2, Video } from "lucide-react";

export type Section = "chat" | "research" | "agent" | "tasks" | "workspace" | "images" | "video" | "memory" | "settings";
export type Message = { role: "user" | "assistant"; content: string; time: string };
export type ResearchResult = { title: string; url: string; snippet: string; date: string | null; position: number | null };
export type TaskItem = { title: string; done: boolean };
export type WorkspaceDocument = { name: string; content: string; size: number; updatedAt: string };
export type AgentArtifact = { filename: string; content: string; summary: string; createdAt: string };
export type AgentTraceItem = { tool: string; status: "success" | "unavailable" | "failed" | "skipped"; detail: string };
export type AgentSource = { title: string; url: string; date?: string };
export type ServiceStatus = { configured: boolean; provider: string | null; model: string | null; features?: { agentExecution: boolean; imageGeneration: boolean; videoGeneration: boolean; persistentCloudMemory: boolean } };
export type ConnectorInfo = { id: string; label: string; configured: boolean; connected: boolean; verified: boolean; mode: string; detail: string };
export type AccountUser = { id: string; email: string };

export const nav: { id: Section; label: string; icon: typeof MessageCircle; group: string }[] = [
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

export function readMessages(): Message[] {
  try { const raw = localStorage.getItem("medhat-chat-v1"); return raw ? JSON.parse(raw) as Message[] : []; } catch { return []; }
}
export function titleFor(section: Section) { return nav.find(x => x.id === section)?.label ?? "المحادثة"; }
