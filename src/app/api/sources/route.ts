import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Source, SourceType } from '@/types/database';

/** Response shape for the sources endpoint */
interface SourcesResponse {
  newsletters: Pick<Source, 'id' | 'name' | 'slug' | 'type' | 'description' | 'audience' | 'reach'>[];
  blogs: Pick<Source, 'id' | 'name' | 'slug' | 'type' | 'description' | 'audience' | 'reach'>[];
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: sources, error } = await supabase
      .from('sources')
      .select('id, name, slug, type, description, audience, reach')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching sources:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sources' },
        { status: 500 }
      );
    }

    // Group sources by type
    const grouped: SourcesResponse = {
      newsletters: [],
      blogs: [],
    };

    for (const source of sources || []) {
      const sourceType = source.type as SourceType;
      if (sourceType === 'newsletter') {
        grouped.newsletters.push(source);
      } else if (sourceType === 'blog') {
        grouped.blogs.push(source);
      }
    }

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Unexpected error in GET /api/sources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
