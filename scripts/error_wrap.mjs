// Unified 422 error wrapper
function coerceDetail(detail) {
  if (!detail || typeof detail !== 'object') {
    return { message: String(detail ?? 'Unknown error') };
  }
  if (Object.prototype.hasOwnProperty.call(detail, 'instancePath') || Object.prototype.hasOwnProperty.call(detail, 'schemaPath')) {
    const normalized = {
      path: detail.instancePath || detail.schemaPath || '',
      message: detail.message || 'Validation error'
    };
    if (detail.keyword) {
      normalized.keyword = detail.keyword;
    }
    if (detail.params && Object.keys(detail.params).length) {
      normalized.params = detail.params;
    }
    return normalized;
  }
  if (typeof detail.message === 'string' && Object.prototype.hasOwnProperty.call(detail, 'path')) {
    return detail;
  }
  if (typeof detail.message === 'string') {
    return detail;
  }
  return { ...detail, message: detail.message ?? 'Validation error' };
}

export function normalizeAjvErrors(errors = []) {
  return (errors ?? []).map(coerceDetail);
}

export function validationError(message, details = []) {
  return {
    status: 422,
    body: {
      error: {
        code: 'VALIDATION_FAILED',
        message,
        details: details.map(coerceDetail)
      }
    }
  };
}
