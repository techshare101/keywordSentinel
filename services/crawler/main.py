"""
KeywordSentinel Crawl4AI Microservice

A lightweight FastAPI service that uses Crawl4AI to crawl web pages
and search sources that block traditional API access.

Endpoints:
  POST /crawl       - Crawl a single URL, return markdown + metadata
  POST /search      - Search a source (reddit, twitter, etc.) for a keyword
  GET  /health      - Health check
"""

import asyncio
import re
import json
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode


# ---------------------------------------------------------------------------
# Global crawler instance (reused across requests)
# ---------------------------------------------------------------------------
crawler: Optional[AsyncWebCrawler] = None

browser_config = BrowserConfig(
    browser_type="chromium",
    headless=True,
    verbose=False,
    extra_args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
)

run_config = CrawlerRunConfig(
    cache_mode=CacheMode.BYPASS,
    word_count_threshold=5,
    remove_overlay_elements=True,
    process_iframes=False,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start crawler on startup, close on shutdown."""
    global crawler
    crawler = AsyncWebCrawler(config=browser_config)
    await crawler.start()
    print("[Crawler] Started and ready")
    yield
    await crawler.close()
    print("[Crawler] Shut down")


app = FastAPI(
    title="KeywordSentinel Crawler",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class CrawlRequest(BaseModel):
    url: str
    css_selector: Optional[str] = None
    timeout: int = Field(default=30, ge=5, le=120)


class CrawlResponse(BaseModel):
    success: bool
    url: str
    title: str = ""
    markdown: str = ""
    links: list[dict] = []
    error: Optional[str] = None


class SearchRequest(BaseModel):
    source: str  # reddit, twitter, hackernews, producthunt, devto, etc.
    keyword: str
    limit: int = Field(default=25, ge=1, le=100)


class SearchResult(BaseModel):
    title: str
    content: str
    url: str
    author: str
    source: str
    created_at: str
    metadata: dict = {}


class SearchResponse(BaseModel):
    success: bool
    source: str
    keyword: str
    results: list[SearchResult] = []
    count: int = 0
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "crawler_ready": crawler is not None}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl_url(req: CrawlRequest):
    """Crawl a single URL and return markdown content."""
    if not crawler:
        raise HTTPException(status_code=503, detail="Crawler not ready")

    try:
        cfg = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            word_count_threshold=5,
            remove_overlay_elements=True,
            css_selector=req.css_selector,
        )

        result = await asyncio.wait_for(
            crawler.arun(url=req.url, config=cfg),
            timeout=req.timeout,
        )

        if not result.success:
            return CrawlResponse(
                success=False,
                url=req.url,
                error=result.error_message or "Crawl failed",
            )

        # Extract links
        links = []
        if result.links:
            for link_type in ["internal", "external"]:
                for link in (result.links.get(link_type) or [])[:50]:
                    links.append({
                        "href": link.get("href", ""),
                        "text": link.get("text", ""),
                        "type": link_type,
                    })

        return CrawlResponse(
            success=True,
            url=result.url or req.url,
            title=extract_title(result.html) if result.html else "",
            markdown=result.markdown or "",
            links=links,
        )

    except asyncio.TimeoutError:
        return CrawlResponse(
            success=False, url=req.url, error="Crawl timed out"
        )
    except Exception as e:
        return CrawlResponse(
            success=False, url=req.url, error=str(e)
        )


@app.post("/search", response_model=SearchResponse)
async def search_source(req: SearchRequest):
    """Search a specific source for a keyword by crawling it."""
    if not crawler:
        raise HTTPException(status_code=503, detail="Crawler not ready")

    source = req.source.lower()
    try:
        if source == "reddit":
            results = await search_reddit(req.keyword, req.limit)
        elif source == "twitter":
            results = await search_twitter(req.keyword, req.limit)
        elif source == "producthunt":
            results = await search_producthunt(req.keyword, req.limit)
        elif source == "devto":
            results = await search_devto(req.keyword, req.limit)
        elif source == "hackernews":
            results = await search_hackernews(req.keyword, req.limit)
        elif source == "stackoverflow":
            results = await search_stackoverflow(req.keyword, req.limit)
        elif source == "github":
            results = await search_github(req.keyword, req.limit)
        else:
            return SearchResponse(
                success=False,
                source=source,
                keyword=req.keyword,
                error=f"Unknown source: {source}",
            )

        return SearchResponse(
            success=True,
            source=source,
            keyword=req.keyword,
            results=results,
            count=len(results),
        )
    except Exception as e:
        return SearchResponse(
            success=False,
            source=source,
            keyword=req.keyword,
            error=str(e),
        )


# ---------------------------------------------------------------------------
# Source-specific crawlers
# ---------------------------------------------------------------------------
async def search_reddit(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl Reddit search results page."""
    url = f"https://old.reddit.com/search?q={_enc(keyword)}&sort=new&t=week"

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=3,
        css_selector="div.search-result",
    )

    result = await asyncio.wait_for(
        crawler.arun(url=url, config=cfg), timeout=30
    )

    if not result.success or not result.html:
        return []

    results = []
    html = result.html

    # Parse search results from old.reddit.com HTML
    post_pattern = re.compile(
        r'<a[^>]*class="[^"]*search-title[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>.*?'
        r'<span[^>]*class="[^"]*search-author[^"]*"[^>]*>.*?<a[^>]*>(.*?)</a>',
        re.DOTALL,
    )

    for match in post_pattern.finditer(html):
        href, title, author = match.group(1), match.group(2), match.group(3)
        title = _strip_html(title).strip()
        if not title:
            continue

        post_url = href if href.startswith("http") else f"https://old.reddit.com{href}"

        results.append(SearchResult(
            title=title,
            content=title,
            url=post_url,
            author=_strip_html(author),
            source="reddit",
            created_at=datetime.now(timezone.utc).isoformat(),
            metadata={"subreddit": _extract_subreddit(post_url)},
        ))

        if len(results) >= limit:
            break

    # Fallback: parse from markdown if HTML parsing got nothing
    if not results and result.markdown:
        results = _parse_reddit_markdown(result.markdown, limit)

    return results


