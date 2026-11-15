export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
  source: string;
  sourceType: "publisher" | "official" | "social" | "other";
  provider: "serper" | "brave" | "tavily" | "endless" | "langsearch";
  position: number | null;
  content?: string;
  contentStatus: "read" | "snippet_only" | "unavailable";
};

export type WebSearchResponse = {
  query: string;
  searchType: "news" | "web" | "academic";
  providersUsed: string[];
  queriesUsed: number;
  results: WebSearchResult[];
  fetchedAt: string;
  elapsedMs: number;
};

type RawResult = {
  title?: unknown;
  url?: unknown;
  link?: unknown;
  snippet?: unknown;
  description?: unknown;
  content?: unknown;
  raw_content?: unknown;
  date?: unknown;
  page_age?: unknown;
  published?: unknown;
  published_date?: unknown;
  publishedDate?: unknown;
  datePublished?: unknown;
  name?: unknown;
  text?: unknown;
  source?: unknown;
  position?: unknown;
};

type ProviderBatch = { provider: WebSearchResult["provider"]; rows: RawResult[] };

function normalizeQuery(query: string) {
  return query
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:من فضلك\s*)?(?:ابحث لي عن|ابحث عن|ابحث|دوّر على|دور على|search for|search|research)\s*/i, "")
    .replace(/\s+(?:على الويب|على الإنترنت|مع المصادر والروابط|واعرض المصادر)$/i, "")
    .trim()
    .slice(0, 1000);
}

function classify(query: string): "news" | "web" | "academic" {
  if (/\b(news|headlines|breaking)\b|أخبار|الأخبار|خبر|عاجل|آخر التطورات|مستجدات|أحدث\s+(?:أخبار|تطورات)|خلال\s+24\s+ساعة/i.test(query)) return "news";
  if (/\b(paper|papers|academic|scholar|research paper|journal|study|studies)\b|أبحاث علمية|بحث علمي|أوراق علمية|دراسات أكاديمية|دراسة علمية/i.test(query)) return "academic";
  return "web";
}

