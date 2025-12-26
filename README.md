# 🔍 KeywordSentinel

**AI-Powered Keyword Monitoring SaaS** — Monitor the web for keywords that matter. Get instant AI-powered alerts when your keywords are mentioned on Reddit, Hacker News, Product Hunt, and more.

![KeywordSentinel](https://img.shields.io/badge/Status-MVP%20Ready-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Database-green)

## 🚀 Features

- **Always-On Monitoring** — Track keywords 24/7 across Reddit, Hacker News, Product Hunt, Google News
- **AI-Powered Summaries** — Get instant context on why each mention matters with sentiment analysis
- **Instant Alerts** — Email, Slack, and Discord notifications the moment keywords are mentioned
- **Lead Scoring** — AI identifies high-value opportunities like buyers asking for solutions
- **Competitor Tracking** — Monitor competitor mentions, sentiment, and feature requests
- **Beautiful Dashboard** — Modern, dark-themed UI built with shadcn/ui

## 📦 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Email/Password + Magic Link)
- **AI**: OpenAI GPT-4o-mini for summarization
- **Email**: Resend
- **Icons**: Lucide React

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key
- Resend API key (for email alerts)

### 1. Clone and Install

```bash
cd KeywordSentinel
npm install
```

### 2. Set Up Environment Variables

Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

Required environment variables:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Resend
RESEND_API_KEY=your_resend_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET_KEY=your_secret_for_cron_jobs
```

### 3. Set Up Database

Run the migration in your Supabase SQL Editor:

```bash
# Copy contents of supabase/migrations/001_initial_schema.sql
# Paste and run in Supabase SQL Editor
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login, signup)
│   ├── (dashboard)/      # Dashboard pages
│   ├── api/              # API routes
│   │   ├── keywords/     # Keyword CRUD
│   │   ├── matches/      # Matches API
│   │   └── scan/         # Scanning endpoint
│   └── auth/callback/    # Auth callback
├── components/
│   ├── dashboard/        # Dashboard components
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── services/         # Business logic
│   │   ├── sources/      # Source scrapers (Reddit, HN, etc.)
│   │   ├── ai.ts         # AI summarization
│   │   ├── alerts.ts     # Alert sending
│   │   └── scanner.ts    # Main scanning logic
│   └── supabase/         # Supabase clients
└── types/                # TypeScript types
```

## 🔄 Setting Up Cron Jobs

To run automatic scans, set up a cron job to call the scan API:

### Using Supabase Edge Functions (Recommended)

Create an edge function that calls your scan endpoint every X minutes.

### Using External Cron (e.g., cron-job.org)

Set up a POST request to:
```
POST https://your-domain.com/api/scan
Authorization: Bearer YOUR_CRON_SECRET_KEY
```

## 💰 Pricing Tiers

| Plan | Keywords | Scan Interval | Price |
|------|----------|---------------|-------|
| Free | 3 | 60 min | $0 |
| Pro | 50 | 15 min | $9/mo |
| Agency | 200 | 5 min | $29/mo |

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel deploy
```

### Netlify

```bash
npm run build
netlify deploy
```

## 📊 Monitored Sources

- 🔴 **Reddit** — Posts and comments via Reddit JSON API
- 🟠 **Hacker News** — Stories and comments via Algolia API
- 🟣 **Product Hunt** — Products (requires API key)
- 📰 **Google News** — Headlines via RSS feed
- 🐦 **Twitter/X** — Coming soon

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Secure authentication via Supabase Auth
- API routes protected with auth middleware

## 📝 License

MIT License - feel free to use this for your own projects!

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for indie hackers and founders who want to stay ahead.