async def search_twitter(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl Nitter instances for Twitter search results."""
    nitter_instances = [
        "https://nitter.privacydev.net",
        "https://nitter.poast.org",
    ]

    for instance in nitter_instances:
        try:
            url = f"{instance}/search?f=tweets&q={_enc(keyword)}"
            cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                word_count_threshold=3,
                css_selector=".timeline-item",
            )

            result = await asyncio.wait_for(
                crawler.arun(url=url, config=cfg), timeout=20
            )

            if not result.success or not result.markdown:
                continue

            results = _parse_nitter_results(result.markdown, result.html, instance, limit)
            if results:
                return results

        except Exception as e:
            print(f"[Twitter] Nitter {instance} failed: {e}")
            continue

    return []


async def search_producthunt(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl Product Hunt search page."""
    url = f"https://www.producthunt.com/search?q={_enc(keyword)}"

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=3,
        wait_for="css:[class*='post']",
    )

    try:
        result = await asyncio.wait_for(
            crawler.arun(url=url, config=cfg), timeout=30
        )
    except asyncio.TimeoutError:
        return []

    if not result.success or not result.markdown:
        return []

    return _parse_generic_markdown(result.markdown, "producthunt", keyword, limit)


async def search_devto(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl Dev.to search page."""
    url = f"https://dev.to/search?q={_enc(keyword)}&sort_by=published_at&sort_direction=desc"

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=3,
        css_selector=".crayons-story",
    )

    result = await asyncio.wait_for(
        crawler.arun(url=url, config=cfg), timeout=25
    )

    if not result.success or not result.markdown:
        return []

    return _parse_generic_markdown(result.markdown, "devto", keyword, limit)


async def search_hackernews(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl HN search via Algolia page."""
    url = f"https://hn.algolia.com/?dateRange=pastWeek&query={_enc(keyword)}&sort=byDate&type=story"

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=3,
    )

    result = await asyncio.wait_for(
        crawler.arun(url=url, config=cfg), timeout=25
    )

    if not result.success or not result.markdown:
        return []

    return _parse_generic_markdown(result.markdown, "hackernews", keyword, limit)


