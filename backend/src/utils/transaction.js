const mongoose = require('mongoose');

/**
 * Runs `fn(session)` inside a MongoDB multi-document transaction.
 *
 * In production, the MongoDB deployment MUST be a replica set (Atlas or self-hosted).
 * In development/test with a standalone mongod, transactions are not supported;
 * we fall back to unprotected sequential writes so local dev still works.
 */
async function withTransaction(fn) {
  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => fn(session));
  } catch (err) {
    // Standalone MongoDB (local dev) reports code 20 or a message containing
    // "Transaction numbers" when sessions/transactions are unavailable.
    const isStandalone =
      err.code === 20 ||
      err.codeName === 'IllegalOperation' ||
      err.message?.includes('Transaction numbers') ||
      err.message?.includes('not support transactions');

    if (process.env.NODE_ENV !== 'production' && isStandalone) {
      return fn(null); // fall back to unprotected writes
    }
    throw err;
  } finally {
    session?.endSession();
  }
}

module.exports = { withTransaction };
