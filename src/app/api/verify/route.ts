import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/verify
 *
 * Verifies a user's email using their verification token.
 * On success: sets email_verified=true, clears token, redirects to /verify-success
 * On failure: redirects to / with error param
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

    // Look up user by verification_token
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('verification_token', token)
      .single();

    if (lookupError || !user) {
      // Token not found or invalid
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'invalid_token');
      return NextResponse.redirect(redirectUrl);
    }

    // Check if already verified
    if (user.email_verified) {
      // Already verified - redirect to success page
      const redirectUrl = new URL('/verify-success', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Set email_verified=true and clear verification_token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error verifying user:', updateError);
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(redirectUrl);
    }

    // Success - redirect to verify-success page
    const redirectUrl = new URL('/verify-success', request.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Unexpected error in GET /api/verify:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('error', 'verification_failed');
    return NextResponse.redirect(redirectUrl);
  }
}
