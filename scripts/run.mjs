import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// --- Helper Functions ---
function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function interpolate(templateString, context) {
  if (typeof templateString !== 'string') return templateString;
  // Interpolation for {variable.path} (RFC 6570 style)
  return templateString.replace(/{([^}]+)}/g, (match, path) => {
    const value = getNested(context, path);
    return value !== undefined ? (typeof value === 'object' ? JSON.stringify(value) : value) : match;
  });
}

function interpolateDeep(data, context) {
  if (Array.isArray(data)) {
    return data.map(item => interpolateDeep(item, context));
  }
  if (typeof data === 'string') {
    // If the string is exclusively a variable placeholder (e.g., "{my.var}"),
    // return the raw value to preserve its type (object, array, etc.).
    const match = data.match(/^{([^}]+)}$/);
    if (match) {
      return getNested(context, match[1]);
    }
    // Otherwise, perform standard string interpolation.
    return interpolate(data, context);
  }
  if (typeof data === 'object' && data !== null) {
    const newObj = {};
    for (const key in data) {
      newObj[key] = interpolateDeep(data[key], context);
    }
    return newObj;
  }
  return data; // Return numbers, booleans, etc. as is.
}

let planRegistry = null;
function getPlanRegistry() {
  if (!planRegistry) {
    const manifestPath = resolve(projectRoot, 'canonical/manifest.json');
    planRegistry = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  }
  return planRegistry;
}

