import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "meai-files";
const MAX_EXTRACT_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticate(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!base || !anonKey || !match) return null;
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown };
    return typeof user.id === "string" ? { base, anonKey, token: match[1], userId: user.id } : null;
  } catch { return null; }
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT_CHARS);
}

async function extractPdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, disableFontFace: true });
  const pdf = await task.promise;
  const pages: string[] = [];
  const pageLimit = Math.min(pdf.numPages, 80);
  for (let pageNo = 1; pageNo <= pageLimit; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const text = await page.getTextContent();
    const line = text.items.map((item) => "str" in item ? item.str : "").filter(Boolean).join(" ");
    if (line.trim()) pages.push(`[صفحة ${pageNo}]\n${line}`);
    if (pages.join("\n\n").length >= MAX_TEXT_CHARS) break;
  }
  await pdf.destroy();
  return { text: normalizeText(pages.join("\n\n")), pages: pdf.numPages, truncated: pdf.numPages > pageLimit };
}

async function extractDocument(buffer: Buffer, name: string, mimeType: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (extension === "pdf" || mimeType === "application/pdf") {
    const result = await extractPdf(buffer);
    return { ...result, format: "pdf" };
  }
  if (extension === "docx" || mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalizeText(result.value), format: "docx", pages: null, truncated: result.value.length > MAX_TEXT_CHARS };
  }
  if (["xlsx", "xls"].includes(extension) || mimeType.includes("spreadsheet") || mimeType.includes("ms-excel")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: true });
    const sheets = workbook.SheetNames.slice(0, 20);
    const sections = sheets.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }).slice(0, 5000);
      return `[ورقة: ${sheetName}]\n` + rows.map((row) => (row as unknown[]).map((cell) => String(cell ?? "")).join("\t")).join("\n");
    });
    const text = sections.join("\n\n");
    return { text: normalizeText(text), format: extension, pages: sheets.length, truncated: workbook.SheetNames.length > 20 || text.length > MAX_TEXT_CHARS };
  }
  if (["txt", "md", "csv", "tsv", "json", "yaml", "yml", "toml", "html", "xml", "js", "jsx", "ts", "tsx", "py", "css", "sql", "log", "sh", "env"].includes(extension) || mimeType.startsWith("text/")) {
    return { text: normalizeText(new TextDecoder("utf-8", { fatal: false }).decode(buffer)), format: extension || "text", pages: null, truncated: buffer.length > MAX_TEXT_CHARS };
  }
  throw new Error("نوع الملف غير مدعوم للاستخراج حاليًا. المدعوم: PDF وDOCX وXLSX وXLS وCSV والملفات النصية. استخراج النص من الصور يحتاج خدمة OCR غير مهيأة.");
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const rateError = enforceRateLimit(request, "file-extract", 20);
  if (rateError) return rateError;
  const session = await authenticate(request);
  if (!session) return fail("سجّل الدخول أولًا لاستخراج الملف من مساحتك السحابية.", 401);

  let body: { path?: unknown; name?: unknown; mimeType?: unknown; size?: unknown };
  try { body = await request.json() as typeof body; } catch { return fail("بيانات طلب الاستخراج غير صالحة.", 400); }
  const path = typeof body.path === "string" ? body.path : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 255) : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.slice(0, 160) : "application/octet-stream";
  const size = Number(body.size);
  if (!name || !path.startsWith(`${session.userId}/`) || path.includes("..") || path.startsWith("/") || !Number.isSafeInteger(size) || size <= 0 || size > MAX_EXTRACT_BYTES) {
    return fail(`الملف غير صالح للاستخراج. الحد الأقصى المدعوم حاليًا ${MAX_EXTRACT_BYTES / 1024 / 1024}MB.`, 400);
  }

  try {
    const objectPath = path.split("/").map(encodeURIComponent).join("/");
    const downloaded = await fetch(`${session.base}/storage/v1/object/authenticated/${BUCKET}/${objectPath}`, {
      headers: { apikey: session.anonKey, Authorization: `Bearer ${session.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!downloaded.ok) return fail("تعذر قراءة الملف من التخزين السحابي. تأكد أنه ما زال موجودًا في حسابك.", 502);
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_EXTRACT_BYTES) return fail("حجم الملف الفعلي يتجاوز حد الاستخراج.", 413);
    const extracted = await extractDocument(bytes, name, mimeType);
    if (!extracted.text.trim()) return fail("لم يتم العثور على نص قابل للاستخراج. قد يكون PDF ممسوحًا ضوئيًا ويحتاج OCR.", 422);
    return Response.json({
      ok: true,
      name,
      format: extracted.format,
      text: extracted.text,
      characters: extracted.text.length,
      pages: extracted.pages,
      truncated: extracted.truncated,
      extraction: "server",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر استخراج محتوى الملف.";
    return fail(message.slice(0, 500), 422);
  }
}