async def search_stackoverflow(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl Stack Overflow search page."""
    url = f"https://stackoverflow.com/search?q={_enc(keyword)}&tab=newest"

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=3,
        css_selector=".question-summary",
    )

    result = await asyncio.wait_for(
        crawler.arun(url=url, config=cfg), timeout=25
    )

    if not result.success or not result.markdown:
        return []

    return _parse_generic_markdown(result.markdown, "stackoverflow", keyword, limit)


async def search_github(keyword: str, limit: int) -> list[SearchResult]:
    """Crawl GitHub issue search."""
    url = f"https://github.com/search?q={_enc(keyword)}&type=issues&s=created&o=desc"

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=3,
    )

    result = await asyncio.wait_for(
        crawler.arun(url=url, config=cfg), timeout=25
    )

    if not result.success or not result.markdown:
        return []

    return _parse_generic_markdown(result.markdown, "github", keyword, limit)


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------
def _parse_reddit_markdown(markdown: str, limit: int) -> list[SearchResult]:
    """Parse Reddit results from crawled markdown."""
    results = []
    lines = markdown.split("\n")

    for i, line in enumerate(lines):
        # Look for markdown links: [title](url)
        link_match = re.search(r'\[([^\]]+)\]\((https?://[^\)]+)\)', line)
        if not link_match:
            continue

        title = link_match.group(1).strip()
        url = link_match.group(2).strip()

        if "/comments/" not in url and "/r/" not in url:
            continue

        if len(title) < 10:
            continue

        results.append(SearchResult(
            title=title,
            content=title,
            url=url if url.startswith("http") else f"https://reddit.com{url}",
            author="Unknown",
            source="reddit",
            created_at=datetime.now(timezone.utc).isoformat(),
            metadata={"subreddit": _extract_subreddit(url)},
        ))

        if len(results) >= limit:
            break

    return results


def _parse_nitter_results(
    markdown: str, html: str, instance: str, limit: int
) -> list[SearchResult]:
    """Parse Nitter search results."""
    results = []

    # Try parsing from markdown links
    lines = markdown.split("\n")
    current_author = ""
    current_content = ""

    for line in lines:
        # Author pattern: @username
        author_match = re.search(r'@(\w+)', line)
        if author_match and len(line) < 50:
            current_author = f"@{author_match.group(1)}"
            continue

        # Tweet content — lines with substantial text
        if len(line.strip()) > 20 and not line.startswith("#"):
            current_content = line.strip()

        # Link to tweet
        link_match = re.search(r'\((' + re.escape(instance) + r'/[^)]+/status/\d+)\)', line)
        if not link_match:
            link_match = re.search(r'(https?://[^\s)]+/status/\d+)', line)

        if link_match and current_content:
            nitter_url = link_match.group(1)
            twitter_url = re.sub(
                r'https?://[^/]+',
                'https://twitter.com',
                nitter_url,
            )

            results.append(SearchResult(
                title=current_content[:200],
                content=current_content,
                url=twitter_url,
                author=current_author or "Unknown",
                source="twitter",
                created_at=datetime.now(timezone.utc).isoformat(),
                metadata={"tweet_id": _extract_tweet_id(twitter_url)},
            ))

            current_content = ""
            if len(results) >= limit:
                break

    return results


def _parse_generic_markdown(
    markdown: str, source: str, keyword: str, limit: int
) -> list[SearchResult]:
    """Generic markdown parser — extracts links that match the keyword context."""
    results = []
    keyword_lower = keyword.lower()

    # Find all markdown links
    link_pattern = re.compile(r'\[([^\]]{10,})\]\((https?://[^\)]+)\)')

    for match in link_pattern.finditer(markdown):
        title = match.group(1).strip()
        url = match.group(2).strip()

        # Skip navigation/UI links
        if any(skip in title.lower() for skip in [
            "sign in", "log in", "sign up", "register", "cookie",
            "privacy", "terms", "about", "contact", "help",
            "next", "previous", "home", "menu",
        ]):
            continue

        # Skip very short titles
        if len(title) < 15:
            continue

        results.append(SearchResult(
            title=_strip_html(title)[:300],
            content=_strip_html(title),
            url=url,
            author="Unknown",
            source=source,
            created_at=datetime.now(timezone.utc).isoformat(),
            metadata={},
        ))

        if len(results) >= limit:
            break

    return results


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------
def _enc(text: str) -> str:
    """URL-encode a string."""
    from urllib.parse import quote_plus
    return quote_plus(text)


def _strip_html(text: str) -> str:
    """Remove HTML tags from text."""
    return re.sub(r'<[^>]+>', '', text)


def _extract_subreddit(url: str) -> str:
    """Extract subreddit name from URL."""
    match = re.search(r'/r/([^/]+)', url)
    return match.group(1) if match else "unknown"


def _extract_tweet_id(url: str) -> str:
    """Extract tweet ID from URL."""
    match = re.search(r'/status/(\d+)', url)
    return match.group(1) if match else ""


def extract_title(html: str) -> str:
    """Extract <title> from HTML."""
    match = re.search(r'<title[^>]*>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
    return _strip_html(match.group(1)).strip() if match else ""


# ---------------------------------------------------------------------------
# Run with: uvicorn main:app --host 0.0.0.0 --port 8000
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
