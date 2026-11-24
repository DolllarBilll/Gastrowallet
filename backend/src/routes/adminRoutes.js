const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Protect all admin routes with JWT + ADMIN role check
router.use(authenticateToken, requireRole('ADMIN'));

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