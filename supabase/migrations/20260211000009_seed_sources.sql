-- Migration: Seed sources table with initial sources
-- Description: Seeds 6 newsletters and 3 company blogs as initial sources

-- Insert sources (use ON CONFLICT to make idempotent)
INSERT INTO sources (name, slug, type, description, audience, reach, feed_url, intake_email)
VALUES
  -- Newsletters
  (
    'The Rundown AI',
    'the-rundown-ai',
    'newsletter',
    'Daily AI news covering the latest developments in artificial intelligence, machine learning, and tech. Concise summaries of the most important AI stories.',
    'Tech professionals, AI enthusiasts, entrepreneurs',
    '600K+ subscribers',
    NULL,
    NULL
  ),
  (
    'Superhuman AI',
    'superhuman-ai',
    'newsletter',
    'Practical AI tips and tutorials for productivity. Learn how to leverage AI tools to work smarter and faster.',
    'Professionals seeking AI productivity tips',
    '500K+ subscribers',
    NULL,
    NULL
  ),
  (
    'TLDR AI',
    'tldr-ai',
    'newsletter',
    'Daily digest of the most interesting AI and machine learning news, research papers, and tools. Bite-sized summaries for busy professionals.',
    'Developers, researchers, tech professionals',
    '400K+ subscribers',
    NULL,
    NULL
  ),
  (
    'Ben''s Bites',
    'bens-bites',
    'newsletter',
    'Daily AI newsletter with news, tools, and insights. A popular source for keeping up with the fast-moving AI industry.',
    'AI enthusiasts, builders, investors',
    '450K+ subscribers',
    NULL,
    NULL
  ),
  (
    'The Neuron',
    'the-neuron',
    'newsletter',
    'AI news and insights delivered daily. Covers breaking news, product launches, and industry trends in artificial intelligence.',
    'Business leaders, tech professionals',
    '350K+ subscribers',
    NULL,
    NULL
  ),
  (
    'Import AI',
    'import-ai',
    'newsletter',
    'Weekly newsletter covering AI research, policy, and industry developments. In-depth analysis from an AI policy expert.',
    'AI researchers, policymakers, industry professionals',
    '50K+ subscribers',
    NULL,
    NULL
  ),
  -- Blogs (with RSS feed URLs)
  (
    'OpenAI Blog',
    'openai-blog',
    'blog',
    'Official blog from OpenAI featuring announcements, research papers, and updates on GPT, DALL-E, and other AI systems.',
    'Developers, researchers, AI practitioners',
    'Industry-leading AI lab',
    'https://openai.com/blog/rss.xml',
    NULL
  ),
  (
    'Anthropic Blog',
    'anthropic-blog',
    'blog',
    'Official blog from Anthropic covering Claude AI, AI safety research, and constitutional AI developments.',
    'AI safety researchers, developers, enterprises',
    'Leading AI safety company',
    'https://www.anthropic.com/rss.xml',
    NULL
  ),
  (
    'Google DeepMind Blog',
    'google-deepmind-blog',
    'blog',
    'Research and announcements from Google DeepMind, including breakthroughs in reinforcement learning, AlphaFold, and Gemini.',
    'AI researchers, scientists, tech enthusiasts',
    'Top AI research lab',
    'https://deepmind.google/blog/rss.xml',
    NULL
  )
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  audience = EXCLUDED.audience,
  reach = EXCLUDED.reach,
  feed_url = EXCLUDED.feed_url,
  updated_at = now();
