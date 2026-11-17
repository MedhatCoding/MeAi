import { NextRequest } from "next/server";
import { rejectCrossOrigin, enforceRateLimit } from "../../_lib/guard";
import { getVisionModelConfig } from "../../_lib/model-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "meai-files";
const MAX_EXTRACT_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const OCR_MAX_PAGES = 3;

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT_CHARS);
}

async function authenticate(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!base || !anonKey || !match) return null;
  try {
    const response = await fetch(base + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + match[1] },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown };
    return typeof user.id === "string" ? { base, anonKey, token: match[1], userId: user.id } : null;
  } catch { return null; }
}

async function createOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("ara+eng", 1, {
    // Pin the WASM core to a CDN build because Vercel output tracing can omit optional SIMD binaries.
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    gzip: true,
    logger: () => undefined,
  });
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
    if (line.trim()) pages.push("[صفحة " + pageNo + "]\n" + line);
    if (pages.join("\n\n").length >= MAX_TEXT_CHARS) break;
  }

  let extractedText = normalizeText(pages.join("\n\n"));
  let ocrUsed = false;
  if (extractedText.length < 40) {
    const [{ createCanvas }, worker] = await Promise.all([import("@napi-rs/canvas"), createOcrWorker()]);
    try {
      const ocrPages: string[] = [];
      const ocrLimit = Math.min(pdf.numPages, OCR_MAX_PAGES);
      for (let pageNo = 1; pageNo <= ocrLimit; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        if (result.data.text.trim()) ocrPages.push("[صفحة " + pageNo + " - OCR]\n" + result.data.text);
        if (ocrPages.join("\n").length >= MAX_TEXT_CHARS) break;
      }
      extractedText = normalizeText(ocrPages.join("\n\n"));
      ocrUsed = true;
    } finally {
      await worker.terminate();
    }
  }
  await pdf.destroy();
  return { text: extractedText, pages: pdf.numPages, truncated: pdf.numPages > pageLimit || (ocrUsed && pdf.numPages > OCR_MAX_PAGES), ocrUsed };
}

async function extractImageWithGemini(buffer: Buffer, mimeType: string): Promise<string | null> {
  const config = getVisionModelConfig();
  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (config?.provider !== "gemini" || !supported.includes(mimeType.toLowerCase()) || buffer.length > 8 * 1024 * 1024) return null;
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      temperature: 0,
      messages: [
        { role: "system", content: "أنت محرك OCR دقيق. استخرج النص الظاهر في الصورة حرفيًا وبنفس لغة النص، وحافظ على ترتيب الأسطر والجداول قدر الإمكان. لا تلخص ولا تشرح ولا تخمّن الكلمات غير الواضحة؛ ضع [غير مقروء] عند الحاجة. أعد النص المستخرج فقط." },
        { role: "user", content: [
          { type: "text", text: "استخرج كل النص الظاهر في هذه الصورة بدقة." },
          { type: "image_url", image_url: { url: "data:" + mimeType + ";base64," + buffer.toString("base64") } },
        ] },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("فشل استخراج النص عبر Gemini (HTTP " + response.status + ").");
  const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  const content = payload.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

async function extractDocument(buffer: Buffer, name: string, mimeType: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (extension === "pdf" || mimeType === "application/pdf") {
    return { ...(await extractPdf(buffer)), format: "pdf" };
  }
  if (["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(extension) || mimeType.startsWith("image/")) {
    const geminiText = await extractImageWithGemini(buffer, mimeType);
    if (geminiText) {
      return { text: normalizeText(geminiText), format: extension || "image", pages: 1, truncated: false, ocrUsed: true };
    }
    const worker = await createOcrWorker();
    try {
      const result = await worker.recognize(buffer);
      return { text: normalizeText(result.data.text || ""), format: extension || "image", pages: 1, truncated: false, ocrUsed: true };
    } finally {
      await worker.terminate();
    }
  }
  if (extension === "docx" || mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalizeText(result.value), format: "docx", pages: null, truncated: result.value.length > MAX_TEXT_CHARS, ocrUsed: false };
  }
  if (["xlsx", "xls"].includes(extension) || mimeType.includes("spreadsheet") || mimeType.includes("ms-excel")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: true });
    const sheets = workbook.SheetNames.slice(0, 20);
    const sections = sheets.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }).slice(0, 5000);
      return "[ورقة: " + sheetName + "]\n" + rows.map((row) => (row as unknown[]).map((cell) => String(cell ?? "")).join("\t")).join("\n");
    });
    const text = sections.join("\n\n");
    return { text: normalizeText(text), format: extension, pages: sheets.length, truncated: workbook.SheetNames.length > 20 || text.length > MAX_TEXT_CHARS, ocrUsed: false };
  }
  if (["txt", "md", "csv", "tsv", "json", "yaml", "yml", "toml", "html", "xml", "js", "jsx", "ts", "tsx", "py", "css", "sql", "log", "sh", "env"].includes(extension) || mimeType.startsWith("text/")) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return { text: normalizeText(text), format: extension || "text", pages: null, truncated: text.length > MAX_TEXT_CHARS, ocrUsed: false };
  }
  throw new Error("نوع الملف غير مدعوم. المدعوم: PDF وDOCX وXLSX وXLS وCSV والملفات النصية والصور PNG وJPG وWEBP وTIFF.");
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
  if (!name || !path.startsWith(session.userId + "/") || path.includes("..") || path.startsWith("/") || !Number.isSafeInteger(size) || size <= 0 || size > MAX_EXTRACT_BYTES) {
    return fail("الملف غير صالح للاستخراج. الحد الأقصى المدعوم حاليًا 15MB.", 400);
  }

  try {
    const objectPath = path.split("/").map(encodeURIComponent).join("/");
    const downloaded = await fetch(session.base + "/storage/v1/object/authenticated/" + BUCKET + "/" + objectPath, {
      headers: { apikey: session.anonKey, Authorization: "Bearer " + session.token },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!downloaded.ok) return fail("تعذر قراءة الملف من التخزين السحابي. تأكد أنه ما زال موجودًا في حسابك.", 502);
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_EXTRACT_BYTES) return fail("حجم الملف الفعلي يتجاوز حد الاستخراج.", 413);
    const extracted = await extractDocument(bytes, name, mimeType);
    if (!extracted.text.trim()) return fail("لم يتم العثور على نص قابل للاستخراج حتى بعد محاولة OCR. قد تكون الصورة غير واضحة أو اللغة غير مدعومة.", 422);
    return Response.json({
      ok: true,
      name,
      format: extracted.format,
      text: extracted.text,
      characters: extracted.text.length,
      pages: extracted.pages,
      truncated: extracted.truncated,
      extraction: extracted.ocrUsed ? "ocr" : "server",
      ocrUsed: extracted.ocrUsed,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر استخراج محتوى الملف.";
    return fail(message.slice(0, 500), 422);
  }
}
