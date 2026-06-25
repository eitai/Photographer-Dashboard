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
    ssoEnabled: a.ssoEnabled ?? false,
    firstLogin: a.firstLogin ?? true,
    googleEmail: a.googleEmail || null,
    addressStreet: a.addressStreet || null,
    addressApartment: a.addressApartment || null,
    addressCity: a.addressCity || null,
    addressZip: a.addressZip || null,
    addressCountry: a.addressCountry || null,
    // Billing / permissions (never expose the raw card token)
    canOrderSupplier: a.canOrderSupplier ?? true,
    clientsCanOrder: a.clientsCanOrder ?? true,
    billingBlocked: a.billingBlocked ?? false,
    hasCardOnFile: !!a.payplusCardToken,
    cardLast4: a.cardLast4 || null,
    cardBrand: a.cardBrand || null,
  };
  if (a.storageQuotaBytes !== undefined) result.storageQuotaBytes = Number(a.storageQuotaBytes);
  if (a.storageUsedBytes  !== undefined) result.storageUsedBytes  = Number(a.storageUsedBytes);
  return result;
}

module.exports = formatAdmin;