function queryVariants(query: string, newsWindow: { start: Date; end: Date } | null = null) {
  const quoted = /[\u0600-\u06ff]/.test(query) ? query : '"' + query + '"';
  const variants = [query, quoted];
  if (newsWindow) {
    const afterDate = new Date(newsWindow.start.getTime() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    variants.push(query + " after:" + afterDate);
  }
  return [...new Set(variants.map((q) => q.trim()).filter((q) => q.length >= 2))].slice(0, 3);
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
  return decodeHtml(text).replace(/[\t\r ]+/g, " ").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
}

function extractPublishedDate(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:property|name)\s*=\s*["'](?:article:published_time|og:published_time|datePublished|publishdate|pubdate|date)\s*["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:property|name)\s*=\s*["'](?:article:published_time|og:published_time|datePublished|publishdate|pubdate|date)\s*["']/i,
    /<time[^>]+datetime\s*=\s*["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && Number.isFinite(Date.parse(match[1]))) return new Date(match[1]).toISOString();
  }
  for (const match of html.matchAll(/["']datePublished["']\s*:\s*["']([^"']+)["']/gi)) {
    if (match[1] && Number.isFinite(Date.parse(match[1]))) return new Date(match[1]).toISOString();
  }
  // Some publishers omit structured publication metadata. In that case,
  // inspect only the opening article text (near the headline), not arbitrary
  // dates mentioned later in the body, to avoid mistaking an old article for
  // a fresh one based on a date elsewhere on the page.
  const openingText = htmlToText(html).slice(0, 1800);
  const visibleDate = openingText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i)
    || openingText.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if (visibleDate) {
    const parsed = Date.parse(visibleDate[0]);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

async function readPage(url: string): Promise<{ text: string; publishedAt: string | null } | null> {
  if (!isPublicHttpUrl(url)) return null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MeAIResearchBot/1.0 (+https://github.com/MedhatCoding/MeAi)", Accept: "text/html,text/plain,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.2" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || !response.body || !isPublicHttpUrl(response.url || url)) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) return null;
    const declared = Number(response.headers.get("content-length") || "0");
    if (declared > 2_000_000) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let bytes = 0;
    while (bytes < 2_000_000) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      raw += decoder.decode(value, { stream: true });
      if (bytes >= 2_000_000) break;
    }
    try { await reader.cancel(); } catch { /* response already closed */ }
    const isHtml = /html|xhtml/i.test(contentType);
    const publishedAt = isHtml ? extractPublishedDate(raw) : null;
    const extracted = isHtml ? htmlToText(raw) : raw.replace(/\s+/g, " ").trim().slice(0, 12000);
    return extracted.length >= 180 ? { text: extracted, publishedAt } : (publishedAt ? { text: "", publishedAt } : null);
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

const SOCIAL_HOSTS = [
  "youtube.com", "youtu.be", "facebook.com", "fb.watch", "tiktok.com",
  "instagram.com", "pinterest.com", "x.com", "twitter.com", "linkedin.com",
  "reddit.com", "threads.net", "t.me", "telegram.me", "discord.com",
];

const PUBLISHER_HOSTS = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com",
  "nytimes.com", "washingtonpost.com", "cnbc.com", "bloomberg.com",
  "techcrunch.com", "theverge.com", "arstechnica.com", "technologyreview.com",
  "wired.com", "engadget.com", "aljazeera.net", "alarabiya.net", "youm7.com",
  "masrawy.com",
];

const OFFICIAL_HOSTS = [
  "openai.com", "anthropic.com", "blog.google", "deepmind.google", "nvidia.com",
  "microsoft.com", "apple.com", "cloudflare.com", "vercel.com", "github.com",
];

function hostMatches(host: string, domains: string[]) {
  return domains.some((domain) => host === domain || host.endsWith("." + domain));
}

function classifySource(host: string): WebSearchResult["sourceType"] {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  if (hostMatches(normalized, SOCIAL_HOSTS)) return "social";
  if (hostMatches(normalized, OFFICIAL_HOSTS) || normalized.endsWith(".gov") || normalized.includes(".gov.") || normalized.endsWith(".edu")) return "official";
  if (hostMatches(normalized, PUBLISHER_HOSTS)) return "publisher";
  return "other";
}

function toRows(value: unknown): RawResult[] {
  return Array.isArray(value) ? value.filter((row): row is RawResult => !!row && typeof row === "object") : [];
}

async function serperSearch(query: string, type: "news" | "web" | "academic", key: string): Promise<ProviderBatch> {
  const endpoint = type === "news" ? "news" : type === "academic" ? "scholar" : "search";
  const response = await fetch("https://google.serper.dev/" + endpoint, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "eg", hl: /[\u0600-\u06ff]/.test(query) ? "ar" : "en", num: 10 }),
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error("Serper HTTP " + response.status);
  const data = await response.json() as { organic?: unknown; news?: unknown; organic_results?: unknown };
  return { provider: "serper", rows: toRows(type === "news" ? data.news : type === "academic" ? data.organic : data.organic) };
}

async function braveSearch(query: string, key: string): Promise<ProviderBatch> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("country", "EG");
  url.searchParams.set("search_lang", /[\u0600-\u06ff]/.test(query) ? "ar" : "en");
  const response = await fetch(url, {
    headers: { "X-Subscription-Token": key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error("Brave HTTP " + response.status);
  const data = await response.json() as { web?: { results?: unknown }; news?: { results?: unknown } };
  return { provider: "brave", rows: toRows(data.web?.results) };
}

async function tavilySearch(query: string, type: "news" | "web" | "academic", key: string): Promise<ProviderBatch> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      topic: type === "news" ? "news" : "general",
      max_results: 10,
      include_answer: false,
      include_raw_content: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error("Tavily HTTP " + response.status);
  const data = await response.json() as { results?: unknown };
  return { provider: "tavily", rows: toRows(data.results) };
}

async function endlessSearch(query: string, type: "news" | "web" | "academic", key: string): Promise<ProviderBatch> {
  const url = new URL("https://search.endless.sbs/api/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", type === "news" ? "news" : "web");
  url.searchParams.set("safesearch", "0");
  url.searchParams.set("pageno", "1");
  const response = await fetch(url, {
    headers: { "X-API-Key": key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error("Endless HTTP " + response.status);
  const data = await response.json() as { results?: unknown };
  return { provider: "endless", rows: toRows(data.results) };
}

async function langsearchSearch(query: string, key: string): Promise<ProviderBatch> {
  const response = await fetch("https://api.langsearch.com/v1/web-search", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, count: 10, contents: { text: { max_characters: 5000 } } }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("LangSearch HTTP " + response.status);
  const payload = await response.json() as {
    code?: unknown;
    message?: unknown;
    data?: { webPages?: { value?: unknown } };
  };
  if (String(payload.code) !== "200") {
    throw new Error("LangSearch API: " + (typeof payload.message === "string" ? payload.message : "unexpected response"));
  }
  return { provider: "langsearch", rows: toRows(payload.data?.webPages?.value) };
}

function normalizeRow(row: RawResult, provider: WebSearchResult["provider"], position: number): WebSearchResult | null {
  const title = typeof row.title === "string" ? row.title.trim() : typeof row.name === "string" ? row.name.trim() : "";
  const link = typeof row.url === "string" ? row.url : typeof row.link === "string" ? row.link : "";
  if (!title || !link || !isPublicHttpUrl(link)) return null;
  try {
    const url = new URL(link);
    if (url.hostname === "translate.google.com" || url.hostname.endsWith(".translate.goog")) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const date = [row.date, row.datePublished, row.published_date, row.publishedDate, row.published, row.page_age].find((value) => typeof value === "string" && value.trim());
    const snippet = [row.snippet, row.description, row.content, row.text].find((value) => typeof value === "string" && value.trim());
    const rawValue = typeof row.raw_content === "string" ? row.raw_content : typeof row.text === "string" ? row.text : undefined;
    const rawContent = rawValue && rawValue.length > 180 ? rawValue.slice(0, 12000) : undefined;
    return {
      title: title.slice(0, 300),
      url: url.toString(),
      snippet: typeof snippet === "string" ? snippet.slice(0, 1800) : "",
      date: typeof date === "string" ? date.slice(0, 120) : null,
      source: typeof row.source === "string" ? row.source.slice(0, 120) : host,
      sourceType: classifySource(host),
      provider,
      position: typeof row.position === "number" ? row.position : position,
      ...(rawContent ? { content: rawContent } : {}),
      contentStatus: rawContent ? "read" : "snippet_only",
    };
  } catch {
    return null;
  }
}

function cairoDayStart(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  // Cairo is UTC+2 in winter and UTC+3 during daylight saving time.
  const localMidnightUtc = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")));
  // Parsing Cairo's wall-clock representation as UTC exposes the current UTC offset,
  // including daylight-saving changes, without depending on the server timezone.
  const cairoWallClockAsUtc = Date.parse(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const cairoOffsetMs = cairoWallClockAsUtc - now.getTime();
  return new Date(localMidnightUtc - cairoOffsetMs);
}

function parsePublishedDate(value: string | null, now: Date): Date | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;
  const absolute = Date.parse(text);
  if (Number.isFinite(absolute)) return new Date(absolute);

  const relative = text.match(/(?:^|\b)(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?)\s*ago\b/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const factor = unit.startsWith("sec") ? 1_000 : unit.startsWith("min") ? 60_000 :
      unit.startsWith("hour") || unit.startsWith("hr") ? 3_600_000 :
      unit.startsWith("week") ? 604_800_000 : 86_400_000;
    return new Date(now.getTime() - amount * factor);
  }

  const arabicRelative = text.match(/منذ\s*(\d+)\s*(ثانية|ثوانٍ|دقيقة|دقائق|ساعة|ساعات|يوم|أيام|أسبوع|أسابيع)/);
  if (arabicRelative) {
    const amount = Number(arabicRelative[1]);
    const unit = arabicRelative[2];
    const factor = /ثانية|ثوانٍ/.test(unit) ? 1_000 : /دقيقة|دقائق/.test(unit) ? 60_000 :
      /ساعة|ساعات/.test(unit) ? 3_600_000 : /أسبوع/.test(unit) ? 604_800_000 : 86_400_000;
    return new Date(now.getTime() - amount * factor);
  }
  if (/^(just now|now|الآن|منذ قليل)$/.test(text)) return now;
  if (/^(yesterday|أمس)$/.test(text)) return new Date(now.getTime() - 36 * 3_600_000);
  return null;
}

function requestedNewsWindow(query: string, now: Date): { start: Date; end: Date } | null {
  if (!/\b(last\s*24\s*hours?|past\s*24\s*hours?|today|this\s*day)\b|آخر\s*24\s*ساعة|خلال\s*24\s*ساعة|اليوم|نهارده|النهارده/i.test(query)) return null;
  if (/آخر\s*24\s*ساعة|خلال\s*24\s*ساعة|\b(last|past)\s*24\s*hours?\b/i.test(query)) {
    return { start: new Date(now.getTime() - 24 * 60 * 60_000), end: now };
  }
  return { start: cairoDayStart(now), end: now };
}

export async function searchWeb(queryInput: string): Promise<WebSearchResponse> {
  const started = Date.now();
  const query = normalizeQuery(queryInput);
  if (query.length < 2) throw new Error("اكتب سؤال بحث أوضح.");
  const keys = {
    serper: process.env.SERPER_API_KEY,
    brave: process.env.BRAVE_SEARCH_API_KEY,
    tavily: process.env.TAVILY_API_KEY,
    endless: process.env.ENDLESS_SEARCH_KEY,
    langsearch: process.env.LANGSEARCH_API_KEY,
  };
  const providers = [
    ...(keys.serper ? [{ name: "serper" as const, key: keys.serper }] : []),
    ...(keys.brave ? [{ name: "brave" as const, key: keys.brave }] : []),
    ...(keys.tavily ? [{ name: "tavily" as const, key: keys.tavily }] : []),
    ...(keys.endless ? [{ name: "endless" as const, key: keys.endless }] : []),
    ...(keys.langsearch ? [{ name: "langsearch" as const, key: keys.langsearch }] : []),
  ];
  if (!providers.length) throw new Error("البحث غير مهيأ. أضف مفتاح مزوّد بحث واحد على الأقل إلى أسرار الاستضافة.");
  const searchType = classify(query);
  const now = new Date();
  const newsWindow = searchType === "news" ? requestedNewsWindow(query, now) : null;
  const variants = queryVariants(query, newsWindow);
  const tasks = providers.flatMap((provider) => variants.map(async (variant) => {
    if (provider.name === "serper") return serperSearch(variant, searchType, provider.key);
    if (provider.name === "brave") return braveSearch(variant, provider.key);
    if (provider.name === "tavily") return tavilySearch(variant, searchType, provider.key);
    if (provider.name === "endless") return endlessSearch(variant, searchType, provider.key);
    return langsearchSearch(variant, provider.key);
  }));
  const settled = await Promise.allSettled(tasks);
  const batches = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  if (!batches.length) {
    console.info("[meai-search]", JSON.stringify({ event: "search_failed", type: searchType, providers: providers.map((p) => p.name), elapsedMs: Date.now() - started }));
    throw new Error("تعذر الاتصال بمزوّدي البحث المهيئين. حاول مرة أخرى بعد قليل.");
  }
  const seen = new Set<string>();
  const candidates: WebSearchResult[] = [];
  for (const batch of batches) {
    batch.rows.forEach((row, index) => {
      const normalized = normalizeRow(row, batch.provider, index + 1);
      if (!normalized) return;
      const canonical = canonicalUrl(normalized.url);
      if (seen.has(canonical)) return;
      seen.add(canonical);
      candidates.push(normalized);
    });
  }
  // Resolve missing publication dates from publisher metadata before strict
  // filtering; search snippets frequently omit dates that the article page exposes.
  const pageMetadata = new Map<string, { text: string; publishedAt: string | null }>();
  let dateEnrichedCandidates = candidates;
  if (newsWindow) {
    const needsMetadata = candidates.filter((result) => !result.date || /^\d{4}-\d{2}-\d{2}$/.test(result.date.trim()) || /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}$/i.test(result.date.trim())).slice(0, 12);
    const metadataRows = await Promise.all(needsMetadata.map(async (result) => {
      const page = await readPage(result.url);
      if (page) pageMetadata.set(canonicalUrl(result.url), page);
      return { result, publishedAt: page?.publishedAt || null };
    }));
    const metadataByUrl = new Map(metadataRows.map(({ result, publishedAt }) => [canonicalUrl(result.url), publishedAt]));
    dateEnrichedCandidates = candidates.map((result) => ({
      ...result,
      date: metadataByUrl.get(canonicalUrl(result.url)) || result.date || null,
    }));
  }

  // For explicit "today"/"last 24 hours" news requests, require a parseable
  // publication timestamp inside the requested window. Missing/ambiguous dates
  // are excluded rather than being presented as current news.
  const todayRequest = newsWindow !== null &&
    !/آخر\s*24\s*ساعة|خلال\s*24\s*ساعة|\b(last|past)\s*24\s*hours?\b/i.test(query);
  const cairoToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const datedCandidates = newsWindow
    ? dateEnrichedCandidates.flatMap((result) => {
        const rawDate = result.date || "";
        const publishedAt = parsePublishedDate(rawDate, now);
        // Date-only publisher metadata can verify "today" as a calendar day,
        // but cannot prove that an item falls within a rolling last-24-hours window.
        const dateOnly = !/[T ]\d{1,2}:\d{2}/.test(rawDate) &&
          !/\b(ago|منذ|now|الآن|yesterday|أمس)\b/i.test(rawDate);
        const dateOnlyKey = dateOnly && publishedAt
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
            }).format(publishedAt)
          : "";
        const inWindow = publishedAt && (
          (todayRequest && dateOnly ? dateOnlyKey === cairoToday :
            !dateOnly && publishedAt >= newsWindow.start && publishedAt <= newsWindow.end)
        );
        return inWindow ? [{ ...result, date: publishedAt.toISOString() }] : [];
      })
    : candidates;

  // Keep provider diversity, but sort time-bounded news newest-first.
  const providerRank = new Map(providers.map((provider, index) => [provider.name, index]));
  if (newsWindow) {
    datedCandidates.sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "") ||
      (a.position ?? 99) - (b.position ?? 99));
  } else {
    datedCandidates.sort((a, b) => (a.position ?? 99) - (b.position ?? 99) ||
      (providerRank.get(a.provider) ?? 99) - (providerRank.get(b.provider) ?? 99));
  }
  const selected = datedCandidates.slice(0, 12);
  const pageResults = await Promise.all(selected.filter((result) => !result.content).slice(0, 6).map(async (result) => {
    const page = pageMetadata.get(canonicalUrl(result.url)) || await readPage(result.url);
    return page?.text
      ? { ...result, content: page.text, contentStatus: "read" as const }
      : { ...result, contentStatus: "unavailable" as const };
  }));
  const byUrl = new Map(pageResults.map((result) => [canonicalUrl(result.url), result]));
  const results = selected.map((result) => byUrl.get(canonicalUrl(result.url)) || result);
  const elapsedMs = Date.now() - started;
  const providersUsed = [...new Set(batches.map((batch) => batch.provider))];
  console.info("[meai-search]", JSON.stringify({
    event: "search_complete",
    type: searchType,
    providersUsed,
    queriesUsed: batches.length,
    resultCount: results.length,
    temporalFilter: newsWindow ? "strict" : "none",
    candidatesBeforeTemporalFilter: candidates.length,
    candidatesAfterTemporalFilter: datedCandidates.length,
    datesRecoveredFromPublisherMetadata: dateEnrichedCandidates.filter((result, index) => !candidates[index]?.date && !!result.date).length,
    pagesRead: results.filter((result) => result.contentStatus === "read").length,
    pagesUnavailable: results.filter((result) => result.contentStatus === "unavailable").length,
    elapsedMs,
  }));
  return { query, searchType, providersUsed, queriesUsed: batches.length, results, fetchedAt: new Date().toISOString(), elapsedMs };
}
