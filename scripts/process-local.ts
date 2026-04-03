/**
 * Local script to process emails and send digests
 * Bypasses Vercel timeout limits by running directly
 *
 * Usage: npx tsx scripts/process-local.ts
 */

// Load env vars FIRST before any imports
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('=== AI Newsletter Ingestion Pipeline ===\n');
  console.log('NOTE: Digest sending is handled exclusively by Vercel crons.');
  console.log('This script only processes inbound emails (ingestion only).\n');

  // Dynamic imports after env is loaded
  const { processEmails } = await import('../src/lib/jobs/processEmails');

  // Step 1: Process emails
  console.log('Step 1: Processing emails...');
  try {
    const processResult = await processEmails(20);
    console.log('Process result:', processResult);
  } catch (error) {
    console.error('Error processing emails:', error);
  }

  console.log('\n=== Ingestion complete ===');
}

main().catch(console.error);
