/**
 * Converts a snake_case pg row object to camelCase.
 * The `id` field is kept as-is (UUID string).
 */
function rowToCamel(row) {
  if (!row) return null;
  const result = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    result[camel] = row[key];
  }
  return result;
}

module.exports = { rowToCamel };
