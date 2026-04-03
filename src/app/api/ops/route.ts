import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

function opsRedirect(request: NextRequest, secret: string, msg?: string, error?: string): NextResponse {
  const url = new URL('/ops', getBaseUrl(request));
  url.searchParams.set('secret', secret);
  if (msg) url.searchParams.set('msg', msg);
  if (error) url.searchParams.set('error', error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') ?? '';
  const action = searchParams.get('action') ?? '';

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (action) {
      case 'toggle-signups': {
        const { data: config } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'subscriptions_paused')
          .single();

        const currentPaused = (config?.value as { paused?: boolean } | null)?.paused === true;
        const newPaused = !currentPaused;

        await supabase
          .from('system_config')
          .update({ value: { paused: newPaused, message: "We've hit capacity! Join the waitlist." } })
          .eq('key', 'subscriptions_paused');

        return opsRedirect(request, secret, `Signups ${newPaused ? 'paused' : 'resumed'} successfully.`);
      }

      case 'trigger-ingest': {
        const baseUrl = getBaseUrl(request);
        const cronSecret = process.env.CRON_SECRET ?? '';
        const res = await fetch(`${baseUrl}/api/ingest/rss`, {
          method: 'POST',
          headers: { 'x-cron-secret': cronSecret },
        });
        if (!res.ok) {
          const body = await res.text();
          return opsRedirect(request, secret, undefined, `Ingestion failed (${res.status}): ${body.slice(0, 200)}`);
        }
        const data = await res.json() as { articlesAdded?: number; sourcesProcessed?: number };
        return opsRedirect(request, secret, `Ingestion triggered. Sources: ${data.sourcesProcessed ?? 0}, Articles added: ${data.articlesAdded ?? 0}`);
      }

      case 'trigger-digest-daily':
      case 'trigger-digest-weekly': {
        const frequency = action === 'trigger-digest-daily' ? 'daily' : 'weekly';
        const baseUrl = getBaseUrl(request);
        const cronSecret = process.env.CRON_SECRET ?? '';
        const res = await fetch(`${baseUrl}/api/digest/send?frequency=${frequency}`, {
          method: 'POST',
          headers: { 'x-cron-secret': cronSecret },
        });
        if (!res.ok) {
          const body = await res.text();
          return opsRedirect(request, secret, undefined, `Digest trigger failed (${res.status}): ${body.slice(0, 200)}`);
        }
        const data = await res.json() as { emailsSent?: number; articlesIncluded?: number; usersProcessed?: number; skippedNoArticles?: number; errors?: number };
        return opsRedirect(
          request,
          secret,
          `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} digest triggered. Users processed: ${data.usersProcessed ?? 0}, Emails sent: ${data.emailsSent ?? 0}, Skipped (no articles): ${data.skippedNoArticles ?? 0}, Errors: ${data.errors ?? 0}`
        );
      }

      case 'deactivate-user': {
        const formData = await request.formData();
        const email = (formData.get('email') as string | null)?.trim() ?? '';
        if (!email) {
          return opsRedirect(request, secret, undefined, 'Email is required to deactivate a user.');
        }

        const { error: updateError } = await supabase
          .from('users')
          .update({ is_active: false })
          .eq('email', email);

        if (updateError) {
          return opsRedirect(request, secret, undefined, `Failed to deactivate user: ${updateError.message}`);
        }

        return opsRedirect(request, secret, `User ${email} deactivated.`);
      }

      case 'promote-waitlist': {
        const { data: topEntry, error: waitlistError } = await supabase
          .from('waitlist')
          .select('id, email')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (waitlistError || !topEntry) {
          return opsRedirect(request, secret, undefined, 'No entries on the waitlist.');
        }

        const waitlistEntry = topEntry as { id: string; email: string };

        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, is_active')
          .eq('email', waitlistEntry.email)
          .single();

        if (!existingUser) {
          // Insert as new unverified user
          const { error: insertError } = await supabase.from('users').insert({
            email: waitlistEntry.email,
            email_verified: false,
            verification_token: crypto.randomUUID(),
            unsubscribe_token: crypto.randomUUID(),
            frequency: 'daily',
            is_active: true,
            signed_up_at: new Date().toISOString(),
          });

          if (insertError) {
            return opsRedirect(request, secret, undefined, `Failed to promote user: ${insertError.message}`);
          }
        } else if (!(existingUser as { id: string; is_active: boolean }).is_active) {
          // Re-activate if previously deactivated
          await supabase.from('users').update({ is_active: true }).eq('email', waitlistEntry.email);
        }

        // Remove from waitlist
        await supabase.from('waitlist').delete().eq('id', waitlistEntry.id);

        return opsRedirect(request, secret, `Promoted ${waitlistEntry.email} from waitlist.`);
      }

      default:
        return opsRedirect(request, secret, undefined, `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('Ops action error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return opsRedirect(request, secret, undefined, `Action failed: ${message}`);
  }
}
