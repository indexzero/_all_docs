/**
 * Projection module - field selection and transformation
 *
 * Supports simple selector syntax: "name, versions|keys, time.modified as modified"
 */

// Built-in transforms
const TRANSFORMS = {
  keys: (obj) => obj ? Object.keys(obj) : [],
  values: (obj) => obj ? Object.values(obj) : [],
  length: (x) => x?.length ?? 0,
  first: (arr) => arr?.[0],
  last: (arr) => arr?.[arr.length - 1],
  sort: (arr) => [...(arr || [])].sort(),
  reverse: (arr) => [...(arr || [])].reverse(),
  unique: (arr) => [...new Set(arr || [])],
  flatten: (arr) => (arr || []).flat(),
  compact: (arr) => (arr || []).filter(Boolean),
  entries: (obj) => obj ? Object.entries(obj) : [],
  sum: (arr) => (arr || []).reduce((a, b) => a + b, 0),
  min: (arr) => arr?.length ? Math.min(...arr) : null,
  max: (arr) => arr?.length ? Math.max(...arr) : null,
};

/**
 * Get a nested value from an object using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Dot-separated path (e.g., "time.modified")
 */
function getPath(obj, path) {
  if (!path || path === '.') return obj;

  const parts = path.split('.');
  let value = obj;

  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }

  return value;
}

/**
 * Apply a transform function to a value
 */
function applyTransform(value, transformName) {
  const fn = TRANSFORMS[transformName];
  if (!fn) {
    throw new Error(`Unknown transform: ${transformName}. Available: ${Object.keys(TRANSFORMS).join(', ')}`);
  }
  return fn(value);
}

/**
 * Parse a field expression like "versions|keys|length as version_count"
 * @returns {{ path: string, transforms: string[], alias: string }}
 */
function parseFieldExpr(expr) {
  // Handle "expr as alias" syntax
  let alias = null;
  let mainExpr = expr.trim();

  const asMatch = mainExpr.match(/^(.+)\s+as\s+(\w+)$/i);
  if (asMatch) {
    mainExpr = asMatch[1].trim();
    alias = asMatch[2];
  }

  // Parse path and transforms: "versions|keys|length"
  const parts = mainExpr.split('|').map(p => p.trim());
  const path = parts[0];
  const transforms = parts.slice(1);

  // Default alias is the path (or last path segment)
  if (!alias) {
    alias = path.includes('.') ? path.split('.').pop() : path;
    // If there are transforms, append them to alias
    if (transforms.length > 0) {
      alias = `${alias}_${transforms[transforms.length - 1]}`;
    }
  }

  return { path, transforms, alias };
}

/**
 * Compile a simple selector expression into a projection function
 * @param {string} selectExpr - e.g., "name, versions|keys as versions, time.modified"
 * @returns {Function} Projection function
 */
export function compileSelector(selectExpr) {
  if (!selectExpr) return (obj) => obj;

  // Parse the comma-separated field expressions
  const fields = selectExpr.split(',').map(f => parseFieldExpr(f.trim()));

  return (obj) => {
    const result = {};

    for (const { path, transforms, alias } of fields) {
      let value = getPath(obj, path);

      // Apply transforms in order
      for (const t of transforms) {
        value = applyTransform(value, t);
      }

      result[alias] = value;
    }

    return result;
  };
}

/**
 * Compile a filter expression
 * Supports simple comparisons: "versions|length > 10"
 */
export function compileFilter(filterExpr) {
  if (!filterExpr) return () => true;

  // Simple comparison patterns
  const comparisonMatch = filterExpr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);

  if (comparisonMatch) {
    const [, leftExpr, op, rightExpr] = comparisonMatch;
    const { path: leftPath, transforms: leftTransforms } = parseFieldExpr(leftExpr.trim());
    const rightValue = parseValue(rightExpr.trim());

    return (obj) => {
      let leftValue = getPath(obj, leftPath);
      for (const t of leftTransforms) {
        leftValue = applyTransform(leftValue, t);
      }

      switch (op) {
        case '==': return leftValue === rightValue;
        case '!=': return leftValue !== rightValue;
        case '>': return leftValue > rightValue;
        case '<': return leftValue < rightValue;
        case '>=': return leftValue >= rightValue;
        case '<=': return leftValue <= rightValue;
        default: return true;
      }
    };
  }

  // Existence check: just a path
  const { path, transforms } = parseFieldExpr(filterExpr);
  return (obj) => {
    let value = getPath(obj, path);
    for (const t of transforms) {
      value = applyTransform(value, t);
    }
    return Boolean(value);
  };
}

/**
 * Parse a literal value from a filter expression
 */
function parseValue(str) {
  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }
  // Boolean
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  // String (quoted)
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  // Unquoted string
  return str;
}

/**
 * Create a projection function from options
 */
export function createProjection(options = {}) {
  if (options.select) {
    return compileSelector(options.select);
  }
  return (obj) => obj;
}

/**
 * Create a filter function from options
 */
export function createFilter(options = {}) {
  if (options.where) {
    return compileFilter(options.where);
  }
  return () => true;
}
