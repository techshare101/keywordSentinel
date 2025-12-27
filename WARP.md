# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Setup
```bash
npm install
```

### Development
```bash
npm run dev      # Start Next.js dev server at http://localhost:3000
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Environment Setup
Copy `env.example` to `.env.local` and configure:
- **Supabase**: URL, anon key, and service role key
- **OpenAI**: API key for AI summarization (GPT-4o-mini)
- **OpenRouter**: API key for lead discovery LLM (primary provider for scanning)
- **Firecrawl**: API key for enhanced web scraping (optional, falls back to free APIs)
- **Resend**: API key for email alerts (requires domain verification)
- **CRON_SECRET_KEY**: Secret for securing the `/api/scan` endpoint

### Manual Scanning
```bash
node run-scan.js              # Full scan for all users
node run-scan.js <userId>     # Scan specific user only
```

### Database Setup
Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor. This creates:
- Core tables: users, keywords, matches, alerts, user_settings
- Row Level Security (RLS) policies
- Indexes for performance
- Triggers for new user signup and timestamps

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Auth (email/password + magic link)
- **AI**: OpenAI GPT-4o-mini for match analysis and summarization
- **Email**: Resend for alert notifications
- **Payments**: Stripe for subscriptions

### Import Path Alias
Use `@/*` to reference `src/*` (configured in `tsconfig.json`)

### Source Architecture
The scanner system uses a pluggable source architecture in `src/lib/services/sources/`:
- Each source (Reddit, Hacker News, Product Hunt, Google News) has its own module
- `index.ts` orchestrates all sources via `searchAllSources(keyword)`
- Automatically uses **Firecrawl** for enhanced scraping if API key is set, otherwise falls back to free APIs
- Returns normalized `SearchResult` objects regardless of source

### Scanner Flow
1. **Cron trigger** → `/api/scan` endpoint (protected by `CRON_SECRET_KEY`)
2. **Scanner** (`scanner.ts`) fetches active keywords per user
3. **Source scrapers** search all configured sources in parallel
4. **Deduplication** filters out URLs already in the database
5. **AI analysis** (`ai.ts`) generates summary, sentiment, lead score (0-100), and suggested action
6. **Storage** saves matches to database with AI metadata
7. **Alerts** (`alerts.ts`) sends notifications via Email/Slack/Discord based on user settings

### Pricing Tiers
Defined in `src/lib/plans.ts`:
- **Free**: 3 keywords, 60-min scans, email alerts
- **Pro**: 50 keywords, 15-min scans, all alert types, CSV export
- **Team**: 200 keywords, 5-min scans, API access, webhooks

### Authentication & Authorization
- Next.js middleware (`middleware.ts`) handles session management
- All database tables use **Row Level Security (RLS)**
- Users can only access their own data via `auth.uid()` policies
- Use server-side Supabase client (service role key) for scanning operations
- Use browser client for frontend operations

### API Routes
Located in `src/app/api/`:
- **keywords/**: CRUD operations for keywords
- **matches/**: Fetch and update matches
- **scan/**: Trigger scans (cron endpoint)
- **scan/user/**: Per-user scanning
- **digest/**: Generate email digests
- **reply/**: AI-generated reply suggestions
- **export/**: CSV export of matches
- **stripe/**: Stripe checkout and webhooks

### Route Groups
- **(auth)**: Login, signup pages
- **(dashboard)**: Protected dashboard pages
- **auth/callback**: OAuth callback handler

## Key Services

### LLM Service (`lib/services/llm.ts`)
- `analyzeLeadDiscovery()`: Primary lead scoring using OpenRouter (GPT-4o-mini)
  - Returns: score (0-100), intent (buying/researching/complaining/casual/irrelevant), pain_summary, why_it_matters
  - Threshold: score >= 20 to be saved as a match
  - Bucket: score >= 70 = "hot", otherwise "warm"
- `analyzeMatch()`: Detailed analysis using OpenAI for premium features
- Falls back to defaults on error

### Insights API (`/api/insights/overview`)
Returns dashboard statistics:
- Hot/warm lead counts, unseen count, estimated value
- 7-day trend with growth percentage
- Sentiment and source breakdown
- Intent distribution from metadata
- Recent scan information

### Alert Service (`lib/services/alerts.ts`)
Sends notifications via:
- Email (Resend)
- Slack (webhooks)
- Discord (webhooks)

### Scanner Service (`lib/services/scanner.ts`)
- `scanKeywordsForUser(userId)`: Scans all active keywords for a specific user
- `runFullScan()`: Scans ALL keywords for ALL users (prioritizes pro/team users first)
  - No keyword limit per run - processes everything
  - 5-second delay between keywords to avoid rate limits
  - Returns: usersScanned, totalMatches, keywordsScanned, duration, errors
- Deduplicates by URL + keyword_id
- Limits to 20 new matches per scan per keyword

### Digest Service (`lib/services/digest.ts`)
Generates weekly email summaries of matches

### Reply Generator (`lib/services/reply-generator.ts`)
AI-powered reply suggestions for matches

### Firecrawl SAFE Module (`lib/services/firecrawl-safe.ts`)
**CRITICAL: Firecrawl is a PROTECTED RESOURCE - NEVER used in automated scans!**

Firecrawl is expensive and burns credits unpredictably. It is ONLY used for:
1. Manual "Deep Enrich" button on lead cards (Pro/Team users only)
2. Never in cron jobs, never in `/api/scan`, never automatically

**Hard Limits:**
- 10 calls per day (global)
- 2 calls per user per hour
- 100 calls per month (~$5 budget)

**Safe Config:** Only markdown format, no embeddings, no summarization, no recursive crawling.

API: `POST /api/enrich` - Manual lead enrichment (requires auth)
API: `GET /api/enrich` - Get usage stats

## Database Schema

### Users Table
Extends Supabase `auth.users` with plan info, keyword limits, and scan intervals. Automatically created on signup via trigger.

### Keywords Table
User-defined keywords to monitor. Has `is_active` flag for pausing.

### Matches Table
Discovered content mentioning keywords. Includes:
- Basic fields: title, content, url, author, source
- AI fields: sentiment, ai_summary, lead_score
- User interaction: is_read, is_bookmarked, notes

### Alerts Table
Log of sent notifications with status tracking.

### User Settings Table
Notification preferences: email_alerts, slack_webhook, discord_webhook, alert_frequency.

## Common Patterns

### Creating Supabase Clients
- **Browser client**: `import { createClient } from '@/lib/supabase/client'`
- **Server client**: Use service role key directly with `createClient()` from `@supabase/supabase-js`

### Adding New Sources
1. Create new file in `src/lib/services/sources/`
2. Export function that returns `SearchResult[]`
3. Add to `searchAllSources()` in `sources/index.ts`
4. Update `SourceType` in `types/database.ts`
5. Update database CHECK constraint in migration

### Testing the Scanner
```bash
# Trigger a scan for all users
curl -X POST http://localhost:3000/api/scan \
  -H "Authorization: Bearer YOUR_CRON_SECRET_KEY"

# Scan specific user
curl -X POST http://localhost:3000/api/scan \
  -H "Authorization: Bearer YOUR_CRON_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```

### Health Check
```bash
curl http://localhost:3000/api/scan
```

## Deployment

Deploy to Vercel:
1. Connect GitHub repository
2. Add all environment variables from `.env.local`
3. Deploy
4. Set up cron job (Vercel Cron, Supabase Edge Function, or external service) to call `/api/scan` endpoint

## Important Notes

- All source scrapers handle errors gracefully and return empty arrays on failure
- AI analysis never blocks match creation—defaults are used on error
- The scanner limits to 20 new matches per keyword per scan to control costs
- RLS policies ensure users can only see their own data
- The cron endpoint `/api/scan` MUST be secured with `CRON_SECRET_KEY`
- Firecrawl is optional; the app works with free APIs if not configured
