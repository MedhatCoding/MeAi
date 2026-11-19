import { fetchModelWithFallback, type ModelConfig } from "./model-config";

export type AgentToolName = "web_search" | "github_read" | "github_source_read" | "file_analysis" | "code_execution";

export type AgentToolPlan = {
  tools: AgentToolName[];
  searchQueries: string[];
  githubPaths: string[];
  plannerStatus: "success" | "fallback" | "skipped";
};

const allowedTools = new Set<AgentToolName>([
  "web_search",
  "github_read",
  "github_source_read",
  "file_analysis",
  "code_execution",
]);

function parseJsonObject(value: string): Record<string, unknown> | null {
  const cleaned = value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function safeSourcePath(value: string): boolean {
  const supported = /^(?:app|src|components|lib|pages|tests?|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|css|md|py|sql|yml|yaml)$|^(?:README\.md|package\.json|tsconfig\.json|next\.config\.[cm]?[jt]s)$/;
  return supported.test(value)
    && !value.split("/").includes("..")
    && !/(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:secrets?|credentials?)(?:\.|\/|$)/i.test(value);
}

export function fallbackAgentToolPlan(task: string, documentCount: number): AgentToolPlan {
  const wantsSearch = /ابحث|بحث|مصادر|مراجع|آخر|أحدث|اليوم|الأخبار|خبر|حالي|حديث|research|search|latest|today|news|sources|current|recent|قارن.*(?:مصادر|معلومات|أسعار)|تحقق من|هل صحيح|ما الجديد|ثغرات|اختراق|اختبار اختراق|أمن سيبراني|برمجيات خبيثة|فيروسات|تحليل malware|reverse engineering|vulnerability|penetration test|cybersecurity|malware|exploit|CVE/i.test(task);
  const wantsGithub = /github|مستودع|المستودع|ريبو|كود المشروع|issues?|pull request|طلبات السحب|commits?|الكوميت|الالتزامات/i.test(task);
  const wantsProjectFiles = /المشروع|الكود|ملفات|ملف|bug|خطأ برمجي|إصلاح|تطوير|feature|implement|codebase|source code/i.test(task);
  return {
    tools: [
      ...(wantsSearch ? ["web_search" as const] : []),
      ...(wantsGithub ? ["github_read" as const] : []),
      ...(wantsGithub && wantsProjectFiles ? ["github_source_read" as const] : []),
      ...(documentCount > 0 ? ["file_analysis" as const] : []),
      ...(/شغّل|شغل|نفّذ الكود|نفذ الكود|اختبر الكود|شغّل الكود|احسب باستخدام كود|اكتب سكربت|run (?:the )?code|execute (?:the )?code|run (?:a )?script|test (?:the )?code|python script|calculate with python/i.test(task) ? ["code_execution" as const] : []),
    ],
    searchQueries: [task.replace(/\s+/g, " ").slice(0, 300)],
    githubPaths: [],
    plannerStatus: "fallback",
  };
}

export async function planAgentTools(input: {
  task: string;
  documentCount: number;
  modelConfig: ModelConfig;
}): Promise<AgentToolPlan> {
  const fallback = fallbackAgentToolPlan(input.task, input.documentCount);
  try {
    const response = await fetchModelWithFallback(input.modelConfig, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.modelConfig.model,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: "system",
            content: 'You are a tool planner for a general-purpose AI assistant. Do not invent topical, political, cultural, or ethical restrictions. For cybersecurity research, include web_search when current vulnerability details, CVEs, advisories, or technical references would materially help; support lab-based analysis and defensive learning. Available tools: web_search (current facts or sources), github_read (repository metadata), github_source_read (relevant source files), file_analysis (only when files are attached), and code_execution (generate and run a short Python script in an ephemeral E2B sandbox with outbound internet disabled; use only when executing code materially helps solve or verify the task, or the user explicitly asks to run/test code). Do not select code_execution merely to appear active. Never put secrets or user credentials in generated code. Choose every tool that materially helps the task, and do not skip research or file inspection merely to shorten the plan. Return only JSON with keys "tools" (array), "searchQueries" (up to 3 short strings), and "githubPaths" (up to 3 safe repository-relative paths).',
          },
          {
            role: "user",
            content: `Task: ${input.task}\nAttached file count: ${input.documentCount}\nDefault repository: ${process.env.MEAI_GITHUB_REPOSITORY || "MedhatCoding/MeAi"}`,
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fallback;
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback;
    const parsed = parseJsonObject(content);
    if (!parsed) return fallback;

    const tools = Array.isArray(parsed.tools)
      ? [...new Set(parsed.tools.filter((value): value is AgentToolName => typeof value === "string" && allowedTools.has(value as AgentToolName)))]
        .filter((tool) => tool !== "file_analysis" || input.documentCount > 0)
      : [];
    if (tools.includes("github_source_read") && !tools.includes("github_read")) tools.push("github_read");
    const explicitCodeExecution = /شغّل|شغل|نفّذ الكود|نفذ الكود|اختبر الكود|شغّل الكود|احسب باستخدام كود|اكتب سكربت|run (?:the )?code|execute (?:the )?code|run (?:a )?script|test (?:the )?code|python script|calculate with python/i.test(input.task);
    if (explicitCodeExecution && !tools.includes("code_execution")) tools.push("code_execution");
    const searchQueries = Array.isArray(parsed.searchQueries)
      ? [...new Set(parsed.searchQueries.filter((value): value is string => typeof value === "string" && value.trim().length >= 3 && value.length <= 300).map(value => value.trim()))].slice(0, 3)
      : [];
    const githubPaths = Array.isArray(parsed.githubPaths)
      ? [...new Set(parsed.githubPaths.filter((value): value is string => typeof value === "string" && safeSourcePath(value)))].slice(0, 3)
      : [];

    return {
      tools,
      searchQueries: searchQueries.length ? searchQueries : fallback.searchQueries,
      githubPaths,
      plannerStatus: "success",
    };
  } catch {
    return fallback;
  }
}
