import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";
import { NextRequest } from "next/server";
import ts from "typescript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 32_000) return fail("حجم الملف أكبر من الحد المسموح.", 413);
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "workspace-validate", 20);
  if (rateError) return rateError;

  let filename = "";
  let content = "";
  try {
    const body = await request.json() as { filename?: unknown; content?: unknown };
    if (typeof body.filename !== "string" || typeof body.content !== "string") return fail("بيانات الملف غير صالحة.", 400);
    filename = body.filename.replace(/[\\/\r\n\x00-\x1f]/g, "").slice(0, 160);
    content = body.content;
    if (!filename || content.length > 24_000) return fail("اسم الملف أو حجمه غير صالح.", 413);
  } catch {
    return fail("تعذر قراءة الطلب.", 400);
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "json") {
    try {
      JSON.parse(content);
      return Response.json({ ok: true, kind: "json", message: "ملف JSON صالح نحويًا.", checks: ["تم تحليل JSON بنجاح"] }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ ok: false, kind: "json", message: "JSON غير صالح.", checks: [error instanceof Error ? error.message.slice(0, 500) : "خطأ في تنسيق JSON"] }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  const scriptExts = ["ts", "tsx", "js", "jsx"];
  if (scriptExts.includes(ext)) {
    const sourceFile = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true,
      ext === "tsx" ? ts.ScriptKind.TSX : ext === "jsx" ? ts.ScriptKind.JSX : ext === "js" ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const diagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics || [];
    const checks = diagnostics.slice(0, 8).map(d => {
      const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
      const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
      return `${pos ? `السطر ${pos.line + 1}: ` : ""}${message}`;
    });
    return Response.json({
      ok: diagnostics.length === 0,
      kind: "syntax",
      message: diagnostics.length === 0 ? "لم يتم العثور على أخطاء نحوية في فحص TypeScript." : "عُثر على أخطاء نحوية محتملة.",
      checks: diagnostics.length === 0 ? ["اكتمل فحص التحليل النحوي فقط", "لم يتم تشغيل الكود أو التحقق من أنواع المشروع"] : checks,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (ext === "md" || ext === "markdown") {
    const headings = (content.match(/^#{1,6}\s+.+$/gm) || []).length;
    return Response.json({ ok: content.trim().length > 0, kind: "markdown", message: content.trim() ? "تم فحص بنية Markdown الأساسية." : "الملف فارغ.", checks: [`عدد العناوين المكتشفة: ${headings}`, `الحجم: ${content.length} حرف`] }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ ok: content.trim().length > 0, kind: "text", message: content.trim() ? "الملف يحتوي على محتوى؛ لا يتوفر مدقق متخصص لهذا الامتداد." : "الملف فارغ.", checks: [`الحجم: ${content.length} حرف`, "لم يتم تشغيل أي كود"] }, { headers: { "Cache-Control": "no-store" } });
}
