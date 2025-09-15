import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// --- Action Handlers ---
// A simple registry for our action implementations.
const actionHandlers = {
  'console:log': (payload) => {
    // The original payload key 'повідомлення' is not translated, which is correct.
    const message = payload['повідомлення'] || 'No message provided.';
    console.log(`[ENGINE] Executing console:log ->`, message);
  },
  // We can add more handlers here in the future, e.g., 'http:post', 'db:query'
};

// --- The Engine ---
async function runPlan(planPath) {
  const planFullPath = resolve(projectRoot, planPath);
  console.log(`🚀 [ENGINE] Starting execution of plan: ${planPath}`);

  try {
    const plan = JSON.parse(readFileSync(planFullPath, 'utf-8'));

    if (!plan.actions || !Array.isArray(plan.actions)) {
      throw new Error('Invalid plan: "actions" array is missing or not an array.');
    }

    for (const action of plan.actions) {
      console.log(`\n▶️  Processing action of type: ${action.type}`);
      const handler = actionHandlers[action.invoke];

      if (handler) {
        await handler(action.payload || {});
      } else {
        console.warn(`⚠️  [ENGINE] No handler found for invoke key: "${action.invoke}". Skipping.`);
      }
    }

    console.log('\n✅ [ENGINE] Plan execution finished successfully.');
  } catch (error) {
    console.error(`💥 [ENGINE] Critical error during plan execution:`, error);
    process.exit(1);
  }
}

// --- Entry Point ---
const planFile = process.argv[2];
if (!planFile) {
  console.error('Error: Please provide a path to a canonical plan file to execute.');
  process.exit(1);
}

runPlan(planFile);