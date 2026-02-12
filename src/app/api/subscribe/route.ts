import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Frequency } from '@/types/database';

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

    // Validation passed - return success for now
    // US-024 and US-025 will add cap check and user creation
    return NextResponse.json({
      success: true,
      message: 'Validation passed.',
      validated: {
        email: email.trim(),
        frequency: frequency as Frequency,
        sources: validSlugs,
      },
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/subscribe:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
