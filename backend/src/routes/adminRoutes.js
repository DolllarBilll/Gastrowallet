const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Protect all admin routes with JWT + ADMIN role check
router.use(authenticateToken, requireRole('ADMIN'));

// Platform overview metrics and top stores leaderboard
router.get('/overview', async (req, res) => {
  try {
    const [offersRes, redemptionsRes, topStoresRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_offers,
           COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_offers
         FROM offers`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_redemptions
         FROM point_transactions
         WHERE tx_type = 'REDEEM'`
      ),
      pool.query(
        `SELECT
           s.id,
           s.name,
           s.email,
           s.is_active,
           s.created_at,
           COUNT(DISTINCT c.id)::int AS customer_count,
           COUNT(DISTINCT o.id)::int AS offers_count,
           COUNT(DISTINCT pt.id) FILTER (WHERE pt.tx_type = 'REDEEM')::int AS redemptions_count
         FROM stores s
         LEFT JOIN customers c ON c.store_id = s.id
         LEFT JOIN offers o ON o.store_id = s.id
         LEFT JOIN point_transactions pt ON pt.store_id = s.id
         GROUP BY s.id
         ORDER BY redemptions_count DESC, customer_count DESC, s.created_at DESC
         LIMIT 5`
      ),
    ]);

    return res.json({
      totalOffers: offersRes.rows[0]?.total_offers ?? 0,
      activeOffers: offersRes.rows[0]?.active_offers ?? 0,
      totalRedemptions: redemptionsRes.rows[0]?.total_redemptions ?? 0,
      topStores: topStoresRes.rows || [],
    });
  } catch (err) {
    console.error('Error loading admin overview:', err);
    return res.status(500).json({ error: 'Failed to load overview metrics' });
  }
});

// List all stores managed on the platform
router.get('/stores', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         s.id,
         s.name,
         s.email,
         s.is_active,
         s.created_at,
         COUNT(c.id)::int AS customer_count
       FROM stores s
       LEFT JOIN customers c ON c.store_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at DESC`
    );

    return res.json({ stores: result.rows });
  } catch (err) {
    console.error('Error fetching stores:', err);
    return res.status(500).json({ error: 'Failed to load stores' });
  }
});

// Create a new store account
router.post('/stores', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO stores (name, email, password_hash, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, email, is_active, created_at`,
      [String(name).trim(), String(email).trim().toLowerCase(), passwordHash]
    );

    return res.status(201).json({ store: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A store with this email already exists' });
    }
    console.error('Error creating store:', err);
    return res.status(500).json({ error: 'Failed to create store' });
  }
});

// Impersonate a store account so an ADMIN can view its StoreDashboard without password
router.post('/stores/:storeId/impersonate', async (req, res) => {
  const { storeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, email, is_active, created_at
       FROM stores
       WHERE id = $1`,
      [storeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const store = result.rows[0];

    const storeToken = jwt.sign(
      {
        id: store.id,
        role: 'STORE',
        storeId: store.id,
        store_id: store.id,
        storeName: store.name,
        email: store.email,
        impersonatedByAdminId: req.user?.id || req.user?.sub || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token: storeToken,
      user: {
        id: store.id,
        role: 'STORE',
        storeId: store.id,
        store_id: store.id,
        storeName: store.name,
        email: store.email,
        impersonatedByAdmin: true,
      },
      store,
    });
  } catch (err) {
    console.error('Error impersonating store:', err);
    return res.status(500).json({ error: 'Failed to impersonate store' });
  }
});

// Update store details (name, email, optional password)
router.patch('/stores/:storeId', async (req, res) => {
  const { storeId } = req.params;
  const { name, email, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    let result;
    if (password && String(password).trim()) {
      const passwordHash = await bcrypt.hash(String(password), 10);
      result = await pool.query(
        `UPDATE stores
         SET name = $1, email = $2, password_hash = $3
         WHERE id = $4
         RETURNING id, name, email, is_active, created_at`,
        [trimmedName, normalizedEmail, passwordHash, storeId]
      );
    } else {
      result = await pool.query(
        `UPDATE stores
         SET name = $1, email = $2
         WHERE id = $3
         RETURNING id, name, email, is_active, created_at`,
        [trimmedName, normalizedEmail, storeId]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    return res.json({ store: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A store with this email already exists' });
    }
    console.error('Error updating store:', err);
    return res.status(500).json({ error: 'Failed to update store' });
  }
});

// Delete a store account
router.delete('/stores/:storeId', async (req, res) => {
  const { storeId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM stores
       WHERE id = $1
       RETURNING id`,
      [storeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    return res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete store while linked records still exist',
      });
    }
    console.error('Error deleting store:', err);
    return res.status(500).json({ error: 'Failed to delete store' });
  }
});

