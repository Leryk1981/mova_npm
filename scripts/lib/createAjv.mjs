import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const DEFAULT_OPTIONS = {
  strict: true,
  allErrors: false,
  allowUnionTypes: false,
  removeAdditional: false,
  validateFormats: true,
  unevaluated: true,
  discriminator: true
};

export function createAjv(options = {}) {
  const ajv = new Ajv2020({ ...DEFAULT_OPTIONS, ...options });
  addFormats(ajv);
  return ajv;
}
