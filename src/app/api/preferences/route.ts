import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Source, Frequency } from '@/types/database';

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
