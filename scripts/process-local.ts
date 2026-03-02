/**
 * Local script to process emails and send digests
 * Bypasses Vercel timeout limits by running directly
 *
 * Usage: npx tsx scripts/process-local.ts
 */

// Load env vars FIRST before any imports
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('=== AI Newsletter Pipeline ===\n');

  // Dynamic imports after env is loaded
  const { processEmails } = await import('../src/lib/jobs/processEmails');
  const { sendDigests } = await import('../src/lib/jobs/sendDigests');

  // Step 1: Process emails
  console.log('Step 1: Processing emails...');
  try {
    const processResult = await processEmails(20);
    console.log('Process result:', processResult);
  } catch (error) {
    console.error('Error processing emails:', error);
  }

  // Step 2: Send daily digest
  console.log('\nStep 2: Sending daily digest...');
  try {
    const digestResult = await sendDigests('daily', 50);
    console.log('Digest result:', digestResult);
  } catch (error) {
    console.error('Error sending digest:', error);
  }

  console.log('\n=== Pipeline complete ===');
}

main().catch(console.error);
