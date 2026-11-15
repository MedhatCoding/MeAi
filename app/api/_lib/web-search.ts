export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
  source: string;
  position: number | null;
  content?: string;
  contentStatus: "read" | "snippet_only" | "unavailable";
};

export type WebSearchResponse = {
  query: string;
  searchType: "news" | "web" | "academic";
  queriesUsed: number;
  results: WebSearchResult[];
  fetchedAt: string;
  elapsedMs: number;
};

function normalizeQuery(query: string) {
  return query
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:من فضلك\s*)?(?:ابحث لي عن|ابحث عن|ابحث|دوّر على|دور على|search for|search|research)\s*/i, "")
    .replace(/\s+(?:على الويب|على الإنترنت|مع المصادر والروابط|واعرض المصادر)$/i, "")
    .trim()
    .slice(0, 300);
}

function classify(query: string): "news" | "web" | "academic" {
  if (/\b(news|headlines|breaking)\b|أخبار|الأخبار|خبر|عاجل|آخر التطورات|مستجدات/i.test(query)) return "news";
  if (/\b(paper|papers|academic|scholar|research paper|journal|study|studies)\b|أبحاث علمية|بحث علمي|أوراق علمية|دراسات أكاديمية|دراسة علمية/i.test(query)) return "academic";
  return "web";
}

function queryVariants(query: string, type: "news" | "web" | "academic") {
  const variants = [query];
  if (type === "news") {
    variants.push(query + " آخر الأخبار");
  } else if (type === "academic") {
    variants.push(query + " research paper study");
  } else {
    variants.push(query + (/\p{Script=Arabic}/u.test(query) ? " مصدر رسمي" : " official source"));
  }
  return [...new Set(variants.map((q) => q.trim()).filter((q) => q.length >= 2))].slice(0, 2);
}

function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Math.min(0x10ffff, parseInt(n, 16))));
}

function htmlToText(html: string) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/article|\/section|\/h[1-6]|\/li|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(text).replace(/[\t\r ]+/g, " ").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 9000);
}

async function readPage(url: string): Promise<string | null> {
  if (!isPublicHttpUrl(url)) return null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MeAIResearchBot/1.0 (+https://github.com/MedhatCoding/MeAi)", Accept: "text/html,text/plain;q=0.9" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok || !response.body || !isPublicHttpUrl(response.url || url)) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) return null;
    const declared = Number(response.headers.get("content-length") || "0");
    if (declared > 1_500_000) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let bytes = 0;
    while (bytes < 1_500_000) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      raw += decoder.decode(value, { stream: true });
      if (bytes >= 1_500_000) break;
    }
    try { await reader.cancel(); } catch { /* response already closed */ }
    const extracted = /html|xhtml/i.test(contentType) ? htmlToText(raw) : raw.replace(/\s+/g, " ").trim().slice(0, 9000);
    return extracted.length >= 250 ? extracted : null;
  } catch {
    return null;
  }
}

function canonicalUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid$|fbclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString();
}

const LOW_QUALITY_NEWS_HOSTS = [
  "youtube.com", "youtu.be", "facebook.com", "fb.watch", "tiktok.com",
  "instagram.com", "pinterest.com",
];

const TRUSTED_NEWS_HOSTS = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com",
  "nytimes.com", "washingtonpost.com", "cnbc.com", "bloomberg.com",
  "techcrunch.com", "theverge.com", "arstechnica.com", "technologyreview.com",
  "wired.com", "engadget.com", "openai.com", "anthropic.com", "blog.google",
  "deepmind.google", "nvidia.com",
];

function hostMatches(host: string, domains: string[]) {
  return domains.some((domain) => host === domain || host.endsWith("." + domain));
}

