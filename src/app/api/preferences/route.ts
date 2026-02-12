import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Source, Frequency, UserSubscriptionInsert } from '@/types/database';

/** Shape of source data in preferences response */
type SourcePreference = Pick<Source, 'id' | 'name' | 'slug' | 'type' | 'description' | 'audience' | 'reach'>;

/** Response shape for user preferences */
interface PreferencesResponse {
  frequency: Frequency;
  sources: SourcePreference[];
}

/**
 * GET /api/preferences
 * Fetches user's current subscription preferences
 * Requires token query param (unsubscribe_token)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Validate token is provided
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Look up user by unsubscribe_token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, frequency')
      .eq('unsubscribe_token', token)
      .single();

    if (userError) {
      // PGRST116 = not found
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 404 }
        );
      }
      console.error('Error fetching user:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    // Get user's subscribed source IDs
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('source_id')
      .eq('user_id', user.id);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    // Extract source IDs
    const sourceIds = (subscriptions || []).map(sub => sub.source_id);

    // Fetch the actual source details
    let sources: SourcePreference[] = [];
    if (sourceIds.length > 0) {
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('sources')
        .select('id, name, slug, type, description, audience, reach')
        .in('id', sourceIds)
        .eq('is_active', true)
        .order('name');

      if (sourcesError) {
        console.error('Error fetching sources:', sourcesError);
        return NextResponse.json(
          { error: 'Failed to fetch sources' },
          { status: 500 }
        );
      }

      sources = sourcesData || [];
    }

    const response: PreferencesResponse = {
      frequency: user.frequency as Frequency,
      sources,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET /api/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Request body shape for updating preferences */
interface UpdatePreferencesRequest {
  token: string;
  frequency?: Frequency;
  sources?: string[]; // Array of source slugs
}

/**
 * PUT /api/preferences
 * Updates user's subscription preferences
 * Requires token in body
 */
export async function PUT(request: NextRequest) {
  try {
    const body: UpdatePreferencesRequest = await request.json();
    const { token, frequency, sources } = body;

    // Validate token is provided
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate frequency if provided
    if (frequency && frequency !== 'daily' && frequency !== 'weekly') {
      return NextResponse.json(
        { error: 'Frequency must be "daily" or "weekly"' },
        { status: 400 }
      );
    }

    // Validate sources if provided
    if (sources !== undefined && (!Array.isArray(sources) || sources.length === 0)) {
      return NextResponse.json(
        { error: 'Sources must be a non-empty array' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const serviceClient = createServiceRoleClient();

    // Look up user by unsubscribe_token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, frequency')
      .eq('unsubscribe_token', token)
      .single();

    if (userError) {
      // PGRST116 = not found
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 404 }
        );
      }
      console.error('Error fetching user:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    // Update user's frequency if provided
    if (frequency) {
      const { error: updateError } = await serviceClient
        .from('users')
        .update({ frequency })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating frequency:', updateError);
        return NextResponse.json(
          { error: 'Failed to update frequency' },
          { status: 500 }
        );
      }
    }

    // Update user's subscriptions if sources provided
    if (sources && sources.length > 0) {
      // Validate that all source slugs exist and are active
      const { data: validSources, error: sourcesError } = await supabase
        .from('sources')
        .select('id, slug')
        .in('slug', sources)
        .eq('is_active', true);

      if (sourcesError) {
        console.error('Error fetching sources:', sourcesError);
        return NextResponse.json(
          { error: 'Failed to validate sources' },
          { status: 500 }
        );
      }

      const validSlugs = new Set((validSources || []).map(s => s.slug));
      const invalidSlugs = sources.filter(slug => !validSlugs.has(slug));

      if (invalidSlugs.length > 0) {
        return NextResponse.json(
          { error: `Invalid source slugs: ${invalidSlugs.join(', ')}` },
          { status: 400 }
        );
      }

      // Delete existing subscriptions
      const { error: deleteError } = await serviceClient
        .from('user_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting subscriptions:', deleteError);
        return NextResponse.json(
          { error: 'Failed to update subscriptions' },
          { status: 500 }
        );
      }

      // Create new subscriptions
      const subscriptionInserts: UserSubscriptionInsert[] = (validSources || []).map(source => ({
        user_id: user.id,
        source_id: source.id,
      }));

      const { error: insertError } = await serviceClient
        .from('user_subscriptions')
        .insert(subscriptionInserts);

      if (insertError) {
        console.error('Error creating subscriptions:', insertError);
        return NextResponse.json(
          { error: 'Failed to update subscriptions' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Unexpected error in PUT /api/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
