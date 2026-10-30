import { NextRequest } from "next/server";
import { Sandbox } from "@e2b/code-interpreter";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGES = new Set(["python", "javascript", "typescript", "r", "java", "bash"]);
const MAX_CODE_BYTES = 20_000;
const MAX_OUTPUT_CHARS = 12_000;

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "agent-code-run", 5);
  if (rateError) return rateError;
  if (!process.env.E2B_API_KEY) return fail("بيئة تشغيل الكود غير مهيأة. أضف E2B_API_KEY إلى أسرار الاستضافة.", 503);

  let code = "";
  let language = "python";
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_CODE_BYTES + 1000) return fail("حجم طلب الكود أكبر من الحد المسموح.", 413);
    const body = JSON.parse(raw) as { code?: unknown; language?: unknown };
    if (typeof body.code !== "string" || !body.code.trim()) return fail("اكتب الكود المراد تشغيله.", 400);
    code = body.code;
    language = typeof body.language === "string" ? body.language.toLowerCase() : "python";
    if (!LANGUAGES.has(language)) return fail("لغة البرمجة غير مدعومة.", 400);
    if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) return fail("الحد الأقصى للكود 20 كيلوبايت.", 413);
  } catch { return fail("صيغة طلب تشغيل الكود غير صالحة.", 400); }

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;
  try {
    sandbox = await Sandbox.create({ timeoutMs: 45_000, requestTimeoutMs: 15_000 });
    const execution = await sandbox.runCode(code, { language, timeoutMs: 12_000, requestTimeoutMs: 15_000 });
    const stdout = Array.isArray(execution.logs?.stdout) ? execution.logs.stdout.join("") : "";
    const stderr = Array.isArray(execution.logs?.stderr) ? execution.logs.stderr.join("") : "";
    const output = [stdout, execution.text || "", stderr ? "STDERR:\n" + stderr : ""].filter(Boolean).join("\n").slice(0, MAX_OUTPUT_CHARS);
    return Response.json({
      success: !execution.error,
      language,
      output: output || (execution.error ? "حدث خطأ أثناء التنفيذ." : "اكتمل التنفيذ دون مخرجات نصية."),
      error: execution.error ? { name: execution.error.name, value: execution.error.value, traceback: execution.error.traceback?.slice(0, 4000) } : null,
      truncated: output.length >= MAX_OUTPUT_CHARS,
      sandbox: "ephemeral",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تشغيل الكود داخل البيئة المعزولة.";
    return fail(message.slice(0, 500), 502);
  } finally {
    if (sandbox) {
      try { await sandbox.kill(); } catch { /* Sandbox also has a hard lifetime timeout. */ }
    }
  }
}