// --- The Engine ---
async function runPlan(planPath, initialParams = {}) {
  const planFullPath = resolve(projectRoot, planPath);
  console.log(`🚀 [ENGINE] Starting execution of plan: ${planPath}`);

  try {
    const plan = JSON.parse(readFileSync(planFullPath, 'utf-8'));

    // NEW: Validate initial parameters against the plan's schema
    if (plan.parameters) {
      const ajv = new Ajv2020({ allErrors: true });
      addFormats(ajv);
      const validate = ajv.compile(plan.parameters);
      if (!validate(initialParams)) {
        console.error('❌ [ENGINE] Вхідні параметри не відповідають схемі плану:');
        console.error(JSON.stringify(validate.errors, null, 2));
        process.exit(1);
      }
      console.log('✅ [ENGINE] Вхідні параметри успішно провалідовано.');
    }

    const context = { ...initialParams }; // Initialize context with input parameters

    // --- Action Handlers ---
    const actionHandlers = {
      'context:set': async (payload) => {
        const { variable, value } = payload;
        if (variable) {
          context[variable] = value;
          console.log(`[ENGINE] Set context['${variable}'] =`, value);
        }
        return true;
      },
      'flow:switch': async (payload) => {
        const { value, cases, default: defaultActions } = payload;
        const caseActions = cases[value];

        if (caseActions) {
          console.log(`[ENGINE] Matched case: "${value}". Executing...`);
          await executeActionList(caseActions, context);
        } else if (defaultActions) {
          console.log(`[ENGINE] No case matched. Executing default block...`);
          await executeActionList(defaultActions, context);
        }
        return true;
      },
      'flow:parallel': async (payload) => {
        const branches = Object.values(payload);
        const promises = branches.map(actions => executeActionList(actions, context));
        // Note: This simple implementation uses a shared context, which can lead to race conditions
        // if parallel branches modify the same variable.
        await Promise.all(promises);
        return true;
      },
      'flow:try': async (payload) => {
        const { try: tryActions, catch: catchBlock, finally: finallyActions } = payload;
        try {
          await executeActionList(tryActions, context);
        } catch (error) {
          console.error(`[ENGINE] Caught error in 'try' block:`, error.message);
          if (catchBlock && catchBlock.actions) {
            const errorVar = catchBlock.as || 'error';
            context[errorVar] = { message: error.message, stack: error.stack };
            await executeActionList(catchBlock.actions, context);
          }
        } finally {
          if (finallyActions) {
            console.log(`[ENGINE] Executing 'finally' block...`);
            await executeActionList(finallyActions, context);
          }
        }
        return true;
      },
      'flow:delay': async (payload) => {
        const ms = payload.ms || 0;
        console.log(`[ENGINE] Delaying for ${ms}ms...`);
        await new Promise(resolve => setTimeout(resolve, ms));
        console.log(`[ENGINE] Delay finished.`);
        return true;
      },
      'flow:invoke': async (payload) => {
        const { plan_ref, parameters, result_in } = payload;
        if (!plan_ref) {
          console.error('[ENGINE] `plan_ref` is required for flow:invoke');
          return false;
        }
        
        const registry = getPlanRegistry();
        const subPlanPath = registry[plan_ref];

        if (!subPlanPath) {
          console.error(`[ENGINE] Sub-plan "${plan_ref}" not found in manifest.`);
          return false;
        }

        console.log(`[ENGINE] Invoking sub-plan "${plan_ref}" from path: ${subPlanPath}`);
        const subPlanResult = await runPlan(subPlanPath, parameters || {});

        const resultVar = result_in || 'останній_результат';
        context[resultVar] = subPlanResult;
        console.log(`[ENGINE] Sub-plan result stored in context['${resultVar}']`);
        return true;
      },
      'flow:return': async (payload) => {
        return { returned: true, value: payload }; // Special object to signal return
      },
      'console:log': async (payload) => {
        console.log(`[ENGINE] Executing console:log ->`, payload.message);
        return true;
      },
      'http:request': async (payload) => {
        const { url, method, headers, body, result_in } = payload; // Already interpolated
        console.log(`[ENGINE] Making ${method} request to ${url}`);
        try {
          const response = await fetch(url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined,
          });
          console.log(`[ENGINE] Received response. Status: ${response.status}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const responseData = await response.json();
          const resultVar = result_in || 'остання_відповідь';
          context[resultVar] = {
            status: response.status,
            body: responseData,
          };
          console.log(`[ENGINE] HTTP result stored in context['${resultVar}']`);
          return true;
        } catch (e) {
          console.error(`[ENGINE] HTTP request failed:`, e);
          context.остання_помилка = e.message;
          return false;
        }
      },
    };

    if (!plan.actions || !Array.isArray(plan.actions)) {
      throw new Error('Invalid plan: "actions" array is missing or not an array.');
    }

    async function processSingleAction(action, currentContext) {
      const handler = actionHandlers[action.invoke];

      if (handler) {
        const interpolatedPayload = interpolateDeep(action.payload || {}, currentContext);
        // We must wrap the handler call in a try/catch to propagate errors up to flow:try
        try {
          const result = await handler(interpolatedPayload);

          // Handle flow:return
          if (result && result.returned) {
            return result;
          }

          const success = result; // For other actions, result is a boolean
          // If the action failed and has an on_error block, execute it.
          if (success === false && action.on_error) {
            console.log(`[ENGINE] Executing on_error block...`);
            return await executeActionList(action.on_error, currentContext);
          } else if (success === true && action.on_success) {
            console.log(`[ENGINE] Executing on_success block...`);
            return await executeActionList(action.on_success, currentContext);
          }
        } catch (error) {
          throw error; // Re-throw to be caught by the 'flow:try' handler
        }
      } else {
        console.warn(`⚠️  [ENGINE] No handler found for invoke key: "${action.invoke}". Skipping.`);
      }
      return { returned: false };
    }

    async function executeActionList(actions, currentContext) {
      for (const action of actions) {
        console.log(`\n▶️  Processing action with invoke: ${action.invoke}`);
        const loopOverPath = action.for_each;
        const loopOver = loopOverPath ? getNested(currentContext, interpolate(loopOverPath, currentContext)) : null;

        if (loopOver && Array.isArray(loopOver)) {
          console.log(`🔄 Looping over "${interpolate(loopOverPath, currentContext)}" (${loopOver.length} items)`);
          const loopVarName = action.loop_variable || 'item';
          for (const item of loopOver) {
            const originalValue = currentContext[loopVarName];
            currentContext[loopVarName] = item; // Set the loop variable in the context

            // Check condition for EACH item in the loop
            if (action.if) {
              const conditionValue = getNested(currentContext, interpolate(action.if, currentContext));
              if (!conditionValue) {
                console.log(`⏭️  Skipping item: condition "${action.if}" is falsy.`);
                continue; // Skip to next item in the loop
              }
            }
            const result = await processSingleAction(action, currentContext);
            if (result.returned) return result; // Propagate return value up

            // Restore context
            currentContext[loopVarName] = originalValue;
            if (currentContext[loopVarName] === undefined) delete currentContext[loopVarName];
          }
        } else {
          // Not a loop, check condition once
          if (action.if) {
            const conditionValue = getNested(currentContext, interpolate(action.if, currentContext));
            if (!conditionValue) {
              console.log(`⏭️  Skipping action: condition "${action.if}" is falsy.`);
              continue; // Skip to next action in the list
            }
          }
          const result = await processSingleAction(action, currentContext);
          if (result.returned) return result; // Propagate return value up
        }
      }
      return { returned: false };
    }

    const finalResult = await executeActionList(plan.actions, context);

    if (finalResult.returned) {
      console.log('\n✅ [ENGINE] Plan finished with a return value:', finalResult.value);
      return finalResult.value;
    } else {
      console.log('\n✅ [ENGINE] Plan execution finished successfully.');
      return context; // Return the final context if no explicit return
    }
  } catch (error) {
    console.error(`💥 [ENGINE] Critical error during plan execution:`, error);
    process.exit(1);
  }
}

// --- Entry Point ---
const [,, planFile, ...paramsArgs] = process.argv;
// This check ensures the entry point logic only runs when the script is executed directly
if (!planFile) {
  console.error('Error: Please provide a path to a canonical plan file to execute.');
  process.exit(1);
}

const initialParams = {};
for (const arg of paramsArgs) {
  const [key, ...rest] = arg.split('=');
  const value = rest.join('=');
  if (key && value) {
    // A simple attempt to parse non-string values
    try { initialParams[key] = JSON.parse(value); }
    catch { initialParams[key] = value; }
  }
}

if (process.argv[1].endsWith('run.mjs')) {
  runPlan(planFile, initialParams);
}
