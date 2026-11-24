const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

// Authenticate either a platform admin or a store account
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    // Check platform admins table first
    const adminRes = await pool.query(
      `SELECT id, full_name, email, password_hash, is_owner, is_active
       FROM admins
       WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    if (adminRes.rowCount > 0) {
      const admin = adminRes.rows[0];
      if (!admin.is_active) {
        return res.status(403).json({ error: 'Admin account is inactive' });
      }

      const validPassword = await bcrypt.compare(password, admin.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        {
          id: admin.id,
          role: 'ADMIN',
          isOwner: admin.is_owner,
          fullName: admin.full_name,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        user: {
          id: admin.id,
          role: 'ADMIN',
          isOwner: admin.is_owner,
          fullName: admin.full_name,
          email: admin.email,
        },
      });
    }

    // Check stores table if not found in admins
    const storeRes = await pool.query(
      `SELECT id, name, email, password_hash, is_active
       FROM stores
       WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    if (storeRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const store = storeRes.rows[0];
    if (!store.is_active) {
      return res.status(403).json({ error: 'Store account is inactive' });
    }

    const validPassword = await bcrypt.compare(password, store.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: store.id,
        role: 'STORE',
        storeId: store.id,
        storeName: store.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: store.id,
        role: 'STORE',
        storeId: store.id,
        storeName: store.name,
        email: store.email,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;