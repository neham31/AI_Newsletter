import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/unsubscribe
 *
 * Unsubscribes a user using their unsubscribe_token.
 * Sets is_active=false and redirects to /unsubscribed page.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Validate token is present
    if (!token) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'invalid_token');
      return NextResponse.redirect(redirectUrl);
    }

    const supabase = await createClient();

    // Look up user by unsubscribe_token
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('unsubscribe_token', token)
      .single();

    if (lookupError || !user) {
      // Token not found or invalid
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'invalid_token');
      return NextResponse.redirect(redirectUrl);
    }

    // Check if already unsubscribed
    if (!user.is_active) {
      // Already unsubscribed - redirect to unsubscribed page
      const redirectUrl = new URL('/unsubscribed', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Set is_active=false
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_active: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error unsubscribing user:', updateError);
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'unsubscribe_failed');
      return NextResponse.redirect(redirectUrl);
    }

    // Success - redirect to unsubscribed page
    const redirectUrl = new URL('/unsubscribed', request.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Unexpected error in GET /api/unsubscribe:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'unsubscribe_failed');
    return NextResponse.redirect(redirectUrl);
  }
}
