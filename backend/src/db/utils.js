/**
 * Converts a snake_case pg row object to camelCase.
 * Also adds `_id` as an alias for `id` so the frontend (which expects MongoDB-style _id) works unchanged.
 */
function rowToCamel(row) {
  if (!row) return null;
  const result = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    result[camel] = row[key];
  }
  if (result.id !== undefined && result._id === undefined) {
    result._id = result.id;
  }
  return result;
}

module.exports = { rowToCamel };
