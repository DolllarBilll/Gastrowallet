const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireRole('STORE'));

const getStoreId = (req) => req.user?.storeId ?? req.user?.store_id;

const getAppBaseUrl = (req) => {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost || req.get('host');
  if (host) {
    const frontendHost = host.replace(/:5000$/, ':5173');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    return `${protocol}://${frontendHost}`;
  }
  return 'http://localhost:5173';
};

// 1. Get Store Settings (Welcome Bonus, Logo & Points Rate)
router.get('/settings', async (req, res) => {
  const storeId = getStoreId(req);
  try {
    const result = await db.query(
      `SELECT id, name, welcome_bonus_enabled, welcome_bonus_points, logo_url, points_rate_euros, points_rate_points
       FROM stores WHERE id = $1`,
      [storeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    return res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Get store settings error:', err);
    return res.status(500).json({ error: 'Failed to load store settings' });
  }
});

// 1b. Update Store Logo
router.patch('/settings/logo', async (req, res) => {
  const storeId = getStoreId(req);
  const { logo } = req.body;

  if (logo !== null && logo !== '') {
    if (typeof logo !== 'string' || !/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(logo)) {
      return res.status(400).json({ error: 'Invalid logo image format' });
    }
    // ~2.8MB base64 string limit (~2MB binary image)
    if (logo.length > 3_000_000) {
      return res.status(400).json({ error: 'Logo image is too large' });
    }
  }

  const cleanLogo = logo ? logo : null;

  try {
    const result = await db.query(
      `UPDATE stores
       SET logo_url = $1
       WHERE id = $2
       RETURNING id, name, welcome_bonus_enabled, welcome_bonus_points, logo_url, points_rate_euros, points_rate_points`,
      [cleanLogo, storeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    return res.json({ settings: result.rows[0], logoUrl: result.rows[0].logo_url });
  } catch (err) {
    console.error('Update store logo error:', err);
    return res.status(500).json({ error: 'Failed to update store logo' });
  }
});

// 1c. Update Points per Euro Rate
router.patch('/settings/points-rate', async (req, res) => {
  const storeId = getStoreId(req);
  const euros = Number(req.body.euros);
  const points = Number(req.body.points);

  if (!Number.isFinite(euros) || euros <= 0) {
    return res.status(400).json({ error: 'Euros amount must be greater than 0' });
  }
  if (!Number.isInteger(points) || points < 1) {
    return res.status(400).json({ error: 'Points must be a positive integer' });
  }

  try {
    const result = await db.query(
      `UPDATE stores
       SET points_rate_euros = $1, points_rate_points = $2
       WHERE id = $3
       RETURNING id, name, welcome_bonus_enabled, welcome_bonus_points, logo_url, points_rate_euros, points_rate_points`,
      [euros, points, storeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    return res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Update points rate error:', err);
    return res.status(500).json({ error: 'Failed to update points conversion rate' });
  }
});

// 2. Update Welcome Bonus Settings
router.patch('/settings/welcome-bonus', async (req, res) => {
  const storeId = getStoreId(req);
  const { enabled, points } = req.body;
  const parsedPoints = Number(points);

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  if (!Number.isInteger(parsedPoints) || parsedPoints < 1) {
    return res.status(400).json({ error: 'Welcome bonus points must be a positive integer' });
  }

  try {
    const result = await db.query(
      `UPDATE stores
       SET welcome_bonus_enabled = $1, welcome_bonus_points = $2
       WHERE id = $3
       RETURNING id, name, welcome_bonus_enabled, welcome_bonus_points, logo_url, points_rate_euros, points_rate_points`,
      [enabled, parsedPoints, storeId]
    );
    return res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('Update welcome bonus error:', err);
    return res.status(500).json({ error: 'Failed to update welcome bonus settings' });
  }
});

// 3. List Store Offers
router.get('/offers', async (req, res) => {
  const storeId = getStoreId(req);
  try {
    const result = await db.query(
      'SELECT * FROM offers WHERE store_id = $1 ORDER BY created_at DESC',
      [storeId]
    );
    return res.json({ offers: result.rows });
  } catch (err) {
    console.error('List offers error:', err);
    return res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// 4. Create Offer
router.post('/offers', async (req, res) => {
  const storeId = getStoreId(req);
  const { title, description, pointsRequired } = req.body;
  if (!title || !pointsRequired || Number(pointsRequired) < 1) {
    return res.status(400).json({ error: 'Title and valid pointsRequired are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO offers (store_id, title, description, points_required, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING *`,
      [storeId, title.trim(), description ? description.trim() : null, Number(pointsRequired)]
    );
    return res.status(201).json({ offer: result.rows[0] });
  } catch (err) {
    console.error('Create offer error:', err);
    return res.status(500).json({ error: 'Failed to create offer' });
  }
});

// 5. Toggle Offer Status
router.patch('/offers/:id/status', async (req, res) => {
  const storeId = getStoreId(req);
  const { isActive } = req.body;
  try {
    const result = await db.query(
      `UPDATE offers
       SET is_active = $1
       WHERE id = $2 AND store_id = $3
       RETURNING *`,
      [Boolean(isActive), req.params.id, storeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    return res.json({ offer: result.rows[0] });
  } catch (err) {
    console.error('Toggle offer error:', err);
    return res.status(500).json({ error: 'Failed to update offer status' });
  }
});

// 5b. List Store Customers
router.get('/customers', async (req, res) => {
  const storeId = getStoreId(req);
  try {
    const result = await db.query(
      `SELECT id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at
       FROM customers
       WHERE store_id = $1
       ORDER BY created_at DESC, id DESC`,
      [storeId]
    );
    return res.json({ customers: result.rows });
  } catch (err) {
    console.error('List customers error:', err);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// 5c. List Store Point Transactions
router.get('/transactions', async (req, res) => {
  const storeId = getStoreId(req);
  try {
    const result = await db.query(
      `SELECT pt.*, c.full_name AS customer_name, o.title AS offer_title
       FROM point_transactions pt
       LEFT JOIN customers c ON pt.customer_id = c.id
       LEFT JOIN offers o ON pt.offer_id = o.id
       WHERE pt.store_id = $1
       ORDER BY pt.created_at DESC, pt.id DESC
       LIMIT 20`,
      [storeId]
    );
    return res.json({ transactions: result.rows });
  } catch (err) {
    console.error('List transactions error:', err);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// 6. Register Customer (with Duplicate Check & Welcome Bonus)
router.post('/customers', async (req, res) => {
  const storeId = getStoreId(req);
  const { fullName, email, phone, birthday, marketingConsent } = req.body;
  const cleanName = String(fullName || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();
  const rawBirthday = birthday ? String(birthday).trim() : '';
  const cleanBirthday = /^\d{4}-\d{2}-\d{2}/.test(rawBirthday)
    ? rawBirthday.slice(0, 10)
    : null;
  const consent = Boolean(marketingConsent);

  if (!cleanName || !cleanEmail || !cleanPhone) {
    return res.status(400).json({ error: 'First name, last name, email, and phone are required' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at
       FROM customers
       WHERE store_id = $1 AND LOWER(email) = $2
       LIMIT 1`,
      [storeId, cleanEmail]
    );

    if (existingRes.rows.length > 0) {
      await client.query('COMMIT');
      const existingCustomer = existingRes.rows[0];
      const qrDataUrl = await QRCode.toDataURL(existingCustomer.qr_token);
      return res.status(200).json({
        alreadyExists: true,
        customer: existingCustomer,
        qrDataUrl,
      });
    }

    const storeRes = await client.query(
      'SELECT welcome_bonus_enabled, welcome_bonus_points FROM stores WHERE id = $1',
      [storeId]
    );
    const storeSettings = storeRes.rows[0] || {
      welcome_bonus_enabled: false,
      welcome_bonus_points: 10,
    };

    const initialPoints = storeSettings.welcome_bonus_enabled
      ? Number(storeSettings.welcome_bonus_points || 0)
      : 0;

    const qrToken = `GW-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const walletUrl = `${getAppBaseUrl(req)}/wallet/${qrToken}`;

    const insertRes = await client.query(
      `INSERT INTO customers (
        store_id, full_name, email, phone, birthday, marketing_consent, points_balance, qr_token, wallet_url
      )
      VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
      RETURNING id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at`,
      [
        storeId,
        cleanName,
        cleanEmail,
        cleanPhone,
        cleanBirthday || null,
        consent,
        initialPoints,
        qrToken,
        walletUrl,
      ]
    );

    const newCustomer = insertRes.rows[0];

    if (initialPoints > 0) {
      await client.query(
        `INSERT INTO point_transactions (store_id, customer_id, tx_type, points_delta, note)
         VALUES ($1, $2, 'EARN', $3, 'Welcome bonus')`,
        [storeId, newCustomer.id, initialPoints]
      );
    }

    await client.query('COMMIT');

    const qrDataUrl = await QRCode.toDataURL(newCustomer.qr_token);
    return res.status(201).json({
      alreadyExists: false,
      welcomeBonusApplied: initialPoints,
      customer: newCustomer,
      qrDataUrl,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register customer error:', err);
    return res.status(500).json({ error: 'Failed to register customer' });
  } finally {
    client.release();
  }
});

// 7. Lookup Customer by QR Token
router.get('/customers/by-qr/:qrToken', async (req, res) => {
  const storeId = getStoreId(req);
  try {
    const custRes = await db.query(
      `SELECT id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at
       FROM customers
       WHERE store_id = $1 AND qr_token = $2`,
      [storeId, req.params.qrToken.trim()]
    );
    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = custRes.rows[0];
    const txRes = await db.query(
      `SELECT pt.*, o.title AS offer_title
       FROM point_transactions pt
       LEFT JOIN offers o ON pt.offer_id = o.id
       WHERE pt.customer_id = $1
       ORDER BY pt.created_at DESC
       LIMIT 10`,
      [customer.id]
    );

    return res.json({
      customer,
      transactions: txRes.rows,
    });
  } catch (err) {
    console.error('Lookup QR error:', err);
    return res.status(500).json({ error: 'Failed to lookup customer' });
  }
});

// 7b. Lookup Customer by Phone
router.get('/customers/by-phone/:phone', async (req, res) => {
  const storeId = getStoreId(req);
  const rawPhone = String(req.params.phone || '').trim();
  const digitsOnly = rawPhone.replace(/\D/g, '');

  if (!rawPhone && !digitsOnly) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const custRes = await db.query(
      `SELECT id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at
       FROM customers
       WHERE store_id = $1
         AND (
           LOWER(TRIM(COALESCE(phone, ''))) = LOWER($2)
           OR ($3 <> '' AND REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $3)
         )
       LIMIT 1`,
      [storeId, rawPhone, digitsOnly]
    );

    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = custRes.rows[0];
    const txRes = await db.query(
      `SELECT pt.*, o.title AS offer_title
       FROM point_transactions pt
       LEFT JOIN offers o ON pt.offer_id = o.id
       WHERE pt.customer_id = $1
       ORDER BY pt.created_at DESC
       LIMIT 10`,
      [customer.id]
    );

    return res.json({
      customer,
      transactions: txRes.rows,
    });
  } catch (err) {
    console.error('Lookup phone error:', err);
    return res.status(500).json({ error: 'Failed to lookup customer by phone' });
  }
});

// 8. Earn Points
router.post('/customers/:id/earn', async (req, res) => {
  const storeId = getStoreId(req);
  const points = Number(req.body.points);
  if (!Number.isInteger(points) || points < 1) {
    return res.status(400).json({ error: 'Points must be a positive integer' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const custRes = await client.query(
      `UPDATE customers
       SET points_balance = points_balance + $1
       WHERE id = $2 AND store_id = $3
       RETURNING id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at`,
      [points, req.params.id, storeId]
    );

    if (custRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query(
      `INSERT INTO point_transactions (store_id, customer_id, tx_type, points_delta, note)
       VALUES ($1, $2, 'EARN', $3, 'Points added at store')`,
      [storeId, req.params.id, points]
    );

    await client.query('COMMIT');
    return res.json({ customer: custRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Earn points error:', err);
    return res.status(500).json({ error: 'Failed to add points' });
  } finally {
    client.release();
  }
});

// 9. Redeem Offer
router.post('/customers/:id/redeem', async (req, res) => {
  const storeId = getStoreId(req);
  const { offerId } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const offerRes = await client.query(
      'SELECT * FROM offers WHERE id = $1 AND store_id = $2 AND is_active = TRUE',
      [offerId, storeId]
    );
    if (offerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Active offer not found' });
    }
    const offer = offerRes.rows[0];

    const custRes = await client.query(
      `SELECT id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at
       FROM customers
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [req.params.id, storeId]
    );
    if (custRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = custRes.rows[0];

    if (customer.points_balance < offer.points_required) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient points balance' });
    }

    const updatedCust = await client.query(
      `UPDATE customers
       SET points_balance = points_balance - $1
       WHERE id = $2
       RETURNING id, store_id, full_name, email, phone, TO_CHAR(birthday, 'YYYY-MM-DD') AS birthday, marketing_consent, points_balance, qr_token, wallet_url, created_at`,
      [offer.points_required, customer.id]
    );

    await client.query(
      `INSERT INTO point_transactions (store_id, customer_id, offer_id, tx_type, points_delta, note)
       VALUES ($1, $2, $3, 'REDEEM', $4, $5)`,
      [storeId, customer.id, offer.id, -offer.points_required, `Redeemed: ${offer.title}`]
    );

    await client.query('COMMIT');
    return res.json({ customer: updatedCust.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Redeem offer error:', err);
    return res.status(500).json({ error: 'Failed to redeem offer' });
  } finally {
    client.release();
  }
});

// 10. Resend Customer QR Pass to Email
router.post('/customers/:id/resend-qr', async (req, res) => {
  const storeId = getStoreId(req);
  try {
    const custRes = await db.query(
      `SELECT id, store_id, full_name, email, phone, qr_token, wallet_url, points_balance
       FROM customers
       WHERE id = $1 AND store_id = $2`,
      [req.params.id, storeId]
    );

    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = custRes.rows[0];
    if (!customer.email) {
      return res.status(400).json({ error: 'Customer has no email address' });
    }

    const qrDataUrl = await QRCode.toDataURL(customer.qr_token);
    const walletLink = customer.wallet_url || `${getAppBaseUrl(req)}/wallet/${customer.qr_token}`;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const base64Content = qrDataUrl.replace(/^data:image\/png;base64,/, '');

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: customer.email,
        subject: 'Your GastroWallet QR Pass',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Hello ${customer.full_name},</h2>
            <p>Here is your loyalty QR pass and token: <strong>${customer.qr_token}</strong></p>
            <p>Current balance: <strong>${customer.points_balance ?? 0} pts</strong></p>
            <p><img src="cid:gastrowallet-qr" alt="QR Code" width="200" height="200" /></p>
            <p><a href="${walletLink}">Open Wallet Pass</a></p>
          </div>
        `,
        attachments: [
          {
            filename: `${customer.qr_token}.png`,
            content: Buffer.from(base64Content, 'base64'),
            cid: 'gastrowallet-qr',
          },
        ],
      });

      return res.json({
        sent: true,
        email: customer.email,
        message: `QR pass sent to ${customer.email}`,
      });
    }

    return res.json({
      sent: true,
      simulated: true,
      email: customer.email,
      qrDataUrl,
      message: `QR pass prepared for ${customer.email} (configure SMTP_* in .env for live email delivery).`,
    });
  } catch (err) {
    console.error('Resend QR error:', err);
    return res.status(500).json({ error: 'Failed to resend QR code' });
  }
});

// 11. Delete Customer
router.delete('/customers/:id', async (req, res) => {
  const storeId = getStoreId(req);
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const custRes = await client.query(
      'SELECT id FROM customers WHERE id = $1 AND store_id = $2',
      [req.params.id, storeId]
    );

    if (custRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query(
      'DELETE FROM point_transactions WHERE customer_id = $1 AND store_id = $2',
      [req.params.id, storeId]
    );

    await client.query(
      'DELETE FROM customers WHERE id = $1 AND store_id = $2',
      [req.params.id, storeId]
    );

    await client.query('COMMIT');
    return res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete customer error:', err);
    return res.status(500).json({ error: 'Failed to delete customer' });
  } finally {
    client.release();
  }
});

module.exports = router;