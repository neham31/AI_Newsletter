/**
 * TypeScript types for database schema
 * Generated from Supabase migrations
 */

// ============================================================================
// Enum Types
// ============================================================================

/** Type of news source - newsletter or blog */
export type SourceType = 'newsletter' | 'blog';

/** Email digest frequency */
export type Frequency = 'daily' | 'weekly';

/** Type of ingestion log entry */
export type IngestionType =
  | 'email_received'
  | 'rss_polled'
  | 'extraction_success'
  | 'extraction_failed'
  | 'duplicate_skipped';

// ============================================================================
// Table Types
// ============================================================================

/** Newsletter or blog source */
export interface Source {
  id: string;
  name: string;
  slug: string;
  type: SourceType;
  description: string | null;
  audience: string | null;
  reach: string | null;
  feed_url: string | null;
  intake_email: string | null;
  icon_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Extracted article from a newsletter or blog */
export interface Article {
  id: string;
  source_id: string;
  headline: string;
  summary: string | null;
  url: string;
  url_hash: string;
  tags: string[];
  image_url: string | null;
  published_at: string | null;
  ingested_at: string;
  raw_email_id: string | null;
  extraction_confidence: number;
}

/** Newsletter subscriber */
export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  verification_token: string | null;
  unsubscribe_token: string | null;
  frequency: Frequency;
  is_active: boolean;
  signed_up_at: string;
  last_email_sent_at: string | null;
  created_at: string;
}

/** User's subscription to a source */
export interface UserSubscription {
  id: string;
  user_id: string;
  source_id: string;
  created_at: string;
}

/** Record of article sent to user (for deduplication) */
export interface UserArticleLog {
  id: string;
  user_id: string;
  article_id: string;
  sent_at: string;
  digest_batch_id: string | null;
}

/** System configuration key-value pair */
export interface SystemConfig {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

/** Email on the waitlist */
export interface Waitlist {
  id: string;
  email: string;
  created_at: string;
}

/** Ingestion pipeline log entry */
export interface IngestionLog {
  id: string;
  source_id: string | null;
  type: IngestionType;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Insert Types (for creating new records)
// ============================================================================

export type SourceInsert = Omit<Source, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ArticleInsert = Omit<Article, 'id' | 'ingested_at'> & {
  id?: string;
  ingested_at?: string;
};

export type UserInsert = Omit<User, 'id' | 'signed_up_at' | 'created_at'> & {
  id?: string;
  signed_up_at?: string;
  created_at?: string;
};

export type UserSubscriptionInsert = Omit<UserSubscription, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type UserArticleLogInsert = Omit<UserArticleLog, 'id' | 'sent_at'> & {
  id?: string;
  sent_at?: string;
};

export type SystemConfigInsert = Omit<SystemConfig, 'updated_at'> & {
  updated_at?: string;
};

export type WaitlistInsert = Omit<Waitlist, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type IngestionLogInsert = Omit<IngestionLog, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// ============================================================================
// Update Types (for updating existing records)
// ============================================================================

export type SourceUpdate = Partial<Omit<Source, 'id' | 'created_at'>>;
export type ArticleUpdate = Partial<Omit<Article, 'id' | 'ingested_at'>>;
export type UserUpdate = Partial<Omit<User, 'id' | 'signed_up_at' | 'created_at'>>;
export type UserSubscriptionUpdate = Partial<Omit<UserSubscription, 'id' | 'created_at'>>;
export type UserArticleLogUpdate = Partial<Omit<UserArticleLog, 'id' | 'sent_at'>>;
export type SystemConfigUpdate = Partial<Omit<SystemConfig, 'key'>>;
export type WaitlistUpdate = Partial<Omit<Waitlist, 'id' | 'created_at'>>;
export type IngestionLogUpdate = Partial<Omit<IngestionLog, 'id' | 'created_at'>>;
