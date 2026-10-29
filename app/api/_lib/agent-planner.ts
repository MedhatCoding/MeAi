export type AgentToolName = "web_search" | "github_read" | "github_source_read" | "file_analysis";

export type AgentToolPlan = {
  tools: AgentToolName[];
  searchQueries: string[];
  githubPaths: string[];
  plannerStatus: "success" | "fallback";
};

const allowedTools = new Set<AgentToolName>([
  "web_search",
  "github_read",
  "github_source_read",
  "file_analysis",
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
  const wantsSearch = /ابحث|بحث|مصادر|مراجع|آخر|أحدث|اليوم|الأخبار|خبر|حالي|حديث|research|search|latest|today|news|sources|current|recent|قارن.*(?:مصادر|معلومات|أسعار)|تحقق من|هل صحيح|ما الجديد/i.test(task);
  const wantsGithub = /github|مستودع|المستودع|ريبو|كود المشروع|issues?|pull request|طلبات السحب|commits?|الكوميت|الالتزامات/i.test(task);
  const wantsProjectFiles = /المشروع|الكود|ملفات|ملف|bug|خطأ برمجي|إصلاح|تطوير|feature|implement|codebase|source code/i.test(task);
  return {
    tools: [
      ...(wantsSearch ? ["web_search" as const] : []),
      ...(wantsGithub ? ["github_read" as const] : []),
      ...(wantsGithub && wantsProjectFiles ? ["github_source_read" as const] : []),
      ...(documentCount > 0 ? ["file_analysis" as const] : []),
    ],
    searchQueries: [task.replace(/\s+/g, " ").slice(0, 300)],
    githubPaths: [],
    plannerStatus: "fallback",
  };
}

export async function planAgentTools(input: {
  task: string;
  documentCount: number;
  endpoint: string;
  token: string;
  model: string;
}): Promise<AgentToolPlan> {
  const fallback = fallbackAgentToolPlan(input.task, input.documentCount);
  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: "system",
            content: 'You are a tool planner for a general-purpose AI assistant. Available read-only tools: web_search (current facts or sources), github_read (repository metadata), github_source_read (relevant source files), file_analysis (only when files are attached). Choose only necessary tools. Never plan writes, shell commands, logins, external account actions, or destructive actions. Return only JSON with keys "tools" (array), "searchQueries" (up to 3 short strings), and "githubPaths" (up to 3 safe repository-relative paths).',
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
