import fs from 'fs';
import path from 'path';

const templates = [
  'discord_send_message',
  'slack_send_message',
  'telegram_send_message',
  'sendgrid_send_mail',
  'stripe_payment_intent_create',
  'shopify_orders',
  'google_sheets_append',
  'woocommerce_orders_list',
  'jsonld_localbusiness'
];

function smokeTest(canonicalPath) {
  try {
    const data = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
    // Basic checks
    if (!data.mova_version) {
      throw new Error('Missing mova_version');
    }
    if (!data.actions || !Array.isArray(data.actions)) {
      throw new Error('Missing or invalid actions');
    }
    // Specific for jsonld_localbusiness
    if (path.basename(canonicalPath, '.canonical.json') === 'jsonld_localbusiness') {
      if (!data.payload || !data.payload['@context']) {
        throw new Error('Missing @context in JSON-LD payload');
      }
    }
    console.log(`✓ ${path.basename(canonicalPath)} smoke test passed`);
    return true;
  } catch (err) {
    console.error(`Smoke test failed for ${canonicalPath}:`, err.message);
    return false;
  }
}

function runSmoke(dirPath) {
  let allPassed = true;
  for (const template of templates) {
    const filePath = path.join(dirPath, `${template}.canonical.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing canonical file: ${filePath}`);
      allPassed = false;
      continue;
    }
    if (!smokeTest(filePath)) {
      allPassed = false;
    }
  }
  return allPassed;
}

const inputPath = process.argv[2] || 'templates/canonical';
if (!fs.existsSync(inputPath)) {
  console.error(`Directory not found: ${inputPath}`);
  process.exit(1);
}

const success = runSmoke(inputPath);
if (!success) {
  process.exit(1);
}