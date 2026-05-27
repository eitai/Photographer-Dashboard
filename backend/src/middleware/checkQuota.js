const Subscription = require('../models/Subscription');
const { getStorageUsedBytes } = require('../utils/storageUsage');

const checkQuota = async (req, res, next) => {
  if (req.admin?.role === 'superadmin') return next();

  try {
    const sub = await Subscription.findByAdminId(req.admin.id);
    const quota = Subscription.resolveQuotaBytes(sub);

    // null quota = unlimited
    if (quota === null) return next();

    const used = await getStorageUsedBytes(req.admin.id);

    if (used >= quota) {
      return res.status(413).json({
        code: 'QUOTA_EXCEEDED',
        message: `Storage quota of ${(quota / 1024 ** 3).toFixed(1)} GB exceeded`,
        used,
        quota,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = checkQuota;
