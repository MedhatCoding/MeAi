import re
import json
import html as html_lib
from datetime import datetime

import requests

PAGE_FETCH_LIMIT_BYTES = 2 * 1024 * 1024


def _fetch_page_text(url):
    """Fetch a result page and return its visible text, or None on failure.

    Uses plain requests with a strict size cap. The previous implementation
    called DDGS().extract(), a method that does not exist in the ddgs package,
    so page extraction silently never worked.
    """
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0 MedhatAI/1.0"}, timeout=8, stream=True)
        if response.status_code >= 400:
            return None
        chunks, total = [], 0
        for chunk in response.iter_content(chunk_size=65536):
            chunk = chunk or b""
            chunks.append(chunk)
            total += len(chunk)
            if total >= PAGE_FETCH_LIMIT_BYTES:
                break
        raw = b"".join(chunks).decode("utf-8", errors="replace")
    except Exception:
        return None
    text = raw
    for pattern in (
        r"<script\b.*?</script>",
        r"<style\b.*?</style>",
        r"<noscript\b.*?</noscript>",
        r"<svg\b.*?</svg>",
        r"<head\b.*?</head>",
    ):
        text = re.sub(pattern, " ", text, flags=re.I | re.S)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def search_web(query):
    """General web search with relevance filtering, deduplication and dated-news safeguards."""
    query = (query or "").strip()
    if not query:
        return "SEARCH_STATUS=FAILED\nلم يُحدَّد استعلام للبحث."

    news_intent = bool(re.search(
        r"(خبر|أخبار|اخر الأخبار|آخر الأخبار|أحدث|عاجل|news|latest|breaking|اليوم|هذا الأسبوع|الأسبوع الحالي)",
        query, re.I
    ))
    egx_intent = bool(re.search(
        r"(البورصة المصرية|البورصة|EGX|EGX30|EGX33|EGX70|EGX100|egyptian exchange|egyptian stock market)",
        query, re.I
    ))
    errors, collected = [], []
    from urllib.parse import urlparse, quote

    queries = [query]
    if egx_intent:
        queries = [
            query,
            '"البورصة المصرية" أسهم أخبار',
            'EGX Egypt stock market',
        ]

    egypt_terms = ("egx", "egypt", "egyptian", "مصر", "المصري", "المصرية", "المصريه", "القاهرة", "القاهره", "egyptian exchange")
    market_terms = ("بورصة", "البورصة", "أسهم", "اسهم", "سهم", "مؤشر", "سوق المال", "stock", "stocks", "shares", "equities", "market index", "exchange")

    def is_relevant(text, url=""):
        text = (text or "").lower()
        host = urlparse(url).netloc.lower() if url else ""
        if egx_intent:
            if host.endswith("egx.com.eg"):
                return True
            return any(t in text for t in egypt_terms) and any(t in text for t in market_terms)
        # For general queries, require a meaningful overlap with the user's terms.
        # Ignore very short/common tokens so unrelated popular results don't pass.
        words = [w.lower() for w in re.findall(r"[\w\u0600-\u06ff]+", query) if len(w) > 2]
        if not words:
            return True
        haystack = text.lower()
        stopwords = {
            "ابحث", "الإنترنت", "الانترنت", "على", "عن", "في", "من", "الى", "إلى",
            "معلومات", "اعطني", "أعطني", "اذكر", "اشرح", "وضح", "ما", "هو", "هي",
            "هل", "كيف", "لماذا", "متى", "احدث", "أحدث", "آخر", "اخر", "اخبار",
            "أخبار", "خبر", "اليوم", "هذا", "هذه", "the", "and", "for", "with",
            "what", "when", "where", "how", "why", "about", "latest", "news",
            "search", "find", "tell", "please"
        }
        meaningful = [w for w in words if w not in stopwords and len(w) > 2]
        if not meaningful:
            return True
        matched = sum(1 for w in meaningful if w in haystack)
        threshold = 1 if len(meaningful) <= 2 else max(2, (len(meaningful) + 1) // 2)
        return matched >= threshold

    def add_results(items, require_date=False):
        batch = []
        for item in items:
            href = (item.get("url") or item.get("href") or "").strip()
            title = (item.get("title") or "").strip()
            date = (item.get("date") or item.get("published") or "").strip()
            snippet = (item.get("body") or item.get("snippet") or "").strip()
            parsed = urlparse(href) if href.startswith(("https://", "http://")) else None
            if not title or not parsed or not parsed.netloc:
                continue
            path = parsed.path.strip("/").lower()
            if not path or path in {"news", "latest", "home", "homepage", "markets", "business", "search"}:
                continue
            if require_date and not date:
                continue
            if not is_relevant(title + " " + snippet, href):
                continue
            batch.append({
                "title": title, "url": href, "snippet": snippet,
                "date": date, "source": (item.get("source") or parsed.netloc).strip()
            })
        return batch

    try:
        from ddgs import DDGS
        for q in queries:
            try:
                client = DDGS(timeout=12)
                if news_intent:
                    try:
                        results = list(client.news(q, max_results=15, backend="auto", timelimit="w", region="xa-ar"))
                    except TypeError:
                        results = list(client.news(q, max_results=15, backend="auto", region="xa-ar"))
                    collected.extend(add_results(results, require_date=True))
                else:
                    results = list(client.text(q, max_results=12, backend="auto", region="xa-ar"))
                    collected.extend(add_results(results))
            except Exception as exc:
                errors.append(f"DDGS: {type(exc).__name__}: {str(exc)[:80]}")
            if len(collected) >= 8:
                break
    except Exception as exc:
        errors.append(f"DDGS: {type(exc).__name__}: {str(exc)[:80]}")

    # Google News RSS is reserved for news queries; ordinary informational
    # searches use DDGS text results rather than turning every query into news.
    if news_intent and len(collected) < 3:
        try:
            import xml.etree.ElementTree as ET
            for q in queries:
                rss_url = "https://news.google.com/rss/search?q=" + quote(q + " when:7d") + "&hl=ar&gl=EG&ceid=EG:ar"
                response = requests.get(rss_url, headers={"User-Agent": "Mozilla/5.0 MedhatAI/1.0"}, timeout=15)
                response.raise_for_status()
                root = ET.fromstring(response.content)
                for item in root.findall(".//item")[:20]:
                    title = (item.findtext("title") or "").strip()
                    href = (item.findtext("link") or "").strip()
                    source_node = item.find("source")
                    source = (source_node.text or "").strip() if source_node is not None else ""
                    date = (item.findtext("pubDate") or "").strip()
                    if not title or not href.startswith(("https://", "http://")) or not date:
                        continue
                    if not is_relevant(title + " " + source, href):
                        continue
                    collected.append({
                        "title": title, "url": href, "snippet": "",
                        "date": date, "source": source or urlparse(href).netloc
                    })
                if len(collected) >= 5:
                    break
        except Exception as exc:
            errors.append(f"Google News RSS: {type(exc).__name__}: {str(exc)[:80]}")

    unique, seen = [], set()
    for item in collected:
        key = item["url"].split("?")[0].rstrip("/")
        if key not in seen:
            seen.add(key)
            unique.append(item)
    if unique:
        # Read a bounded number of result pages to improve grounding without
        # making every search slow or expensive.
        extracted_domains = set()
        for item in unique[:3]:
            body = _fetch_page_text(item["url"])
            if not body:
                item["page_extracted"] = False
                continue
            # Avoid treating boilerplate/consent pages as useful evidence.
            title_terms = [w.lower() for w in re.findall(r"[\w\u0600-\u06ff]+", item.get("title", "")) if len(w) > 3]
            page_lower = body.lower()
            overlap = sum(1 for w in set(title_terms) if w in page_lower)
            if len(body) >= 500 and (not title_terms or overlap >= min(2, len(set(title_terms)))):
                item["page_text"] = body[:1800]
                item["page_extracted"] = True
                extracted_domains.add(urlparse(item["url"]).netloc.lower().removeprefix("www."))
            else:
                item["page_extracted"] = False
        return "SEARCH_STATUS=OK\\nSEARCH_JSON=" + json.dumps(
            {
                "query": query, "news_intent": news_intent, "results": unique[:15],
                "pages_read": sum(1 for x in unique[:3] if x.get("page_extracted")),
                "independent_domains_read": len(extracted_domains),
            }, ensure_ascii=False
        )
    if news_intent:
        reason = "لم أجد أخبارًا حديثة ذات صلة واضحة وتاريخ نشر ورابط مقال محدد؛ لم أعرض نتائج غير متحققة."
    else:
        reason = "لم أجد صفحات ذات صلة كافية بالسؤال. جرّب صياغة أكثر تحديدًا."
    return "SEARCH_STATUS=FAILED\\n" + reason + " " + " | ".join(errors[:3])


def format_search_results(search_context):
    """Format source URLs directly; never imply undated pages are recent news."""
    try:
        payload = json.loads(search_context.split("SEARCH_JSON=", 1)[1])
        results = payload.get("results", [])
    except Exception:
        return "تعذر تنسيق نتائج البحث بشكل موثوق."
    from email.utils import parsedate_to_datetime
    from datetime import timedelta, timezone
    from urllib.parse import urlparse
    now = datetime.now(timezone.utc)
    query = payload.get("query", "")
    # Do not classify every EGX question as news: "اشرح مؤشر EGX30"
    # is informational, while explicit recency/news wording requires dated sources.
    news_intent = bool(payload.get("news_intent")) or bool(re.search(
        r"(خبر|أخبار|اخر الأخبار|آخر الأخبار|أحدث|عاجل|news|latest|breaking|اليوم|هذا الأسبوع|الأسبوع الحالي|أسعار اليوم)",
        query, re.I
    ))
    recent = news_intent or bool(re.search(r"(آخر|اخر|last)\s*7\s*(أيام|ايام|days)", query.lower()))
    egx_intent = bool(re.search(
        r"(البورصة المصرية|البورصة|EGX|EGX30|EGX33|EGX70|EGX100|egyptian exchange|egyptian stock market)",
        query, re.I
    ))
    egypt_terms = ("egx", "egypt", "egyptian", "مصر", "المصري", "المصرية", "المصريه", "القاهرة", "القاهره", "egyptian exchange")
    market_terms = ("بورصة", "البورصة", "أسهم", "اسهم", "سهم", "مؤشر", "سوق المال", "stock", "stocks", "shares", "equities", "market index", "exchange")
    output, dated_count = [], 0
    for item in results:
        if egx_intent:
            subject_text = (item.get("title", "") + " " + item.get("snippet", "")).lower()
            host = urlparse(item.get("url", "")).netloc.lower()
            if not host.endswith("egx.com.eg") and not (
                any(term in subject_text for term in egypt_terms)
                and any(term in subject_text for term in market_terms)
            ):
                continue
        raw_date = (item.get("date") or "").strip()
        dt = None
        if raw_date:
            try:
                dt = parsedate_to_datetime(raw_date)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                dt = dt.astimezone(timezone.utc)
            except Exception:
                try:
                    dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    dt = dt.astimezone(timezone.utc)
                except Exception:
                    dt = None
        if recent:
            if not dt:
                continue
            if not (now - timedelta(days=7) <= dt <= now + timedelta(hours=12)):
                continue
            dated_count += 1
        host = urlparse(item["url"]).netloc
        date_label = dt.strftime("%Y-%m-%d %H:%M UTC") if dt else (raw_date or "غير متاح")
        snippet = re.sub(r"\s+", " ", item.get("snippet", "")).strip()
        page_text = re.sub(r"\s+", " ", str(item.get("page_text", ""))).strip()
        if page_text:
            summary_line = f"- **من نص الصفحة المفتوحة (مقتطف):** {page_text[:900]}"
        else:
            summary_line = f"- **المقتطف:** {snippet if snippet else 'تعذر استخراج نص المقال؛ لا يمكن تأكيد تفاصيله من صفحة المصدر.'}"
        output.append(
            f"### {len(output)+1}. {item['title']}\\n"
            f"- **المصدر:** {item.get('source') or host}\\n"
            f"- **تاريخ النشر:** {date_label}\\n"
            f"- **الرابط:** [{host}]({item['url']})\\n"
            f"{summary_line}"
        )
        if len(output) >= 5:
            break
    if not output:
        if recent:
            return "لم أجد نتائج يمكن التحقق من تاريخ نشرها خلال آخر 7 أيام. استبعدت الصفحات العامة والنتائج غير المؤرخة بدلًا من عرضها كأخبار حديثة."
        return "لم أجد نتائج قابلة للعرض."
    note = ""
    if recent and dated_count < 5:
        note = "\\n\\n**تنبيه:** عُرضت الأخبار التي أمكن التحقق من تاريخها فقط؛ قد يكون عدد النتائج أقل من خمسة."
    try:
        payload = json.loads(search_context.split("SEARCH_JSON=", 1)[1])
        read_count = int(payload.get("pages_read", 0))
        domain_count = int(payload.get("independent_domains_read", 0))
        note += f"\\n\\n**حالة التحقق:** تمت قراءة {read_count} صفحة من النتائج الأولى عبر {domain_count} نطاق مستقل. قراءة الصفحة لا تعني صحة المعلومة؛ لذلك لا نصف النتيجة بأنها مؤكدة دون أدلة مستقلة."
        # General cross-source comparison: compare recurring meaningful terms only
        # across extracted pages from different domains; this is a signal, not fact-checking.
        from collections import defaultdict
        domain_terms = defaultdict(set)
        stopwords = {
            "التي","الذي","هذا","هذه","ذلك","هناك","على","إلى","الى","عن","من","في","مع","كان","كانت",
            "يكون","يمكن","حيث","بعد","قبل","بين","عند","أكثر","أقل","أيضا","كما","لكن","لذلك","وهو",
            "the","and","for","with","from","that","this","have","has","was","were","are","you","your",
            "into","about","after","before","than","then","their","they","will","would","could","should",
            "source","read","page","news","latest","update"
        }
        for item in results:
            body = (item.get("page_text") or item.get("snippet") or "")
            host = urlparse(item.get("url", "")).netloc.lower().removeprefix("www.")
            parts = host.split(".")
            domain = ".".join(parts[-2:]) if len(parts) >= 2 else host
            terms = {
                w.lower() for w in re.findall(r"[\\w\\u0600-\\u06ff]+", body)
                if len(w) > 3 and w.lower() not in stopwords
            }
            if domain and terms:
                domain_terms[domain].update(terms)
        if len(domain_terms) >= 2:
            counts = defaultdict(int)
            for terms in domain_terms.values():
                for term in terms:
                    counts[term] += 1
            recurring = sorted(
                ((term, count) for term, count in counts.items() if count >= 2),
                key=lambda pair: (-pair[1], pair[0])
            )[:8]
            if recurring:
                terms_label = "، ".join(term for term, _ in recurring)
                note += f"\\n\\n**مقارنة أولية بين المصادر:** ظهرت كلمات/موضوعات مشتركة عبر نطاقات مختلفة: {terms_label}. هذا تشابه موضوعي فقط وليس إثباتًا لصحة الادعاءات؛ راجع النصوص والروابط، وأي أرقام أو تواريخ متعارضة تحتاج تحققًا مستقلًا."
            else:
                note += "\\n\\n**مقارنة المصادر:** لم يظهر تداخل نصي كافٍ بين صفحات مستقلة؛ لا يمكن استنتاج اتفاق المصادر من النتائج الحالية."
        else:
            note += "\\n\\n**مقارنة المصادر:** يلزم وجود صفحتين مقروءتين على الأقل من نطاقين مستقلين؛ لا تُعدّ إعادة نشر الخبر من النطاق نفسه مصدرًا مستقلًا."
    except Exception:
        pass
    return "## نتائج البحث\\n\\n" + "\\n\\n".join(output) + note