// Toggle store active status
router.patch('/stores/:storeId/status', async (req, res) => {
  const { storeId } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  try {
    const result = await pool.query(
      `UPDATE stores
       SET is_active = $1
       WHERE id = $2
       RETURNING id, name, email, is_active, created_at`,
      [isActive, storeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    return res.json({ store: result.rows[0] });
  } catch (err) {
    console.error('Error updating store status:', err);
    return res.status(500).json({ error: 'Failed to update store status' });
  }
});

// List platform admin accounts
router.get('/admins', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, is_owner, is_active, created_at
       FROM admins
       ORDER BY is_owner DESC, created_at ASC`
    );

    return res.json({ admins: result.rows });
  } catch (err) {
    console.error('Error fetching admins:', err);
    return res.status(500).json({ error: 'Failed to load admins' });
  }
});

// Create an additional platform admin account
router.post('/admins', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO admins (full_name, email, password_hash, is_owner, is_active)
       VALUES ($1, $2, $3, FALSE, TRUE)
       RETURNING id, full_name, email, is_owner, is_active, created_at`,
      [String(fullName).trim(), String(email).trim().toLowerCase(), passwordHash]
    );

    return res.status(201).json({ admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An admin with this email already exists' });
    }
    console.error('Error creating admin:', err);
    return res.status(500).json({ error: 'Failed to create admin' });
  }
});

// Update admin details (fullName, email, optional password)
router.patch('/admins/:adminId', async (req, res) => {
  const { adminId } = req.params;
  const { fullName, email, password } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Full name and email are required' });
  }

  try {
    const trimmedName = String(fullName).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    let result;
    if (password && String(password).trim()) {
      const passwordHash = await bcrypt.hash(String(password), 10);
      result = await pool.query(
        `UPDATE admins
         SET full_name = $1, email = $2, password_hash = $3
         WHERE id = $4
         RETURNING id, full_name, email, is_owner, is_active, created_at`,
        [trimmedName, normalizedEmail, passwordHash, adminId]
      );
    } else {
      result = await pool.query(
        `UPDATE admins
         SET full_name = $1, email = $2
         WHERE id = $3
         RETURNING id, full_name, email, is_owner, is_active, created_at`,
        [trimmedName, normalizedEmail, adminId]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    return res.json({ admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An admin with this email already exists' });
    }
    console.error('Error updating admin:', err);
    return res.status(500).json({ error: 'Failed to update admin' });
  }
});

// Delete a non-owner admin account
router.delete('/admins/:adminId', async (req, res) => {
  const { adminId } = req.params;

  try {
    const targetRes = await pool.query(
      `SELECT id, is_owner FROM admins WHERE id = $1`,
      [adminId]
    );

    if (targetRes.rowCount === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (targetRes.rows[0].is_owner) {
      return res.status(400).json({ error: 'Owner admin account cannot be deleted' });
    }

    const result = await pool.query(
      `DELETE FROM admins
       WHERE id = $1
       RETURNING id`,
      [adminId]
    );

    return res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete admin while linked records still exist',
      });
    }
    console.error('Error deleting admin:', err);
    return res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// Toggle admin active status (protects owner account from deactivation)
router.patch('/admins/:adminId/status', async (req, res) => {
  const { adminId } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  try {
    const targetRes = await pool.query(
      `SELECT id, is_owner FROM admins WHERE id = $1`,
      [adminId]
    );

    if (targetRes.rowCount === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (targetRes.rows[0].is_owner && !isActive) {
      return res.status(400).json({ error: 'Owner admin account cannot be deactivated' });
    }

    const result = await pool.query(
      `UPDATE admins
       SET is_active = $1
       WHERE id = $2
       RETURNING id, full_name, email, is_owner, is_active, created_at`,
      [isActive, adminId]
    );

    return res.json({ admin: result.rows[0] });
  } catch (err) {
    console.error('Error updating admin status:', err);
    return res.status(500).json({ error: 'Failed to update admin status' });
  }
});

module.exports = router;