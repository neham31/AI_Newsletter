# Product Requirements Document: AI News Aggregator & Newsletter Platform

## 1. Overview

### 1.1 Product Vision
A curated AI news aggregator that pulls content from the best AI newsletters and company blogs, deduplicates it, and delivers personalized email digests to subscribers — ensuring they never see the same news twice.

### 1.2 Problem Statement
AI professionals and enthusiasts subscribe to multiple newsletters (Rundown AI, Superhuman, TLDR AI, Ben's Bites, The Neuron, Import AI) and track company blogs (OpenAI, Anthropic, Google DeepMind), resulting in:
- Information overload and duplicate coverage across sources
- No single unified feed with customizable frequency
- Wasted time triaging which newsletters to open

### 1.3 Solution
A single subscription portal where users select their preferred AI news sources and delivery frequency. The system aggregates content, removes duplicates, and sends clean, clickable email digests containing only fresh (never-before-sent) articles tailored to each user's preferences.

### 1.4 Target Users
- AI/ML engineers and researchers
- Startup founders and product managers building with AI
- C-suite executives tracking the AI landscape
- Investors monitoring AI ecosystem developments

### 1.5 Success Metrics
- Subscriber count (capped at 3,000 for MVP)
- Email open rate (target: >40%)
- Click-through rate on article links (target: >15%)
- Unsubscribe rate (target: <2%)

---

## 2. Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | Fast development, SSR for SEO, single-repo simplicity |
| Backend | Next.js API Routes | No need for separate backend at MVP scale |
| Database | Supabase (PostgreSQL) | Free tier supports MVP, built-in auth, Row Level Security, real-time |
| Email Delivery | Resend + React Email | Free for first 3k emails/month, excellent DX, beautiful templates |
| AI Processing | Claude API (claude-sonnet-4-5-20250929) | Extract structured data from raw newsletter HTML, auto-tagging |
| Email Ingestion | Mailgun Inbound Routing | Reliable inbound email parsing, webhook-based, free tier available |
| Hosting | Vercel (Hobby → Pro) | Free tier, native Next.js support, edge functions, cron jobs |
| Cron/Scheduling | Vercel Cron Jobs | Trigger digest assembly on schedule (daily/weekly) |
| Monitoring | Vercel Analytics + Sentry (free tier) | Error tracking and basic usage analytics |

---

## 3. Information Architecture & Database Schema

### 3.1 Entity Relationship Overview

```
sources ──< articles ──< user_article_log >── users
                                                 │
sources ──< user_subscriptions >── users         │
                                                 │
                          system_config ─────────┘
```

### 3.2 Table Definitions

#### `sources`
Represents each newsletter or blog the system ingests from.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| name | text | NOT NULL, UNIQUE | Display name (e.g., "The Rundown AI") |
| slug | text | NOT NULL, UNIQUE | URL-safe identifier (e.g., "rundown-ai") |
| type | enum | 'newsletter' \| 'blog' | Content source type |
| description | text | | "Best for..." text shown on signup |
| audience | text | | Target audience description |
| reach | text | | Subscriber count / reach info |
| feed_url | text | NULLABLE | RSS/Atom feed URL (for blogs) |
| intake_email | text | NULLABLE | Email address subscribed to this newsletter |
| icon_url | text | NULLABLE | Source logo/icon for email template |
| is_active | boolean | DEFAULT true | Whether ingestion is enabled |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Seed data — 9 sources:**
1. The Rundown AI (newsletter) — Daily business applications & news — 1.75M+ (C-Suite, Founders)
2. Superhuman AI (newsletter) — Productivity, tool discovery & news — 1.25M+ (Marketers, Enthusiasts)
3. TLDR AI (newsletter) — Technical updates, ML & research papers — 1.25M+ (Engineers, Scientists)
4. Ben's Bites (newsletter) — Early-stage ecosystem & builder insights — 120k+ (Solopreneurs, Investors)
5. The Neuron (newsletter) — Balanced technical/practical insights — 550k+ (Multi-industry Teams)
6. Import AI (newsletter) — Policy, governance & research deep dives — Niche Policy Experts
7. OpenAI Blog (blog) — feed_url: https://openai.com/blog/rss.xml
8. Anthropic Blog (blog) — feed_url: https://www.anthropic.com/rss.xml
9. Google DeepMind Blog (blog) — feed_url: https://deepmind.google/blog/rss.xml

_(Note: RSS URLs should be verified at build time; some may require scraping as fallback.)_

#### `articles`
Every individual piece of content extracted from sources.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| source_id | uuid | FK → sources.id, NOT NULL | Origin source |
| headline | text | NOT NULL | Article title/headline |
| summary | text | NOT NULL | 2-3 sentence summary |
| url | text | NOT NULL | Direct link to original article/post |
| url_hash | text | NOT NULL, UNIQUE | SHA-256 of normalized URL for dedup |
| tags | text[] | DEFAULT '{}' | Auto-generated tags array |
| image_url | text | NULLABLE | Thumbnail/hero image if available |
| published_at | timestamptz | NOT NULL | Original publish date |
| ingested_at | timestamptz | DEFAULT now() | When system processed it |
| raw_email_id | text | NULLABLE | Reference to source email (for debugging) |
| extraction_confidence | float | DEFAULT 1.0 | Claude's confidence in extraction quality (0-1) |

**Indexes:**
- `idx_articles_url_hash` UNIQUE on url_hash (deduplication)
- `idx_articles_source_published` on (source_id, published_at DESC)
- `idx_articles_published` on published_at DESC
- `idx_articles_tags` GIN index on tags

#### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| email | text | NOT NULL, UNIQUE | Subscriber email |
| email_verified | boolean | DEFAULT false | Whether email is confirmed via double opt-in |
| verification_token | text | NULLABLE | Token for email verification |
| unsubscribe_token | text | NOT NULL, UNIQUE | Permanent token for one-click unsubscribe |
| frequency | enum | 'daily' \| 'weekly' | Delivery cadence |
| is_active | boolean | DEFAULT true | Can unsubscribe (soft delete) |
| signed_up_at | timestamptz | DEFAULT now() | Used to filter articles (only send post-signup content) |
| last_email_sent_at | timestamptz | NULLABLE | Last time a digest was sent |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:**
- `idx_users_email` UNIQUE on email
- `idx_users_active_frequency` on (is_active, frequency) WHERE is_active = true
- `idx_users_unsubscribe_token` UNIQUE on unsubscribe_token

#### `user_subscriptions`
Which sources each user has opted into.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| user_id | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE | |
| source_id | uuid | FK → sources.id, NOT NULL | |
| created_at | timestamptz | DEFAULT now() | |

**Constraints:** UNIQUE(user_id, source_id)

#### `user_article_log`
Tracks which articles have been sent to which users — the core freshness mechanism.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| user_id | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE | |
| article_id | uuid | FK → articles.id, NOT NULL | |
| sent_at | timestamptz | DEFAULT now() | When the article was included in a digest |
| digest_batch_id | text | NOT NULL | Groups articles sent in the same email |

**Constraints:** UNIQUE(user_id, article_id)
**Indexes:**
- `idx_ual_user_article` UNIQUE on (user_id, article_id)
- `idx_ual_user_sent` on (user_id, sent_at DESC)

#### `system_config`
Key-value store for system-level settings.

| Column | Type | Constraints | Description |
|---|---|---|---|
| key | text | PK | Config key |
| value | jsonb | NOT NULL | Config value |
| updated_at | timestamptz | DEFAULT now() | |

**Seed data:**
- `max_subscribers`: `{ "limit": 3000, "enabled": true }`
- `subscriptions_paused`: `{ "paused": false, "message": "We've hit capacity! Join the waitlist." }`

#### `waitlist`
Captures users who try to sign up after the 3k cap is reached.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| email | text | NOT NULL, UNIQUE | |
| created_at | timestamptz | DEFAULT now() | |

#### `ingestion_log`
Operational log for debugging the content pipeline.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| source_id | uuid | FK → sources.id | |
| type | enum | 'email_received' \| 'rss_polled' \| 'extraction_success' \| 'extraction_failed' \| 'duplicate_skipped' | |
| details | jsonb | | Raw metadata, error messages, etc. |
| created_at | timestamptz | DEFAULT now() | |

---

## 4. Content Ingestion Pipeline

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT INGESTION PIPELINE                    │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐   │
│  │   INBOUND    │     │   INBOUND    │     │   SCHEDULED    │   │
│  │   EMAIL      │     │   EMAIL      │     │   RSS POLLER   │   │
│  │  (Mailgun    │     │  (Mailgun    │     │  (Vercel Cron) │   │
│  │   Webhook)   │     │   Webhook)   │     │  Every 2 hrs   │   │
│  │              │     │              │     │                │   │
│  │  Rundown AI  │     │  Ben's Bites │     │  OpenAI Blog   │   │
│  │  Superhuman  │     │  The Neuron  │     │  Anthropic Blog│   │
│  │  TLDR AI     │     │  Import AI   │     │  DeepMind Blog │   │
│  └──────┬───────┘     └──────┬───────┘     └───────┬────────┘   │
│         │                    │                     │            │
│         └────────────┬───────┘                     │            │
│                      ▼                             ▼            │
│         ┌────────────────────┐        ┌────────────────────┐    │
│         │   EMAIL PARSER     │        │   RSS/FEED PARSER  │    │
│         │                    │        │                    │    │
│         │ 1. Receive webhook │        │ 1. Fetch feed XML  │    │
│         │ 2. Match to source │        │ 2. Parse entries   │    │
│         │ 3. Extract HTML    │        │ 3. Extract fields  │    │
│         │    body            │        │ 4. Check url_hash  │    │
│         └────────┬───────────┘        │    for dedup       │    │
│                  │                    └─────────┬──────────┘    │
│                  ▼                              │               │
│     ┌─────────────────────────┐                 │               │
│     │   CLAUDE API            │                 │               │
│     │   EXTRACTION            │                 │               │
│     │                         │                 │               │
│     │ Input: Raw HTML email   │                 │               │
│     │ Output: JSON array of   │                 │               │
│     │   - headline            │                 │               │
│     │   - summary (2-3 sent.) │                 │               │
│     │   - url                 │                 │               │
│     │   - tags[]              │                 │               │
│     │   - published_at        │                 │               │
│     │   - image_url           │                 │               │
│     │   - confidence (0-1)    │                 │               │
│     └────────────┬────────────┘                 │               │
│                  │                              │               │
│                  └──────────────┬────────────────┘               │
│                                ▼                                │
│                  ┌─────────────────────────┐                    │
│                  │   DEDUPLICATION &        │                    │
│                  │   STORAGE                │                    │
│                  │                          │                    │
│                  │ 1. Normalize URL         │                    │
│                  │ 2. Compute SHA-256 hash  │                    │
│                  │ 3. Check url_hash exists │                    │
│                  │ 4. INSERT if new         │                    │
│                  │ 5. Log to ingestion_log  │                    │
│                  └──────────┬──────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Email Ingestion (Newsletters)

#### Setup
1. Register a domain (e.g., `intake.yourdomain.com`) with Mailgun for inbound routing.
2. Create unique receiving addresses per source: `rundown@intake.yourdomain.com`, `superhuman@intake.yourdomain.com`, etc.
3. Subscribe each address to the corresponding newsletter.
4. Configure Mailgun inbound routes to forward all incoming emails to a single webhook endpoint.

#### Webhook Endpoint: `POST /api/ingest/email`

```
Request arrives from Mailgun webhook:
{
  recipient: "rundown@intake.yourdomain.com",
  sender: "newsletter@therundownai.com",
  subject: "...",
  body-html: "<full HTML email content>",
  body-plain: "plain text fallback",
  timestamp: "...",
  Message-Id: "..."
}
```

**Processing steps:**

1. **Authenticate webhook** — verify Mailgun signature (timestamp + token + signing key).
2. **Match source** — look up `sources` table by matching `recipient` to `sources.intake_email`.
3. **Skip if source inactive** — check `sources.is_active`.
4. **Log receipt** — insert into `ingestion_log` with type `email_received`.
5. **Send HTML to Claude API for extraction** (see §4.4).
6. **Store extracted articles** with deduplication (see §4.5).
7. **Return 200 OK** to Mailgun (must respond within 10s; use background job for heavy processing).

#### Background Processing
Since Vercel serverless functions have time limits, and Claude API calls can take a few seconds:
- The webhook endpoint should validate + store the raw email in a `raw_emails` temporary table, then return 200 immediately.
- A separate Vercel Cron job (every 5 minutes) picks up unprocessed raw emails and runs the Claude extraction pipeline.
- Alternatively, use Vercel's `waitUntil()` API to continue processing after returning the response.

### 4.3 RSS/Blog Ingestion

#### Cron Job: Runs every 2 hours via Vercel Cron

**Endpoint:** `POST /api/ingest/rss` (protected by cron secret)

**Processing steps for each blog source:**

1. Fetch the RSS/Atom feed XML from `sources.feed_url`.
2. Parse XML using a library like `rss-parser`.
3. For each entry:
   - Extract: title, link, description/content, pubDate, image (from `<media:content>` or `<enclosure>`).
   - Normalize the URL (strip tracking params like `utm_*`, trailing slashes).
   - Compute `url_hash = SHA-256(normalized_url)`.
   - Check if `url_hash` exists in `articles` table.
   - If new → INSERT with source_id, headline, summary (use description or first 3 sentences of content), url, tags (derive from categories if available, otherwise run through Claude for tagging).
   - If duplicate → skip, log to `ingestion_log` with type `duplicate_skipped`.
4. Log completion to `ingestion_log`.

#### RSS Fallback
If a blog doesn't have an RSS feed or the feed URL breaks:
- Fall back to scraping the blog listing page.
- Use a simple HTML parser (cheerio) to extract article titles, URLs, and dates.
- Run extracted content through Claude for summary + tagging.

### 4.4 Claude API Extraction (Newsletter Emails)

#### Prompt Template

```
System: You are a precise news extraction engine. Extract individual AI news items
from the newsletter HTML below. Return ONLY valid JSON, no other text.

User:
Source newsletter: {source_name}
Date received: {received_date}

HTML content:
{body_html}

Extract each distinct news item as a JSON array. For each item return:
{
  "headline": "Clear, concise headline (max 120 chars)",
  "summary": "2-3 sentence summary of the news item. Be factual and specific.",
  "url": "Direct URL to the original source (not the newsletter link, but the
          underlying article/announcement). If not available, use the
          newsletter's own link to this item.",
  "tags": ["tag1", "tag2"],
  "image_url": "URL of associated image if present, null otherwise",
  "published_at": "ISO 8601 date if mentioned, otherwise use {received_date}",
  "confidence": 0.95
}

Valid tags (use 1-3 per item):
- "LLMs"
- "Image & Video Gen"
- "Audio & Speech"
- "Agents"
- "Open Source"
- "Research"
- "Regulation & Policy"
- "Funding & M&A"
- "Product Launch"
- "Developer Tools"
- "Benchmarks"
- "Robotics"
- "Enterprise AI"
- "AI Safety"
- "Startups"

Rules:
- Extract ALL distinct news items, typically 5-15 per newsletter.
- Each item must have a unique URL. Skip items without a clear link.
- Summaries should be self-contained — understandable without reading the
  original.
- Set confidence < 0.7 if extraction was ambiguous.
- Do NOT include newsletter meta-content (subscription promos, sponsor ads,
  "share with a friend" blocks, footer links).
- Do NOT include sponsored/advertisement sections.
```

#### Error Handling
- If Claude returns invalid JSON → retry once with a stricter prompt ("You returned invalid JSON. Return ONLY a JSON array.").
- If retry fails → log to `ingestion_log` with type `extraction_failed`, store raw email for manual review.
- If articles extracted = 0 but email is non-empty → flag for review (possible format change).
- Items with `confidence < 0.5` → exclude from digests, log for review.

#### Cost Estimation
- Average newsletter HTML: ~15k tokens input.
- Claude Sonnet output: ~2k tokens.
- 6 newsletters × ~5 emails/week = ~30 extractions/week.
- Estimated cost: < $1/week at current Sonnet pricing.

### 4.5 Deduplication Strategy

**URL Normalization (applied before hashing):**
1. Convert to lowercase.
2. Remove query parameters: `utm_*`, `ref`, `source`, `mc_cid`, `mc_eid`.
3. Remove trailing slashes.
4. Remove `www.` prefix.
5. Remove URL fragments (`#section`).

**Deduplication layers:**
1. **Exact URL match** — primary method via `url_hash` unique constraint.
2. **Cross-source semantic dedup (Phase 2 enhancement)** — if two different newsletters cover the same story with different source URLs, use Claude to detect similarity. For MVP, this is optional — exact URL dedup catches most cases since newsletters link to the same original announcements.

### 4.6 Ingestion Monitoring

Set up alerts (via Sentry or simple email) for:
- Any source that hasn't produced new articles in 7+ days (possible feed/subscription break).
- Extraction failure rate > 20% for any source.
- Sudden spike in duplicates (possible re-send or format change).

Admin can check `ingestion_log` table for operational debugging.

---

## 5. Newsletter Assembly & Delivery Pipeline

### 5.1 Digest Assembly Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  NEWSLETTER DELIVERY PIPELINE                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CRON TRIGGERS                         │    │
│  │                                                          │    │
│  │  Daily:   Every day at 8:00 AM IST (Vercel Cron)         │    │
│  │  Weekly:  Every Monday at 8:00 AM IST                    │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              DIGEST ASSEMBLY ENGINE                       │   │
│  │                                                           │   │
│  │  For each active user matching the current frequency:     │   │
│  │                                                           │   │
│  │  1. Get user's subscribed source_ids                      │   │
│  │                                                           │   │
│  │  2. Query articles WHERE:                                 │   │
│  │     - source_id IN (user's sources)                       │   │
│  │     - published_at > user.signed_up_at                    │   │
│  │     - article.id NOT IN (                                 │   │
│  │         SELECT article_id FROM user_article_log           │   │
│  │         WHERE user_id = current_user                      │   │
│  │       )                                                   │   │
│  │     - confidence >= 0.5                                   │   │
│  │     ORDER BY published_at DESC                            │   │
│  │     LIMIT 20                                              │   │
│  │                                                           │   │
│  │  3. If 0 articles found → skip user (no empty emails)     │   │
│  │                                                           │   │
│  │  4. Group articles by source for email layout             │   │
│  │                                                           │   │
│  │  5. Generate digest_batch_id (uuid)                       │   │
│  │                                                           │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              EMAIL RENDERING (React Email)                │   │
│  │                                                           │   │
│  │  Template: digest-email.tsx                               │   │
│  │                                                           │   │
│  │  Renders:                                                 │   │
│  │  - Header with logo + date                                │   │
│  │  - Article count summary                                  │   │
│  │  - Article blocks grouped by source:                      │   │
│  │    ┌─────────────────────────────────────────┐            │   │
│  │    │ [Source Icon] Source Name                │            │   │
│  │    │                                         │            │   │
│  │    │ ▸ Headline (clickable → article URL)    │            │   │
│  │    │   Summary text (2-3 sentences)          │            │   │
│  │    │   [Tag] [Tag] [Tag]                     │            │   │
│  │    │                                         │            │   │
│  │    │ ▸ Headline (clickable → article URL)    │            │   │
│  │    │   Summary text (2-3 sentences)          │            │   │
│  │    │   ...                                   │            │   │
│  │    └─────────────────────────────────────────┘            │   │
│  │  - Footer with unsubscribe link + manage preferences      │   │
│  │                                                           │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SEND VIA RESEND                              │   │
│  │                                                           │   │
│  │  - Batch send with Resend API (up to 100/batch)           │   │
│  │  - From: digest@yourdomain.com                            │   │
│  │  - Subject: "Your AI Digest — {date} ({count} stories)"  │   │
│  │  - Include List-Unsubscribe header (RFC 8058)             │   │
│  │  - Rate limit: 10 emails/second (Resend free tier)        │   │
│  │                                                           │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              POST-SEND BOOKKEEPING                        │   │
│  │                                                           │   │
│  │  - INSERT into user_article_log for each article sent     │   │
│  │  - UPDATE users.last_email_sent_at                        │   │
│  │  - Log send result (success/failure) in ingestion_log     │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Email Deliverability Configuration

- **Domain:** Set up a dedicated sending subdomain (e.g., `mail.yourdomain.com`).
- **DNS records:** SPF, DKIM (via Resend), DMARC with `p=none` initially.
- **List-Unsubscribe header:** Include in every email (required for Gmail deliverability).
- **Unsubscribe link:** Every email footer includes a one-click unsubscribe link using the user's `unsubscribe_token`.
- **Warm-up:** If launching to many users at once, gradually increase send volume over 2 weeks.

---

## 6. Subscriber Cap System (3,000 User Limit)

### 6.1 How It Works

The system enforces a configurable subscriber cap. When the cap is reached, new signups are redirected to a waitlist.

### 6.2 Implementation

#### Signup Flow with Cap Check

```
User submits signup form
        │
        ▼
  API: POST /api/subscribe
        │
        ▼
  Read system_config('max_subscribers')
  Read system_config('subscriptions_paused')
        │
        ├── If paused OR active_user_count >= limit:
        │       → INSERT into waitlist table
        │       → Return: { waitlisted: true, position: N }
        │       → Show waitlist confirmation UI
        │
        └── If under limit:
                → INSERT into users table
                → INSERT into user_subscriptions
                → Send verification email
                → Return: { success: true }
```

#### Admin Controls (via direct DB or simple admin API)

**Pause subscriptions manually (before hitting 3k):**
```sql
UPDATE system_config
SET value = '{"paused": true, "message": "We are at capacity. Join the waitlist!"}'
WHERE key = 'subscriptions_paused';
```

**Adjust the cap:**
```sql
UPDATE system_config
SET value = '{"limit": 5000, "enabled": true}'
WHERE key = 'max_subscribers';
```

**Check current count:**
```sql
SELECT COUNT(*) FROM users WHERE is_active = true AND email_verified = true;
```

### 6.3 UI Behavior

- **Below cap:** Normal signup form.
- **At/above cap:** Signup form transforms into a waitlist form with message: "We've reached capacity! Drop your email below and we'll notify you when a spot opens up." Only the email field + a "Join Waitlist" button are shown. The source selection and frequency fields are hidden.
- The subscriber count and cap status should be fetched client-side on page load via `GET /api/subscription-status` → `{ accepting: boolean, waitlist_count: number }`.

---

## 7. API Endpoints

### 7.1 Public Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/subscription-status` | Returns `{ accepting: boolean, waitlistCount: number }` |
| POST | `/api/subscribe` | Create new subscriber or add to waitlist |
| GET | `/api/verify?token={token}` | Email verification (double opt-in) |
| GET | `/api/unsubscribe?token={token}` | One-click unsubscribe |
| GET | `/api/preferences?token={token}` | Get current preferences for management page |
| PUT | `/api/preferences` | Update sources/frequency (requires unsubscribe_token) |

### 7.2 Protected Endpoints (Webhook / Cron)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ingest/email` | Mailgun signature | Inbound email webhook |
| POST | `/api/ingest/rss` | Vercel cron secret | RSS poll trigger |
| POST | `/api/digest/send` | Vercel cron secret | Trigger digest assembly + send |

### 7.3 Endpoint Details

#### `POST /api/subscribe`

**Request:**
```json
{
  "email": "user@example.com",
  "sources": ["rundown-ai", "openai-blog", "tldr-ai"],
  "frequency": "daily"
}
```

**Validation:**
- Email: valid format, not already registered (if already registered + active → return friendly "already subscribed" message with link to manage preferences).
- Sources: at least 1 selected, all must be valid slugs from `sources` table.
- Frequency: must be `daily` or `weekly`.

**Success Response (under cap):**
```json
{
  "success": true,
  "message": "Check your email to confirm your subscription!"
}
```

**Waitlisted Response:**
```json
{
  "waitlisted": true,
  "position": 142,
  "message": "We're at capacity! You're #142 on the waitlist."
}
```

#### `GET /api/verify?token={token}`

- Look up user by `verification_token`.
- Set `email_verified = true`, clear `verification_token`.
- Redirect to a success page on the frontend.

#### `GET /api/unsubscribe?token={token}`

- Look up user by `unsubscribe_token`.
- Set `is_active = false`.
- Redirect to a confirmation page: "You've been unsubscribed. Changed your mind? [Re-subscribe]"

---

## 8. UI/UX Specification

### 8.1 Design System

#### Color Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| Background | Soft cream | `#FAFAF7` | Page background |
| Card background | White | `#FFFFFF` | Cards, form containers |
| Card border | Light gray | `#E8E8E4` | Subtle card borders (1px solid) |
| Primary accent | Soft lavender | `#B8A9E8` | CTA buttons, active states, focus rings |
| Primary hover | Deeper lavender | `#9B87D6` | Button hover state |
| Secondary accent | Pale mint | `#A8D8C8` | Tags, secondary indicators, success states |
| Tertiary accent | Soft peach | `#F5C5A3` | Highlights, badges, frequency selector |
| Text primary | Charcoal | `#2D2D2D` | Headlines, body text |
| Text secondary | Warm gray | `#6B6B6B` | Descriptions, labels, placeholder text |
| Text muted | Light warm gray | `#9B9B9B` | Captions, helper text |
| Error | Soft rose | `#E8A0A0` | Validation errors |
| Success | Soft green | `#A0D8B8` | Confirmation messages |

#### Typography

| Element | Font | Weight | Size |
|---|---|---|---|
| Logo/Brand | Inter | 700 | 24px |
| Page headline | Inter | 600 | 32px |
| Section headers | Inter | 600 | 20px |
| Body text | Inter | 400 | 16px |
| Labels / captions | Inter | 500 | 14px |
| Small / helper text | Inter | 400 | 12px |

#### Spacing & Layout
- Max content width: 640px (centered).
- Card padding: 24px.
- Card border-radius: 12px.
- Card shadow: `0 1px 3px rgba(0,0,0,0.04)`.
- Section spacing: 32px.
- Element spacing within sections: 16px.
- Button border-radius: 8px.
- Button padding: 12px 24px.

### 8.2 Page Structure

The application is a single-page site with 4 views:

```
yourdomain.com/                  → Landing + signup form
yourdomain.com/verify-success    → Email verification confirmation
yourdomain.com/preferences       → Manage subscription (via token)
yourdomain.com/unsubscribed      → Unsubscribe confirmation
```

### 8.3 Page: Landing + Signup (`/`)

#### Layout (top to bottom):

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                     [Logo / Brand Name]                      │
│                                                              │
│              Your AI news, curated & deduplicated.           │
│       Pick your sources. Choose your frequency. That's it.   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ SECTION: Choose your sources ─────────────────────────┐  │
│  │                                                         │  │
│  │  Newsletters                                            │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ ☐  The Rundown AI                                 │  │  │
│  │  │     Daily business applications & news            │  │  │
│  │  │     1.75M+ readers · C-Suite, Founders            │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  Superhuman AI                                  │  │  │
│  │  │     Productivity, tool discovery & news           │  │  │
│  │  │     1.25M+ readers · Marketers, Enthusiasts       │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  TLDR AI                                        │  │  │
│  │  │     Technical updates, ML & research papers       │  │  │
│  │  │     1.25M+ readers · Engineers, Scientists        │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  Ben's Bites                                    │  │  │
│  │  │     Early-stage ecosystem & builder insights      │  │  │
│  │  │     120k+ readers · Solopreneurs, Investors       │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  The Neuron                                     │  │  │
│  │  │     Balanced technical/practical insights         │  │  │
│  │  │     550k+ readers · Multi-industry Teams          │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  Import AI                                      │  │  │
│  │  │     Policy, governance & research deep dives      │  │  │
│  │  │     Niche · Policy Experts                        │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  Company Blogs                                          │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ ☐  OpenAI Blog                                    │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  Anthropic Blog                                 │  │  │
│  │  ├───────────────────────────────────────────────────┤  │  │
│  │  │ ☐  Google DeepMind Blog                           │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  [Select All]                                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ SECTION: How often? ──────────────────────────────────┐  │
│  │                                                         │  │
│  │  ┌──────────────────────┐ ┌──────────────────────┐          │  │
│  │  │       Daily          │ │       Weekly         │          │  │
│  │  │        ●             │ │                      │          │  │
│  │  └──────────────────────┘ └──────────────────────┘          │  │
│  │                                                         │  │
│  │  Helper text per selection:                             │  │
│  │  Daily: "One digest every morning at 8 AM"              │  │
│  │  Weekly: "Every Monday morning"                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ SECTION: Subscribe ───────────────────────────────────┐  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────┐ ┌──────────────┐   │  │
│  │  │ your@email.com                  │ │  Subscribe → │   │  │
│  │  └─────────────────────────────────┘ └──────────────┘   │  │
│  │                                                         │  │
│  │  We'll send a confirmation email. No spam, ever.        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ FOOTER ────────────────────────────────────────────────┐  │
│  │  Built with ♥ · Unsubscribe anytime                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Interaction Details

**Source cards:**
- Each source is a clickable card with a checkbox.
- On hover: subtle elevation increase (`shadow: 0 2px 8px rgba(0,0,0,0.06)`).
- Selected state: lavender left border (3px) + faint lavender background (`#B8A9E8` at 8% opacity).
- Checkbox uses the lavender accent color when checked.
- "Select All" is a text button (not a card) below the source lists.

**Frequency selector:**
- Two pill-shaped buttons side by side.
- Default selected: "Daily" (pre-selected with lavender fill + white text).
- Unselected: white fill, charcoal text, `#E8E8E4` border.
- Below the selected pill, helper text fades in with a subtle transition.

**Email input + subscribe button:**
- Input and button sit on the same row.
- Input: white background, `#E8E8E4` border, charcoal text, lavender focus ring.
- Button: lavender background (`#B8A9E8`), white text, transitions to `#9B87D6` on hover.
- On submit: button shows a loading spinner (small, white), disables input.

**Validation states:**
- No sources selected → red helper text below sources: "Please select at least one source."
- Invalid email → red helper text below input: "Please enter a valid email address."
- Already subscribed → friendly inline message: "You're already subscribed! [Manage preferences →]"
- Errors use the soft rose color (`#E8A0A0`), no harsh red.

**Success state:**
- After successful submit, the form area transitions (fade) to a confirmation card:
- ✓ icon (mint green, `#A0D8B8`)
- "Check your inbox!"
- "We've sent a confirmation email to **you@email.com**. Click the link to activate your subscription."

#### Waitlist State (At Capacity)

When `GET /api/subscription-status` returns `{ accepting: false }`:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                     [Logo / Brand Name]                      │
│                                                              │
│              Your AI news, curated & deduplicated.           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │       🎉  We've hit capacity!                           │ │
│  │                                                         │ │
│  │  We're currently serving 3,000 subscribers and want     │ │
│  │  to keep the experience great. Drop your email below    │ │
│  │  and we'll let you know when a spot opens up.           │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────┐ ┌──────────────┐   │ │
│  │  │ your@email.com                  │ │ Join List →  │   │ │
│  │  └─────────────────────────────────┘ └──────────────┘   │ │
│  │                                                         │ │
│  │  {waitlist_count} people ahead of you                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

- The source selection and frequency picker are hidden entirely.
- Only the email field and "Join List" button are shown.
- After joining: "You're on the list! We'll email you when a spot opens."

### 8.4 Page: Email Verification Success (`/verify-success`)

Simple centered confirmation:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                     [Logo / Brand Name]                      │
│                                                              │
│                    ✓  You're all set!                        │
│                                                              │
│        Your subscription is confirmed. Your first            │
│        digest will arrive based on your chosen               │
│        frequency.                                            │
│                                                              │
│                  [Manage Preferences →]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.5 Page: Manage Preferences (`/preferences?token={unsubscribe_token}`)

Accessed via link in every email footer. Shows the same source selection and frequency picker as the signup page, pre-populated with the user's current choices. Includes a "Save Changes" button and a destructive "Unsubscribe" link at the bottom.

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                     [Logo / Brand Name]                      │
│                                                              │
│                   Manage Your Subscription                    │
│                                                              │
│  ┌─ Your Sources ─────────────────────────────────────────┐  │
│  │  (Same source cards as signup, pre-checked)             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Frequency ────────────────────────────────────────────┐  │
│  │  [ Daily ● ] [ Weekly ]                                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│                    [ Save Changes ]                           │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│  Want to unsubscribe entirely? [Unsubscribe →]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.6 Page: Unsubscribed (`/unsubscribed`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                     [Logo / Brand Name]                      │
│                                                              │
│                  You've been unsubscribed.                    │
│                                                              │
│          We're sorry to see you go. You won't                │
│          receive any more emails from us.                     │
│                                                              │
│              Changed your mind? [Re-subscribe →]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.7 Responsive Design

- The site is mobile-first. The 640px max-width container ensures readability on all screens.
- On mobile (< 480px):
  - Source cards stack full-width with slightly reduced padding (16px).
  - Frequency pills stack vertically instead of side by side.
  - Email input and button stack vertically (input full-width, button full-width below).
- No hamburger menus or complex navigation — the site is a single flow.

---

## 9. Email Template Specification

### 9.1 Digest Email Template

Built with React Email for consistent rendering across clients. Design mirrors the website's pastel aesthetic.

**Subject line:** `Your AI Digest — {day_of_week}, {date} ({count} stories)`
**From:** `AI Digest <digest@yourdomain.com>`
**Preview text:** First 2-3 headlines concatenated.

#### Email Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  [Logo]   Your AI Digest                                     │
│  {Day}, {Month} {Date}, {Year}  ·  {count} new stories      │
│                                                              │
│  ════════════════════════════════════════════════════════════ │
│                                                              │
│  THE RUNDOWN AI                                              │
│  ──────────────                                              │
│                                                              │
│  ▸ Headline Goes Here (clickable link)                       │
│    Summary text spanning 2-3 sentences. Provides enough      │
│    context to decide whether to click through.               │
│    [LLMs] [Product Launch]                                   │
│                                                              │
│  ▸ Another Headline Here (clickable link)                    │
│    Another summary with enough detail to be useful           │
│    on its own.                                               │
│    [Funding & M&A] [Startups]                                │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  OPENAI BLOG                                                 │
│  ──────────────                                              │
│                                                              │
│  ▸ Blog Post Title (clickable link)                          │
│    Summary of the blog post content.                         │
│    [LLMs] [Research]                                         │
│                                                              │
│  ════════════════════════════════════════════════════════════ │
│                                                              │
│  You're receiving this because you subscribed on {date}.     │
│  [Manage Preferences]  ·  [Unsubscribe]                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Email Styling

| Element | Style |
|---|---|
| Background | `#FAFAF7` (matches website) |
| Content container | `#FFFFFF`, max-width 600px, centered |
| Header | Logo + date, bottom border `#E8E8E4` |
| Source section header | Uppercase, `#6B6B6B`, 13px, Inter 600, letter-spacing 0.5px |
| Headline link | `#2D2D2D`, 16px, Inter 600, text-decoration none, hover underline |
| Summary text | `#6B6B6B`, 14px, Inter 400, line-height 1.6 |
| Tags | Inline pills, `#A8D8C8` background at 30% opacity, `#2D2D2D` text, 11px, border-radius 4px, padding 2px 8px |
| Section divider | 1px solid `#E8E8E4` |
| Footer | `#9B9B9B`, 12px, centered |
| Unsubscribe link | `#9B9B9B`, underlined |

### 9.2 Verification Email

**Subject:** `Confirm your AI Digest subscription`
**Body:** Simple, single-CTA email:
- "Click below to confirm your subscription."
- Large lavender button: "Confirm Subscription →"
- Below button: "If you didn't sign up, you can ignore this email."

### 9.3 Waitlist Notification Email

**Subject:** `A spot opened up — claim your AI Digest subscription!`
**Body:**
- "A spot has opened up in AI Digest."
- Large lavender button: "Claim Your Spot →" (links to signup page with pre-filled email)
- "This link expires in 48 hours."

---

## 10. Security & Privacy

### 10.1 Data Handling
- Store only email addresses. No passwords (no user accounts beyond email).
- All tokens (verification, unsubscribe) are cryptographically random UUIDs.
- Unsubscribe tokens are permanent and unique per user — no login required to manage preferences.
- Supabase Row Level Security (RLS) policies restrict direct DB access.

### 10.2 Email Compliance
- **Double opt-in:** Users must verify email before receiving any digests (CAN-SPAM, GDPR).
- **One-click unsubscribe:** Every email includes an unsubscribe link + List-Unsubscribe header.
- **No data sharing:** Email addresses are never shared with third parties.
- **Data deletion:** Unsubscribed users can request full data deletion via reply to any digest email.

### 10.3 API Security
- Mailgun webhook endpoint validates signatures.
- Cron endpoints validate Vercel cron secret (`CRON_SECRET` env var).
- Rate limiting on `/api/subscribe`: max 5 requests per IP per minute (use Vercel Edge middleware or Upstash rate limiter).
- CSRF protection via SameSite cookies (Next.js default).

---

## 11. Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend (email delivery)
RESEND_API_KEY=

# Mailgun (inbound email)
MAILGUN_SIGNING_KEY=
MAILGUN_DOMAIN=

# Claude API (content extraction)
ANTHROPIC_API_KEY=

# Vercel Cron
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
FROM_EMAIL=digest@yourdomain.com
```

---

## 12. Development Roadmap

### Phase 1 — Foundation (Days 1-3)
- [ ] Initialize Next.js 14 project with Tailwind CSS
- [ ] Set up Supabase project, create all tables and indexes from §3.2
- [ ] Seed the `sources` table with all 9 sources
- [ ] Seed `system_config` with max_subscribers and subscriptions_paused
- [ ] Build the landing page UI (§8.3) with all interaction states
- [ ] Implement `POST /api/subscribe` with cap check logic
- [ ] Implement `GET /api/subscription-status`
- [ ] Implement double opt-in flow (verification email via Resend)
- [ ] Build verify-success, preferences, and unsubscribed pages
- [ ] Deploy to Vercel

### Phase 2 — Content Pipeline (Days 4-7)
- [ ] Set up Mailgun inbound routing with intake email addresses
- [ ] Subscribe all 6 newsletter intake addresses to their respective newsletters
- [ ] Build `POST /api/ingest/email` webhook endpoint
- [ ] Implement Claude API extraction with the prompt from §4.4
- [ ] Build URL normalization and deduplication logic
- [ ] Build `POST /api/ingest/rss` for blog feeds
- [ ] Verify RSS feed URLs for OpenAI, Anthropic, DeepMind (update if needed)
- [ ] Set up Vercel Cron for RSS polling (every 2 hours)
- [ ] Implement `ingestion_log` for all pipeline events
- [ ] Test end-to-end: newsletter arrives → articles in DB

### Phase 3 — Digest Delivery (Days 8-10)
- [ ] Design digest email template in React Email (§9.1)
- [ ] Design verification email template (§9.2)
- [ ] Build digest assembly engine: query unsent articles per user
- [ ] Implement `POST /api/digest/send` cron endpoint
- [ ] Set up Vercel Cron: daily at 8 AM IST, weekly Monday 8 AM IST
- [ ] Implement `user_article_log` bookkeeping after sends
- [ ] Implement unsubscribe flow (`GET /api/unsubscribe`)
- [ ] Implement preferences management (`GET/PUT /api/preferences`)
- [ ] Test full loop: signup → verify → articles ingested → digest delivered

### Phase 4 — Polish & Launch (Days 11-14)
- [ ] Set up sending domain DNS (SPF, DKIM, DMARC)
- [ ] Add rate limiting to subscribe endpoint
- [ ] Add Sentry for error monitoring
- [ ] Test waitlist flow (simulate cap reached)
- [ ] Mobile responsiveness QA
- [ ] Email rendering QA across Gmail, Apple Mail, Outlook
- [ ] Load test digest assembly for 3,000 users
- [ ] Write a brief privacy policy page
- [ ] Launch 🚀

---

## 13. Future Enhancements (Post-MVP)

These are explicitly out of scope for MVP but noted for future consideration:

1. **Web-based article feed** — browse all aggregated articles on the website (not just email).
2. **Semantic deduplication** — use embeddings to detect when two newsletters cover the same story from different URLs.
3. **User-facing tags filter** — let users subscribe to specific tags (e.g., only "LLMs" + "Research") in addition to sources.
4. **Analytics dashboard** — track open rates, click rates, most popular articles.
5. **Additional sources** — expand beyond the initial 9 (e.g., Stratechery, a16z AI newsletter, MIT Tech Review).
6. **RSS output** — offer the aggregated feed as an RSS feed for power users.
7. **Referral system** — "skip the waitlist by referring 3 friends."
8. **Admin dashboard** — web UI for managing sources, viewing ingestion health, adjusting the cap, and sending waitlist invites.