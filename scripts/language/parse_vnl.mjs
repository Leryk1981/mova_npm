import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

// --- Налаштування ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// --- Завантаження конфігурації ---
function loadVnlVocabulary() {
  const vocabPath = resolve(projectRoot, 'templates/messages/en.json');
  const vocab = JSON.parse(readFileSync(vocabPath, 'utf-8'));
  return {
    verbs: new Set(vocab.verbs),
    nouns: new Set(vocab.nouns),
    prepositions: new Set(Object.keys(vocab.prepositions)),
  };
}

function loadVnlMapping() {
  const mappingPath = resolve(projectRoot, 'templates/mappings/vnl_mapping.json');
  if (!existsSync(mappingPath)) {
      console.error(`❌ Помилка: Файл конфігурації відображень не знайдено за шляхом: ${mappingPath}`);
      throw new Error('Mapping file not found.');
  }
  return JSON.parse(readFileSync(mappingPath, 'utf-8'));
}

// --- Парсер ---
function parseVnl(sentence, vocabulary) {
  const { verbs, nouns, prepositions } = vocabulary;
  const tokens = sentence.trim().split(/\s+/);

  if (tokens.length < 2) {
    throw new Error('Речення занадто коротке. Очікується як мінімум дієслово та іменник.');
  }

  const verb = tokens[0];
  if (!verbs.has(verb)) {
    throw new Error(`Невідоме дієслово: "${verb}".`);
  }

  const noun = tokens[1];
  if (!nouns.has(noun)) {
    throw new Error(`Невідомий іменник: "${noun}".`);
  }

  const ast = {
    verb,
    noun,
    params: {},
  };

  // Обробка параметрів, що йдуть після дієслова та іменника
  let currentPreposition = null;
  let currentValues = [];

  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i].replace(/^'|'$/g, '').replace(/^"|"$/g, ''); // Видаляємо лапки
    if (prepositions.has(token)) {
      // Якщо ми знайшли новий прийменник, зберігаємо попередні значення
      if (currentPreposition && currentValues.length > 0) {
        ast.params[currentPreposition] = currentValues.join(' ');
      }
      // Починаємо збирати значення для нового прийменника
      currentPreposition = token;
      currentValues = [];
    } else if (currentPreposition) {
      // Додаємо токен до значень поточного прийменника
      currentValues.push(token);
    } else {
      // Ігноруємо токени, що йдуть перед першим прийменником
      console.warn(`⚠️  Ігнорується токен "${token}" перед першим прийменником.`);
    }
  }

  // Зберігаємо останні зібрані значення
  if (currentPreposition && currentValues.length > 0) {
    ast.params[currentPreposition] = currentValues.join(' ');
  }

  return ast;
}

// --- Трансформатор ---
function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
}

function transformAstToAction(ast, mapping) {
  const vnlKey = `${ast.verb} ${ast.noun}`;
  const rule = mapping[vnlKey];

  if (!rule) {
    console.warn(`\n⚠️  Не знайдено правило трансформації для "${vnlKey}". Створюється мета-дія 'vnl'.`);
    return {
      "тип": "обробка_речення",
      "речення": `${ast.verb} ${ast.noun}...`,
      "дерево_розбору": ast
    };
  }

  const action = JSON.parse(JSON.stringify(rule.action));

  for (const paramName in ast.params) {
    const targetPath = rule.params_mapping[paramName];
    if (targetPath) {
      setNestedProperty(action, targetPath, ast.params[paramName]);
    } else {
      console.warn(`⚠️  Для параметра "${paramName}" не знайдено відповідності у правилі для "${vnlKey}".`);
    }
  }
  return action;
}

function generatePlanFromAction(action, originalSentence) {
  const plan = {
    "версія": "3.3",
    "опис": `План, згенерований з речення: "${originalSentence}"`,
    "дії": [action]
  };
  return plan;
}


// --- Точка входу ---
const sentence = process.argv.slice(2).join(' ');

if (!sentence) {
  console.error('❌ Помилка: Будь ласка, надайте речення для парсингу.');
  console.log('\nПриклад:');
  console.log('npm run parse:vnl -- "send message to general with text \'Hello World\'"');
  process.exit(1);
}

try {
  console.log(`--- Парсинг речення: "${sentence}" ---`);
  const vocabulary = loadVnlVocabulary();
  const mapping = loadVnlMapping();
  const ast = parseVnl(sentence, vocabulary);
  
  console.log('\n✅ Абстрактне синтаксичне дерево (AST):');
  console.log(JSON.stringify(ast, null, 2));

  const finalAction = transformAstToAction(ast, mapping);
  console.log('\n✅ Трансформована дія:');
  console.log(JSON.stringify(finalAction, null, 2));

  const plan = generatePlanFromAction(finalAction, sentence);
  console.log('\n✅ Згенерований український план:');
  console.log(JSON.stringify(plan, null, 2));

} catch (error) {
  console.error(`💥 Помилка парсингу: ${error.message}`);
  process.exit(1);
}