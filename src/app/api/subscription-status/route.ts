import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Response shape for the subscription-status endpoint */
interface SubscriptionStatusResponse {
  accepting: boolean;
  waitlistCount: number;
}

/** Shape of max_subscribers config value */
interface MaxSubscribersConfig {
  limit: number;
  enabled: boolean;
}

/** Shape of subscriptions_paused config value */
interface SubscriptionsPausedConfig {
  paused: boolean;
  message: string;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch system config values
    const { data: configData, error: configError } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['max_subscribers', 'subscriptions_paused']);

    if (configError) {
      console.error('Error fetching system_config:', configError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription status' },
        { status: 500 }
      );
    }

    // Parse config values
    let maxSubscribers: MaxSubscribersConfig = { limit: 3000, enabled: true };
    let subscriptionsPaused: SubscriptionsPausedConfig = { paused: false, message: '' };

    for (const config of configData || []) {
      if (config.key === 'max_subscribers') {
        maxSubscribers = config.value as MaxSubscribersConfig;
      } else if (config.key === 'subscriptions_paused') {
        subscriptionsPaused = config.value as SubscriptionsPausedConfig;
      }
    }

    // Count active, verified users
    const { count: activeUserCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('email_verified', true);

    if (countError) {
      console.error('Error counting users:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription status' },
        { status: 500 }
      );
    }

    // Count waitlist entries
    const { count: waitlistCount, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (waitlistError) {
      console.error('Error counting waitlist:', waitlistError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription status' },
        { status: 500 }
      );
    }

    // Determine if accepting new subscriptions
    const currentUserCount = activeUserCount ?? 0;
    const isCapReached = maxSubscribers.enabled && currentUserCount >= maxSubscribers.limit;
    const accepting = !subscriptionsPaused.paused && !isCapReached;

    const response: SubscriptionStatusResponse = {
      accepting,
      waitlistCount: waitlistCount ?? 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET /api/subscription-status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
