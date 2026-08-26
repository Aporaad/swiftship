// Security Shield: Console Log Sanitizer
// Prevents sensitive API keys, Supabase URLs, custom tokens, and auth secrets from appearing in Developer Console

const IS_PROD = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.PROD;


// Patterns that must never be printed to console
const SENSITIVE_PATTERNS = [
  /https:\/\/[a-z0-9-]+\.supabase\.co/gi,
  /custom_token_[a-zA-Z0-9_-]+/gi,
  /sb_publishable_[a-zA-Z0-9_-]+/gi,
  /apikey=[a-zA-Z0-9_-]+/gi,
  /swiftship_[a-zA-Z0-9_-]+/gi,
  /password123/gi,
  /swiftship@system_pw_2026/gi
];

function sanitizeValue(val: any): any {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    let sanitized = val;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECURE_TOKEN]');
    }
    return sanitized;
  }

  if (typeof val === 'object') {
    try {
      // Prevent mutating non-plain objects or recursive DOM elements
      if (val instanceof HTMLElement || val instanceof Event) return val;
      const jsonStr = JSON.stringify(val);
      let sanitizedStr = jsonStr;
      for (const pattern of SENSITIVE_PATTERNS) {
        sanitizedStr = sanitizedStr.replace(pattern, '[REDACTED_SECURE_TOKEN]');
      }
      if (sanitizedStr !== jsonStr) {
        return JSON.parse(sanitizedStr);
      }
    } catch (_) {
      // Return original if JSON cycle or unsupported object
    }
  }

  return val;
}

export function initConsoleSanitizer() {
  if (typeof window === 'undefined') return;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalWarn = console.warn;
  const originalError = console.error;

  if (IS_PROD) {
    // Silence verbose console logging in production environment completely
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
    console.warn = (...args: any[]) => {
      // Allow warnings only if non-sensitive
      const safeArgs = args.map(sanitizeValue);
      originalWarn.apply(console, safeArgs);
    };
    console.error = (...args: any[]) => {
      const safeArgs = args.map(sanitizeValue);
      originalError.apply(console, safeArgs);
    };
  } else {
    // In Development, sanitize all args passed to console
    console.log = (...args: any[]) => {
      const safeArgs = args.map(sanitizeValue);
      originalLog.apply(console, safeArgs);
    };

    console.info = (...args: any[]) => {
      const safeArgs = args.map(sanitizeValue);
      originalInfo.apply(console, safeArgs);
    };

    console.debug = (...args: any[]) => {
      const safeArgs = args.map(sanitizeValue);
      originalDebug.apply(console, safeArgs);
    };

    console.warn = (...args: any[]) => {
      const safeArgs = args.map(sanitizeValue);
      originalWarn.apply(console, safeArgs);
    };

    console.error = (...args: any[]) => {
      const safeArgs = args.map(sanitizeValue);
      originalError.apply(console, safeArgs);
    };
  }
}

// Auto-initialize on import
initConsoleSanitizer();
