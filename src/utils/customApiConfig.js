const ALLOWED_PROVIDERS = ['openai', 'gemini', 'claude', 'custom'];
const MAX_FIELD_LENGTH = 500;

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizeConversionMode = (mode) => {
  return mode === 'custom' ? 'custom' : 'default';
};

export const validateAndSanitizeCustomApiConfig = (rawConfig = {}) => {
  const provider = toTrimmedString(rawConfig.provider).toLowerCase();
  const apiKey = toTrimmedString(rawConfig.api_key);
  const endpoint = toTrimmedString(rawConfig.endpoint);
  const model = toTrimmedString(rawConfig.model);

  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return {
      valid: false,
      error: 'Invalid provider. Allowed providers: OpenAI, Gemini, Claude, Custom.'
    };
  }

  if (!apiKey) {
    return {
      valid: false,
      error: 'API key is required for custom conversion mode.'
    };
  }

  if (endpoint.length > MAX_FIELD_LENGTH || model.length > MAX_FIELD_LENGTH) {
    return {
      valid: false,
      error: 'Endpoint or model name exceeds maximum length.'
    };
  }

  const sanitized = {
    provider,
    api_key: apiKey
  };

  if (endpoint) {
    sanitized.endpoint = endpoint;
  }

  if (model) {
    sanitized.model = model;
  }

  return {
    valid: true,
    config: sanitized
  };
};

export const sanitizeCustomApiConfigForResponse = (config) => {
  if (!config || typeof config !== 'object') {
    return null;
  }

  const { api_key, ...safeConfig } = config;
  return safeConfig;
};

export const isAllowedProvider = (provider) => {
  return ALLOWED_PROVIDERS.includes(provider);
};

export const ALLOWED_CUSTOM_API_PROVIDERS = ALLOWED_PROVIDERS;
