import { Sandbox } from "@e2b/code-interpreter";
import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../../_lib/guard";
import { enforceApiAccess } from "../../../_lib/api-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const accessError = await enforceApiAccess(request);
  if (accessError) return accessError;

  const rateError = enforceRateLimit(request, "agent-sandbox", 5);
  if (rateError) return rateError;

  if (!process.env.E2B_API_KEY) {
    return fail("بيئة التنفيذ غير مهيأة: أضف E2B_API_KEY إلى إعدادات Vercel.", 503);
  }

  let code = "";
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 16_000) {
      return fail("حجم الكود أكبر من الحد المسموح (16 كيلوبايت).", 413);
    }

    const body = JSON.parse(raw) as { code?: unknown; language?: unknown; authorizationConfirmed?: unknown };
    if (body.authorizationConfirmed !== true) {
      return fail("أكد أن أي نظام أو هدف شبكي ستختبره مملوك لك أو لديك تصريح صريح لاختباره.", 400);
    }
    if (body.language !== undefined && body.language !== "python") {
      return fail("اللغة المدعومة حاليًا هي Python فقط.", 400);
    }
    if (typeof body.code !== "string" || !body.code.trim()) {
      return fail("أرسل كود Python المطلوب تشغيله.", 400);
    }
    if (body.code.length > 12_000) {
      return fail("الحد الأقصى للكود هو 12000 حرف.", 413);
    }
    code = body.code;
  } catch {
    return fail("صيغة الطلب غير صالحة.", 400);
  }

  let sandbox: Sandbox | undefined;
  try {
    sandbox = await Sandbox.create();
    const execution = await sandbox.runCode(code, { requestTimeoutMs: 35_000 });
    const stdout = Array.isArray(execution.logs?.stdout)
      ? execution.logs.stdout.join("\n").slice(0, 12_000)
      : "";
    const stderr = Array.isArray(execution.logs?.stderr)
      ? execution.logs.stderr.join("\n").slice(0, 6_000)
      : "";
    const results = Array.isArray(execution.results)
      ? execution.results.slice(0, 8).map((item) => ({
          text: typeof item.text === "string" ? item.text.slice(0, 8_000) : "",
          html: typeof item.html === "string" ? item.html.slice(0, 2_000) : undefined,
        }))
      : [];

    return Response.json({
      success: !execution.error,
      language: "python",
      output: typeof execution.text === "string" ? execution.text.slice(0, 16_000) : "",
      stdout,
      stderr,
      results,
      error: execution.error ? String(execution.error.value || execution.error.name || "Execution failed").slice(0, 2_000) : null,
      sandbox: "e2b",
      note: "تم التنفيذ داخل Sandbox سحابي منفصل. هذا لا يعني أن الشبكة معزولة؛ تجنب أي هدف لا تملك تصريحًا لاختباره.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(
      error instanceof Error ? `تعذر تشغيل التجربة داخل Sandbox: ${error.message.slice(0, 240)}` : "تعذر تشغيل التجربة داخل Sandbox.",
      502,
    );
  } finally {
    if (sandbox) {
      try { await sandbox.kill(); } catch { /* Expired sandboxes are already stopped. */ }
    }
  }
}
