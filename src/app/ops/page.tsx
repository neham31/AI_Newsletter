import { createServiceRoleClient } from '@/lib/supabase/server';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

interface DigestGroup {
  date: string;
  batch_id: string | null;
  emails_sent: number;
  articles_included: number;
}

interface PipelineRow {
  id: string;
  source_id: string | null;
  type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  sources: { name: string } | null;
}

interface ClaudeUsageRow {
  called_at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calcEstimatedCost(inputTokens: number, outputTokens: number): string {
  // $0.80 per 1M input tokens, $4.00 per 1M output tokens (Haiku pricing)
  const cost = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;
  return `$${cost.toFixed(4)}`;
}

const s = {
  page: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f9f9f9', minHeight: '100vh', color: '#222', padding: '24px 16px' } as React.CSSProperties,
  container: { maxWidth: '1100px', margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: '22px', margin: '0 0 4px' } as React.CSSProperties,
  subtitle: { color: '#666', fontSize: '13px', marginBottom: '24px' } as React.CSSProperties,
  section: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '20px' } as React.CSSProperties,
  h2: { fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' } as React.CSSProperties,
  stat: { background: '#f5f5f5', borderRadius: '6px', padding: '12px 16px' } as React.CSSProperties,
  statValue: { fontSize: '28px', fontWeight: 700, lineHeight: 1 } as React.CSSProperties,
  statLabel: { fontSize: '12px', color: '#666', marginTop: '4px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: { textAlign: 'left' as const, padding: '6px 10px', borderBottom: '2px solid #ddd', background: '#f5f5f5', whiteSpace: 'nowrap' as const },
  td: { padding: '6px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top' as const },
  actionsGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: '10px' },
  btn: { padding: '8px 16px', borderRadius: '5px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' } as React.CSSProperties,
  btnDanger: { padding: '8px 16px', borderRadius: '5px', border: '1px solid #f99', background: '#fff0f0', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#c00' } as React.CSSProperties,
  btnPrimary: { padding: '8px 16px', borderRadius: '5px', border: '1px solid #aac', background: '#e8f0fe', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#224' } as React.CSSProperties,
  msgOk: { padding: '10px 14px', borderRadius: '5px', marginBottom: '16px', fontSize: '13px', background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#2e7d32' } as React.CSSProperties,
  msgErr: { padding: '10px 14px', borderRadius: '5px', marginBottom: '16px', fontSize: '13px', background: '#ffebee', border: '1px solid #ef9a9a', color: '#c62828' } as React.CSSProperties,
  userForm: { display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' as const },
  input: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '13px', minWidth: '240px' } as React.CSSProperties,
  badgeGreen: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#e8f5e9', color: '#2e7d32' } as React.CSSProperties,
  badgeRed: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#ffebee', color: '#c62828' } as React.CSSProperties,
  badgeYellow: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#fffde7', color: '#f57f17' } as React.CSSProperties,
  badgeGray: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#f5f5f5', color: '#666' } as React.CSSProperties,
  badgeOrange: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#fff3e0', color: '#e65100' } as React.CSSProperties,
  code: { fontSize: '11px', background: '#f0f0f0', padding: '1px 4px', borderRadius: '3px' } as React.CSSProperties,
  muted: { color: '#999' } as React.CSSProperties,
};

export default async function OpsPage({ searchParams }: PageProps) {
  const secret = typeof searchParams.secret === 'string' ? searchParams.secret : '';
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <h1 style={s.h1}>401 Unauthorized</h1>
          <p style={s.subtitle}>
            Missing or invalid admin secret. Provide <code>?secret=YOUR_ADMIN_SECRET</code> in the URL.
          </p>
        </div>
      </div>
    );
  }

  const msg = typeof searchParams.msg === 'string' ? searchParams.msg : null;
  const errMsg = typeof searchParams.error === 'string' ? searchParams.error : null;

  const supabase = createServiceRoleClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all data in parallel
  const [
    activeVerifiedRes,
    pendingRes,
    unsubscribedRes,
    waitlistRes,
    subscriberListRes,
    ualRes,
    pipelineRes,
    claudeRes,
    configRes,
    ingestionCountRes,
    oldestArticleRes,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('email_verified', true),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('email_verified', false),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false),
    supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('users')
      .select('email, email_verified, is_active, frequency, signed_up_at, last_email_sent_at')
      .order('signed_up_at', { ascending: false })
      .limit(200),
    supabase
      .from('user_article_log')
      .select('sent_at, digest_batch_id, user_id, article_id')
      .gte('sent_at', sevenDaysAgo)
      .order('sent_at', { ascending: false })
      .limit(2000),
    supabase
      .from('ingestion_log')
      .select('id, source_id, type, details, created_at, sources(name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('claude_usage_log')
      .select('called_at, model, input_tokens, output_tokens')
      .gte('called_at', sevenDaysAgo)
      .order('called_at', { ascending: false })
      .limit(100),
    supabase
      .from('system_config')
      .select('key, value')
      .eq('key', 'subscriptions_paused')
      .single(),
    supabase
      .from('ingestion_log')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('articles')
      .select('ingested_at')
      .order('ingested_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeVerified = activeVerifiedRes.count ?? 0;
  const pending = pendingRes.count ?? 0;
  const unsubscribed = unsubscribedRes.count ?? 0;
  const waitlistCount = waitlistRes.count ?? 0;

  type SubscriberRow = { email: string; email_verified: boolean; is_active: boolean; frequency: string; signed_up_at: string | null; last_email_sent_at: string | null };
  const subscriberList = (subscriberListRes.data ?? []) as SubscriberRow[];

  // Aggregate user_article_log by (date, digest_batch_id)
  const digestAgg = new Map<string, { date: string; batch_id: string | null; users: Set<string>; articles: Set<string> }>();
  for (const row of (ualRes.data ?? []) as Array<{ sent_at: string; digest_batch_id: string | null; user_id: string; article_id: string }>) {
    const date = row.sent_at.slice(0, 10);
    const batchId = row.digest_batch_id ?? 'unknown';
    const key = `${date}__${batchId}`;
    if (!digestAgg.has(key)) {
      digestAgg.set(key, { date, batch_id: row.digest_batch_id, users: new Set(), articles: new Set() });
    }
    const g = digestAgg.get(key)!;
    g.users.add(row.user_id);
    g.articles.add(row.article_id);
  }

  const recentDigests: DigestGroup[] = Array.from(digestAgg.values())
    .map(g => ({ date: g.date, batch_id: g.batch_id, emails_sent: g.users.size, articles_included: g.articles.size }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  const pipelineRows = (pipelineRes.data ?? []) as unknown as PipelineRow[];

  // Aggregate claude usage by date+model
  const claudeAgg = new Map<string, ClaudeUsageRow>();
  for (const row of (claudeRes.data ?? []) as ClaudeUsageRow[]) {
    const date = row.called_at.slice(0, 10);
    const key = `${date}__${row.model}`;
    if (!claudeAgg.has(key)) {
      claudeAgg.set(key, { called_at: date, model: row.model, input_tokens: 0, output_tokens: 0 });
    }
    const g = claudeAgg.get(key)!;
    g.input_tokens += row.input_tokens;
    g.output_tokens += row.output_tokens;
  }
  const claudeSummary = Array.from(claudeAgg.values()).sort((a, b) => b.called_at.localeCompare(a.called_at));

  const ingestionLogCount = ingestionCountRes.count ?? 0;
  const oldestArticleDate = (oldestArticleRes.data as { ingested_at: string } | null)?.ingested_at ?? null;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const pruningRecommended =
    ingestionLogCount > 10000 ||
    (oldestArticleDate !== null && oldestArticleDate < ninetyDaysAgo);

  const signupsPaused = (configRes.data?.value as { paused?: boolean } | null)?.paused === true;
  const baseUrl = `/api/ops?secret=${encodeURIComponent(secret)}`;

  function statusBadge(type: string) {
    if (type === 'rss_polled' || type === 'extraction_success') {
      return <span style={s.badgeGreen}>{type}</span>;
    } else if (type === 'extraction_failed') {
      return <span style={s.badgeRed}>{type}</span>;
    } else if (type === 'duplicate_skipped') {
      return <span style={s.badgeYellow}>{type}</span>;
    }
    return <span style={s.badgeGray}>{type}</span>;
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.h1}>Ops Dashboard</h1>
        <p style={s.subtitle}>AI News Aggregator — Admin Panel</p>

        {msg && <div style={s.msgOk}>{msg}</div>}
        {errMsg && <div style={s.msgErr}>{errMsg}</div>}

        {/* Subscriber Stats */}
        <div style={s.section}>
          <h2 style={s.h2}>Subscriber Stats</h2>
          <div style={s.statsGrid}>
            <div style={s.stat}>
              <div style={s.statValue}>{activeVerified}</div>
              <div style={s.statLabel}>Active + Verified</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>{pending}</div>
              <div style={s.statLabel}>Pending Verification</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>{unsubscribed}</div>
              <div style={s.statLabel}>Unsubscribed</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>{waitlistCount}</div>
              <div style={s.statLabel}>On Waitlist</div>
            </div>
          </div>
        </div>

        {/* Subscriber List */}
        <div style={s.section}>
          <h2 style={s.h2}>All Users ({subscriberList.length})</h2>
          {subscriberList.length === 0 ? (
            <p style={s.muted}>No users found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Frequency</th>
                    <th style={s.th}>Signed Up</th>
                    <th style={s.th}>Last Email</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriberList.map((user, i) => {
                    let statusBadgeEl;
                    if (!user.is_active) {
                      statusBadgeEl = <span style={s.badgeRed}>Unsubscribed</span>;
                    } else if (!user.email_verified) {
                      statusBadgeEl = <span style={s.badgeYellow}>Pending</span>;
                    } else {
                      statusBadgeEl = <span style={s.badgeGreen}>Active</span>;
                    }
                    return (
                      <tr key={i}>
                        <td style={s.td}>{user.email}</td>
                        <td style={s.td}>{statusBadgeEl}</td>
                        <td style={s.td}>{user.frequency ?? '—'}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{user.signed_up_at ? formatDate(user.signed_up_at) : '—'}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{user.last_email_sent_at ? formatDateTime(user.last_email_sent_at) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Digests */}
        <div style={s.section}>
          <h2 style={s.h2}>Recent Digests (Last 7 Days)</h2>
          {recentDigests.length === 0 ? (
            <p style={s.muted}>No digests sent in the last 7 days.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Batch ID</th>
                  <th style={s.th}>Emails Sent</th>
                  <th style={s.th}>Articles Included</th>
                </tr>
              </thead>
              <tbody>
                {recentDigests.map((d, i) => (
                  <tr key={i}>
                    <td style={s.td}>{formatDate(d.date)}</td>
                    <td style={s.td}>
                      <code style={s.code}>{d.batch_id ? d.batch_id.slice(0, 8) + '…' : '—'}</code>
                    </td>
                    <td style={s.td}>{d.emails_sent}</td>
                    <td style={s.td}>{d.articles_included}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pipeline Health */}
        <div style={s.section}>
          <h2 style={s.h2}>Pipeline Health (Last 5 Events)</h2>
          {pipelineRows.length === 0 ? (
            <p style={s.muted}>No ingestion events recorded.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Source</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Articles Fetched</th>
                  <th style={s.th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {pipelineRows.map((row) => {
                  const details = row.details as { items_found?: number; articles_fetched?: number } | null;
                  const articlesFetched = details?.items_found ?? details?.articles_fetched ?? '—';
                  return (
                    <tr key={row.id}>
                      <td style={s.td}>{row.sources?.name ?? <span style={s.muted}>Unknown</span>}</td>
                      <td style={s.td}>{statusBadge(row.type)}</td>
                      <td style={s.td}>{String(articlesFetched)}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Storage Health */}
        <div style={s.section}>
          <h2 style={s.h2}>
            Storage Health
            {pruningRecommended && <span style={s.badgeOrange}>Pruning recommended</span>}
          </h2>
          <div style={s.statsGrid}>
            <div style={s.stat}>
              <div style={s.statValue}>{ingestionLogCount.toLocaleString()}</div>
              <div style={s.statLabel}>ingestion_log rows</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>{oldestArticleDate ? formatDate(oldestArticleDate) : '—'}</div>
              <div style={s.statLabel}>Oldest article</div>
            </div>
          </div>
          {pruningRecommended && (
            <p style={{ fontSize: '12px', color: '#999', margin: '12px 0 8px' }}>
              Pruning removes ingestion_log entries older than 90 days and articles older than 180 days not sent to any user.
            </p>
          )}
          <div style={{ marginTop: '12px' }}>
            <form method="POST" action={`/api/admin/prune?secret=${encodeURIComponent(secret)}`}>
              <button type="submit" style={s.btnDanger}>Prune Now</button>
            </form>
          </div>
        </div>

        {/* Claude Usage */}
        <div style={s.section}>
          <h2 style={s.h2}>Claude Usage (Last 7 Days)</h2>
          {claudeSummary.length === 0 ? (
            <p style={s.muted}>No Claude API usage recorded in the last 7 days.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Model</th>
                  <th style={s.th}>Input Tokens</th>
                  <th style={s.th}>Output Tokens</th>
                  <th style={s.th}>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {claudeSummary.map((row, i) => (
                  <tr key={i}>
                    <td style={s.td}>{formatDate(row.called_at)}</td>
                    <td style={s.td}><code style={s.code}>{row.model}</code></td>
                    <td style={s.td}>{row.input_tokens.toLocaleString()}</td>
                    <td style={s.td}>{row.output_tokens.toLocaleString()}</td>
                    <td style={s.td}>{calcEstimatedCost(row.input_tokens, row.output_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Actions */}
        <div style={s.section}>
          <h2 style={s.h2}>
            Actions
            {signupsPaused && <span style={s.badgeRed}>Signups Paused</span>}
          </h2>
          <div style={s.actionsGrid}>
            <form method="POST" action={`${baseUrl}&action=toggle-signups`}>
              <button type="submit" style={signupsPaused ? s.btnPrimary : s.btnDanger}>
                {signupsPaused ? 'Resume Signups' : 'Pause Signups'}
              </button>
            </form>
            <form method="POST" action={`${baseUrl}&action=trigger-ingest`}>
              <button type="submit" style={s.btn}>Trigger Ingestion</button>
            </form>
            <form method="POST" action={`${baseUrl}&action=trigger-digest-daily`}>
              <button type="submit" style={s.btn}>Trigger Daily Digest</button>
            </form>
            <form method="POST" action={`${baseUrl}&action=trigger-digest-weekly`}>
              <button type="submit" style={s.btn}>Trigger Weekly Digest</button>
            </form>
            <form method="POST" action={`${baseUrl}&action=promote-waitlist`}>
              <button type="submit" style={s.btn}>Promote Top Waitlist Entry</button>
            </form>
          </div>
        </div>

        {/* Test Digest */}
        <div style={s.section}>
          <h2 style={s.h2}>Send Test Digest</h2>
          <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px' }}>
            Sends immediately to any email, bypassing idempotency. Uses the recipient&apos;s unsent articles if they&apos;re a subscriber, otherwise uses latest articles.
          </p>
          <form method="POST" action={`/api/admin/test-digest?secret=${encodeURIComponent(secret)}`} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
            <input type="email" name="email" placeholder="recipient@example.com" required style={s.input} />
            <select name="frequency" style={{ ...s.input, minWidth: 'unset' }}>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
            <button type="submit" style={s.btnPrimary}>Send Test Digest</button>
          </form>
        </div>

        {/* User Management */}
        <div style={s.section}>
          <h2 style={s.h2}>User Management</h2>
          <form method="POST" action={`${baseUrl}&action=deactivate-user`} style={s.userForm}>
            <input type="email" name="email" placeholder="user@example.com" required style={s.input} />
            <button type="submit" style={s.btnDanger}>Deactivate User</button>
          </form>
        </div>
      </div>
    </div>
  );
}
