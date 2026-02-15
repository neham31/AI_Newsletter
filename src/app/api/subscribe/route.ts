import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/resend';
import { VerificationEmail } from '@/emails/VerificationEmail';
import { createSubscribeRateLimiter, checkRateLimit, getClientIp } from '@/lib/ratelimit';
import type { Frequency } from '@/types/database';

// Initialize rate limiter (singleton)
const rateLimiter = createSubscribeRateLimiter();

/** Request body for subscribe endpoint */
interface SubscribeRequest {
  email: string;
  sources: string[];
  frequency: string;
}

/** Validation error response */
interface ValidationError {
  field: string;
  message: string;
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

/** Email regex pattern for validation */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valid frequency values */
const VALID_FREQUENCIES: Frequency[] = ['daily', 'weekly'];

/**
 * Validates email format
 */
function validateEmail(email: unknown): ValidationError | null {
  if (!email || typeof email !== 'string') {
    return { field: 'email', message: 'Email is required.' };
  }

  const trimmedEmail = email.trim();
  if (trimmedEmail.length === 0) {
    return { field: 'email', message: 'Email is required.' };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { field: 'email', message: 'Please enter a valid email address.' };
  }

  return null;
}

/**
 * Validates frequency value
 */
function validateFrequency(frequency: unknown): ValidationError | null {
  if (!frequency || typeof frequency !== 'string') {
    return { field: 'frequency', message: 'Frequency is required.' };
  }

  if (!VALID_FREQUENCIES.includes(frequency as Frequency)) {
    return { field: 'frequency', message: 'Frequency must be "daily" or "weekly".' };
  }

  return null;
}

/**
 * Validates sources array - must have at least 1 valid slug
 */
async function validateSources(
  sources: unknown,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ error: ValidationError | null; validSlugs: string[] }> {
  if (!sources || !Array.isArray(sources)) {
    return {
      error: { field: 'sources', message: 'Please select at least one source.' },
      validSlugs: [],
    };
  }

  // Filter to only string values
  const slugs = sources.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  if (slugs.length === 0) {
    return {
      error: { field: 'sources', message: 'Please select at least one source.' },
      validSlugs: [],
    };
  }

  // Verify slugs exist in database
  const { data: validSources, error } = await supabase
    .from('sources')
    .select('slug')
    .in('slug', slugs)
    .eq('is_active', true);

  if (error) {
    console.error('Error validating sources:', error);
    return {
      error: { field: 'sources', message: 'Failed to validate sources.' },
      validSlugs: [],
    };
  }

  const validSlugs = validSources?.map((s) => s.slug) || [];

  if (validSlugs.length === 0) {
    return {
      error: { field: 'sources', message: 'Please select at least one source.' },
      validSlugs: [],
    };
  }

  return { error: null, validSlugs };
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(rateLimiter, clientIp);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // Parse request body
    let body: SubscribeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body.' },
        { status: 400 }
      );
    }

    const { email, sources, frequency } = body;

    // Collect validation errors
    const errors: ValidationError[] = [];

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      errors.push(emailError);
    }

    // Validate frequency
    const frequencyError = validateFrequency(frequency);
    if (frequencyError) {
      errors.push(frequencyError);
    }

    // Validate sources (requires database check)
    const supabase = await createClient();
    const { error: sourcesError, validSlugs } = await validateSources(sources, supabase);
    if (sourcesError) {
      errors.push(sourcesError);
    }

    // Return all validation errors if any
    if (errors.length > 0) {
      return NextResponse.json(
        { errors },
        { status: 400 }
      );
    }

    // Validation passed - check subscriber cap
    const normalizedEmail = email.trim().toLowerCase();

    // Fetch system config values
    const { data: configData, error: configError } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['max_subscribers', 'subscriptions_paused']);

    if (configError) {
      console.error('Error fetching system_config:', configError);
      return NextResponse.json(
        { error: 'Failed to check subscription status' },
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
        { error: 'Failed to check subscription status' },
        { status: 500 }
      );
    }

    // Determine if accepting new subscriptions
    const currentUserCount = activeUserCount ?? 0;
    const isCapReached = maxSubscribers.enabled && currentUserCount >= maxSubscribers.limit;
    const isAccepting = !subscriptionsPaused.paused && !isCapReached;

    // If at capacity, add to waitlist
    if (!isAccepting) {
      // Check if email is already on waitlist
      const { data: existingWaitlist, error: waitlistCheckError } = await supabase
        .from('waitlist')
        .select('id, created_at')
        .eq('email', normalizedEmail)
        .single();

      if (waitlistCheckError && waitlistCheckError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected
        console.error('Error checking waitlist:', waitlistCheckError);
        return NextResponse.json(
          { error: 'Failed to add to waitlist' },
          { status: 500 }
        );
      }

      if (existingWaitlist) {
        // Email already on waitlist - calculate position
        const { count: position, error: positionError } = await supabase
          .from('waitlist')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', existingWaitlist.created_at);

        if (positionError) {
          console.error('Error calculating waitlist position:', positionError);
          return NextResponse.json(
            { error: 'Failed to calculate waitlist position' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          waitlisted: true,
          position: position ?? 1,
          message: 'You\'re already on the waitlist!',
        });
      }

      // Insert into waitlist
      const { error: insertError } = await supabase
        .from('waitlist')
        .insert({ email: normalizedEmail });

      if (insertError) {
        console.error('Error inserting into waitlist:', insertError);
        return NextResponse.json(
          { error: 'Failed to add to waitlist' },
          { status: 500 }
        );
      }

      // Get position (count of entries in waitlist)
      const { count: waitlistCount, error: waitlistCountError } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true });

      if (waitlistCountError) {
        console.error('Error counting waitlist:', waitlistCountError);
        // Still return success, just with position 0
        return NextResponse.json({
          waitlisted: true,
          position: 0,
          message: 'You\'ve been added to the waitlist!',
        });
      }

      return NextResponse.json({
        waitlisted: true,
        position: waitlistCount ?? 1,
        message: 'You\'ve been added to the waitlist!',
      });
    }

    // Check if email already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email_verified, is_active')
      .eq('email', normalizedEmail)
      .single();

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error checking existing user:', existingUserError);
      return NextResponse.json(
        { error: 'Failed to check existing user' },
        { status: 500 }
      );
    }

    if (existingUser) {
      // Email already registered
      if (existingUser.email_verified && existingUser.is_active) {
        return NextResponse.json({
          success: false,
          message: 'This email is already subscribed! Check your inbox or manage your preferences.',
        });
      } else if (!existingUser.email_verified) {
        return NextResponse.json({
          success: false,
          message: 'This email is pending verification. Please check your inbox for the confirmation email.',
        });
      } else {
        // User exists but is inactive - they can re-subscribe
        return NextResponse.json({
          success: false,
          message: 'This email was previously subscribed. Please contact us to reactivate your subscription.',
        });
      }
    }

    // Generate tokens for verification and unsubscribe
    const verificationToken = randomUUID();
    const unsubscribeToken = randomUUID();

    // Get source IDs from slugs
    const { data: sourcesData, error: fetchSourcesError } = await supabase
      .from('sources')
      .select('id, slug')
      .in('slug', validSlugs)
      .eq('is_active', true);

    if (fetchSourcesError || !sourcesData) {
      console.error('Error fetching source IDs:', fetchSourcesError);
      return NextResponse.json(
        { error: 'Failed to process source selections' },
        { status: 500 }
      );
    }

    const sourceIdMap = new Map(sourcesData.map((s) => [s.slug, s.id]));

    // Insert user into database
    const { data: newUser, error: insertUserError } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        email_verified: false,
        verification_token: verificationToken,
        unsubscribe_token: unsubscribeToken,
        frequency: frequency as Frequency,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertUserError) {
      // Check for unique constraint violation (race condition with duplicate email)
      if (insertUserError.code === '23505') {
        return NextResponse.json({
          success: false,
          message: 'This email is already subscribed! Check your inbox or manage your preferences.',
        });
      }
      console.error('Error inserting user:', insertUserError);
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Insert user subscriptions for each selected source
    const subscriptions = validSlugs.map((slug) => ({
      user_id: newUser.id,
      source_id: sourceIdMap.get(slug)!,
    }));

    const { error: insertSubscriptionsError } = await supabase
      .from('user_subscriptions')
      .insert(subscriptions);

    if (insertSubscriptionsError) {
      console.error('Error inserting user subscriptions:', insertSubscriptionsError);
      // User was created, but subscriptions failed - log but don't fail
      // In production, we might want to roll back or retry
    }

    // Send verification email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/api/verify?token=${verificationToken}`;

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Confirm your AI Digest subscription',
      react: VerificationEmail({ verificationUrl }),
    });

    if (!emailResult.success) {
      // Log the error but don't fail the request - user was created successfully
      console.error('Failed to send verification email:', emailResult.error);
      // In production, we might want to queue a retry or notify admin
    }

    return NextResponse.json({
      success: true,
      message: 'Check your email to confirm your subscription!',
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/subscribe:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