export async function searchWeb(queryInput: string): Promise<WebSearchResponse> {
  const started = Date.now();
  const query = normalizeQuery(queryInput);
  if (query.length < 2) throw new Error("اكتب سؤال بحث أوضح.");
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("البحث غير مهيأ. أضف SERPER_API_KEY إلى أسرار الاستضافة.");
  const searchType = classify(query);
  const endpoint = searchType === "news" ? "news" : searchType === "academic" ? "scholar" : "search";
  const queries = queryVariants(query, searchType);
  const freshness = /\b(today|breaking|last 24 hours)\b|اليوم|الآن|عاجل/i.test(query) ? "qdr:d"
    : /\b(this week|past week|last 7 days)\b|هذا الأسبوع|الأسبوع الحالي|آخر أسبوع/i.test(query) ? "qdr:w"
    : /\b(this month|past month|last 30 days)\b|هذا الشهر|الشهر الحالي|آخر شهر/i.test(query) ? "qdr:m"
    : undefined;
  const responses = await Promise.allSettled(queries.map(async (q) => {
    const response = await fetch("https://google.serper.dev/" + endpoint, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "eg", hl: /\p{Script=Arabic}/u.test(q) ? "ar" : "en", num: 8, ...(freshness ? { tbs: freshness } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Serper HTTP " + response.status);
    return await response.json() as {
      organic?: { title?: unknown; link?: unknown; snippet?: unknown; date?: unknown; source?: unknown; position?: unknown }[];
      news?: { title?: unknown; link?: unknown; snippet?: unknown; date?: unknown; source?: unknown; position?: unknown }[];
    };
  }));
  const successful = responses.filter((r): r is PromiseFulfilledResult<{organic?: {title?: unknown;link?: unknown;snippet?: unknown;date?: unknown;source?: unknown;position?: unknown}[];news?: {title?: unknown;link?: unknown;snippet?: unknown;date?: unknown;source?: unknown;position?: unknown}[]}> => r.status === "fulfilled");
  if (!successful.length) {
    console.info("[meai-search]", JSON.stringify({ event: "search_failed", type: searchType, queryCount: queries.length, elapsedMs: Date.now() - started }));
    throw new Error("تعذر الاتصال بمحرك البحث. حاول مرة أخرى بعد قليل.");
  }
  // News vertical can occasionally return an empty array while the general web index has current coverage.
  // Fall back to ordinary web search rather than reporting a false "no news" result.
  let resultSets = successful.map((response) => response.value);
  let usedFallback = false;
  if (searchType === "news" && !resultSets.some((payload) => Array.isArray(payload.news) && payload.news.length > 0)) {
    const broadQuery = query.replace(/\b(today|latest|breaking)\b|اليوم|أحدث|احدث|عاجل/gi, "").replace(/\s+/g, " ").trim();
    const fallbackQueries = [...new Set([
      broadQuery + " -site:youtube.com -site:facebook.com -site:tiktok.com -site:instagram.com",
      broadQuery + " (site:reuters.com OR site:apnews.com OR site:bbc.com OR site:techcrunch.com OR site:theverge.com OR site:arstechnica.com OR site:technologyreview.com OR site:wired.com OR site:openai.com OR site:anthropic.com OR site:blog.google OR site:nvidia.com)",
    ].filter((value) => value.length >= 2))].slice(0, 2);
    const fallbackResponses = await Promise.allSettled(fallbackQueries.map(async (q) => {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "eg", hl: /[\u0600-\u06FF]/.test(q) ? "ar" : "en", num: 8, ...(freshness ? { tbs: freshness } : {}) }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Serper fallback HTTP " + response.status);
      return await response.json() as { organic?: { title?: unknown; link?: unknown; snippet?: unknown; date?: unknown; source?: unknown; position?: unknown }[] };
    }));
    const fallbackSets = fallbackResponses.filter((r): r is PromiseFulfilledResult<{organic?: {title?: unknown;link?: unknown;snippet?: unknown;date?: unknown;source?: unknown;position?: unknown}[]}> => r.status === "fulfilled").map((r) => r.value);
    if (fallbackSets.length) {
      resultSets = fallbackSets;
      usedFallback = true;
    }
  }
  const seen = new Set<string>();
  const candidates: WebSearchResult[] = [];
  for (const payload of resultSets) {
    const rows = usedFallback ? payload.organic : searchType === "news" ? payload.news : payload.organic;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (typeof row.title !== "string" || typeof row.link !== "string" || !isPublicHttpUrl(row.link)) continue;
      try {
        const url = new URL(row.link);
        if (url.hostname === "translate.google.com" || url.hostname.endsWith(".translate.goog")) continue;
        // News results must be publishable articles, not social posts or videos.
        const newsHost = url.hostname.toLowerCase().replace(/^www\./, "");
        if (searchType === "news" && hostMatches(newsHost, LOW_QUALITY_NEWS_HOSTS)) continue;
        // For "today" searches, an undated result cannot be represented as today's news.
        if (searchType === "news" && freshness === "qdr:d" && (typeof row.date !== "string" || !row.date.trim())) continue;
        const canonical = canonicalUrl(row.link);
        if (seen.has(canonical)) continue;
        seen.add(canonical);
        candidates.push({
          title: row.title.slice(0, 300),
          url: url.toString(),
          snippet: typeof row.snippet === "string" ? row.snippet.slice(0, 1200) : "",
          date: typeof row.date === "string" ? row.date.slice(0, 100) : null,
          source: typeof row.source === "string" ? row.source.slice(0, 120) : url.hostname.replace(/^www\./, ""),
          position: typeof row.position === "number" ? row.position : null,
          contentStatus: "snippet_only",
        });
      } catch { /* invalid provider URL */ }
    }
  }
  candidates.sort((a, b) => {
    if (searchType !== "news" || !usedFallback) return (a.position ?? 99) - (b.position ?? 99);
    const hostA = new URL(a.url).hostname.toLowerCase().replace(/^www\./, "");
    const hostB = new URL(b.url).hostname.toLowerCase().replace(/^www\./, "");
    const scoreA = (hostMatches(hostA, TRUSTED_NEWS_HOSTS) ? 100 : 0) + (a.date ? 5 : 0) - (a.position ?? 99);
    const scoreB = (hostMatches(hostB, TRUSTED_NEWS_HOSTS) ? 100 : 0) + (b.date ? 5 : 0) - (b.position ?? 99);
    return scoreB - scoreA;
  });
  const selected = candidates.slice(0, 8);
  const pageResults = await Promise.all(selected.slice(0, 4).map(async (result) => {
    const content = await readPage(result.url);
    return content ? { ...result, content, contentStatus: "read" as const } : { ...result, contentStatus: "unavailable" as const };
  }));
  const byUrl = new Map(pageResults.map((result) => [canonicalUrl(result.url), result]));
  const results = selected.map((result) => byUrl.get(canonicalUrl(result.url)) || result);
  const elapsedMs = Date.now() - started;
  console.info("[meai-search]", JSON.stringify({
    event: "search_complete",
    type: searchType,
    queryCount: successful.length + (usedFallback ? resultSets.length : 0),
    fallbackUsed: usedFallback,
    resultCount: results.length,
    pagesRead: results.filter((r) => r.contentStatus === "read").length,
    pagesUnavailable: results.filter((r) => r.contentStatus === "unavailable").length,
    elapsedMs,
  }));
  return { query, searchType, queriesUsed: successful.length + (usedFallback ? resultSets.length : 0), results, fetchedAt: new Date().toISOString(), elapsedMs };
}
