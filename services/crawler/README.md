# KeywordSentinel Crawler Service

A lightweight Python microservice powered by [Crawl4AI](https://github.com/unclecode/crawl4ai) that crawls web pages when direct API access fails.

## What It Does

- **Fallback crawler** — When Reddit, Twitter, or other sources block API requests, this service crawls the actual pages using a headless browser
- **Search endpoint** — Search any supported source by keyword
- **Crawl endpoint** — Crawl any URL and get clean markdown back
- **Zero API keys** — No third-party API keys needed

## Supported Sources

| Source | How It Crawls |
|---|---|
| Reddit | Crawls `old.reddit.com/search` |
| Twitter/X | Crawls Nitter instances |
| Product Hunt | Crawls PH search page |
| Dev.to | Crawls Dev.to search |
| Hacker News | Crawls HN Algolia search |
| Stack Overflow | Crawls SO search |
| GitHub | Crawls GitHub issue search |

## Quick Start (Local)

```bash
cd services/crawler

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Install browser (first time only)
crawl4ai-setup

# Run the service
python main.py
```

The service starts at `http://localhost:8000`.

## API Endpoints

### `GET /health`
Health check.

### `POST /crawl`
Crawl a single URL.
```json
{
  "url": "https://example.com",
  "css_selector": "main",
  "timeout": 30
}
```

### `POST /search`
Search a source for a keyword.
```json
{
  "source": "reddit",
  "keyword": "saas tools",
  "limit": 25
}
```

## Deploy to Railway (Recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Set the **Root Directory** to `services/crawler`
5. Railway auto-detects the Dockerfile
6. Copy the deployed URL

## Deploy to Render

1. Go to [render.com](https://render.com)
2. New → Web Service → Connect GitHub repo
3. Set **Root Directory** to `services/crawler`
4. Set **Docker** as the environment
5. Deploy and copy the URL

## Connect to KeywordSentinel

After deploying, add the service URL to your Next.js environment:

```bash
# In .env.local (or Vercel Environment Variables)
CRAWL4AI_SERVICE_URL=https://your-crawler-service.railway.app
```

The scanner will automatically use the crawler as a fallback when direct API calls fail. If the env var is not set, the crawler is simply skipped — no errors.

## Resource Requirements

- **RAM**: ~512MB (headless Chromium)
- **CPU**: Minimal (mostly waiting on network)
- **Disk**: ~500MB (Chromium + Python deps)
- **Cost**: Free tier on Railway/Render works fine for moderate usage
