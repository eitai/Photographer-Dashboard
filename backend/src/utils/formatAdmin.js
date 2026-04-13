/**
 * Strips sensitive and internal fields before sending an admin record to the client.
 * Used by auth.js and admins.js — keep in sync with each other via this shared util.
 *
 * @param {object} a - Admin row from the database
 * @returns {object} Safe admin payload for API responses
 */
function formatAdmin(a) {
  const result = {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    username: a.username || null,
    studioName: a.studioName || null,
  };
  if (a.storageQuotaBytes !== undefined) result.storageQuotaBytes = Number(a.storageQuotaBytes);
  if (a.storageUsedBytes  !== undefined) result.storageUsedBytes  = Number(a.storageUsedBytes);
  return result;
}

module.exports = formatAdmin;
