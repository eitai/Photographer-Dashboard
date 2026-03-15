const express = require('express');
const Admin = require('../models/Admin');
const SiteSettings = require('../models/SiteSettings');
const { superprotect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All routes require superadmin
router.use(superprotect);

// GET /api/admins
router.get('/', async (req, res) => {
  const admins = await Admin.find().select('-password').sort({ createdAt: 1 });
  res.json(admins);
});

// POST /api/admins
router.post('/', async (req, res) => {
  const { name, email, password, role, username, studioName } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });

  const exists = await Admin.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already in use' });

  if (username) {
    const usernameTaken = await Admin.findOne({ username: username.toLowerCase() });
    if (usernameTaken) return res.status(400).json({ message: 'Username already taken' });
  }

  const admin = await Admin.create({ name, email, password, role: role || 'admin', username: username || undefined, studioName: studioName || undefined });
  res.status(201).json({ id: admin._id, name: admin.name, email: admin.email, role: admin.role, username: admin.username || null, studioName: admin.studioName || null, createdAt: admin.createdAt });
});

// DELETE /api/admins/:id
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.admin._id.toString())
    return res.status(400).json({ message: 'Cannot delete your own account' });
  await Admin.findByIdAndDelete(req.params.id);
  res.json({ message: 'Admin deleted' });
});

// GET /api/admins/:id/settings — get SiteSettings for that admin
router.get('/:id/settings', async (req, res) => {
  try {
    const settings = await SiteSettings.findOne({ adminId: req.params.id });
    res.json({
      bio: settings?.bio || '',
      heroImagePath: settings?.heroImagePath || '',
      profileImagePath: settings?.profileImagePath || '',
      phone: settings?.phone || '',
      instagramHandle: settings?.instagramHandle || '',
      facebookUrl: settings?.facebookUrl || '',
      heroSubtitle: settings?.heroSubtitle || '',
      contactEmail: settings?.contactEmail || '',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admins/:id — update admin profile
router.patch('/:id', async (req, res) => {
  try {
    const { name, email, studioName, username } = req.body;

    if (username) {
      const conflict = await Admin.findOne({
        username: username.toLowerCase(),
        _id: { $ne: req.params.id },
      });
      if (conflict) return res.status(400).json({ message: 'Username already taken' });
    }

    const updated = await Admin.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(studioName !== undefined && { studioName: studioName || undefined }),
        ...(username !== undefined && { username: username ? username.toLowerCase() : undefined }),
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updated) return res.status(404).json({ message: 'Admin not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admins/:id/landing — upsert landing page settings
router.put('/:id/landing', async (req, res) => {
  try {
    const { bio, heroSubtitle, phone, contactEmail, instagramHandle, facebookUrl } = req.body;

    const settings = await SiteSettings.findOneAndUpdate(
      { adminId: req.params.id },
      {
        $set: {
          ...(bio !== undefined && { bio }),
          ...(heroSubtitle !== undefined && { heroSubtitle }),
          ...(phone !== undefined && { phone }),
          ...(contactEmail !== undefined && { contactEmail }),
          ...(instagramHandle !== undefined && { instagramHandle }),
          ...(facebookUrl !== undefined && { facebookUrl }),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Landing page updated', settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admins/:id/hero-image — upload hero image
router.post('/:id/hero-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const heroImagePath = `/uploads/${req.file.filename}`;
    await SiteSettings.findOneAndUpdate(
      { adminId: req.params.id },
      { $set: { heroImagePath } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ heroImagePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admins/:id/profile-image — upload profile image
router.post('/:id/profile-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const profileImagePath = `/uploads/${req.file.filename}`;
    await SiteSettings.findOneAndUpdate(
      { adminId: req.params.id },
      { $set: { profileImagePath } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ profileImagePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
