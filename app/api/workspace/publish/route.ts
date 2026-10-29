import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ownerRepo = (process.env.MEAI_GITHUB_REPOSITORY || "MedhatCoding/MeAi").trim();
const branch = (process.env.MEAI_GITHUB_BRANCH || "main").trim();
const allowedExt = new Set(["md", "txt", "json", "js", "jsx", "ts", "tsx", "css", "py", "sql", "yaml", "yml"]);

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "workspace-publish", 4);
  if (rateError) return rateError;

  const token = process.env.GITHUB_TOKEN;
  if (!token) return error("تكامل GitHub غير مهيأ على الخادم.", 503);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(ownerRepo) || !/^[A-Za-z0-9_.-]{1,100}$/.test(branch)) {
    return error("إعدادات المستودع أو الفرع غير صالحة.", 500);
  }

  let filename = "";
  let content = "";
  try {
    const body = await request.json() as { filename?: unknown; content?: unknown; confirmed?: unknown };
    if (body.confirmed !== true) return error("يلزم تأكيد المستخدم قبل النشر.", 400);
    if (typeof body.filename !== "string" || typeof body.content !== "string") return error("بيانات الملف غير صالحة.", 400);
    filename = body.filename.trim();
    content = body.content;
  } catch {
    return error("تعذر قراءة الطلب.", 400);
  }

  // Publishing is deliberately confined to a dedicated workspace folder.
  filename = filename.replace(/\\/g, "/").split("/").pop() || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(filename) || filename.startsWith(".") || filename.includes("..")) {
    return error("اسم الملف غير مسموح.", 400);
  }
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  if (!allowedExt.has(extension)) return error("امتداد الملف غير مسموح بالنشر.", 415);
  if (!content.trim() || Buffer.byteLength(content, "utf8") > 48_000) return error("الملف فارغ أو يتجاوز 48KB.", 413);

  const path = `.medhat-workspace/${filename}`;
  const base = `https://api.github.com/repos/${ownerRepo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  try {
    const current = await fetch(`${base}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    let sha: string | undefined;
    if (current.ok) {
      const file = await current.json() as { sha?: string; type?: string };
      if (file.type !== "file" || typeof file.sha !== "string") return error("تعذر التحقق من الملف الحالي.", 502);
      sha = file.sha;
    } else if (current.status !== 404) {
      return error(current.status === 401 || current.status === 403 ? "رمز GitHub غير مخول للكتابة في المستودع." : `فشل التحقق من الملف (HTTP ${current.status}).`, current.status === 401 || current.status === 403 ? 403 : 502);
    }

    const put = await fetch(base, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        message: `Medhat AI workspace: ${sha ? "update" : "add"} ${filename}`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    const data = await put.json().catch(() => ({})) as { commit?: { sha?: string; html_url?: string }; message?: string };
    if (!put.ok) return error(put.status === 409 || put.status === 422 ? "تعارض أو تغيّر الملف أثناء العملية. حدّث المحتوى وأعد المحاولة." : `رفض GitHub النشر (HTTP ${put.status}).`, put.status === 401 || put.status === 403 ? 403 : 502);
    const commit = data.commit?.sha || "";
    return Response.json({
      ok: true,
      repository: ownerRepo,
      branch,
      path,
      commit: commit.slice(0, 12),
      url: data.commit?.html_url || `https://github.com/${ownerRepo}/blob/${branch}/${path}`,
      operation: sha ? "updated" : "created",
      integrity: createHash("sha256").update(content).digest("hex").slice(0, 12),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("تعذر الاتصال بـ GitHub. لم يتم تأكيد النشر.", 502);
  }
}
