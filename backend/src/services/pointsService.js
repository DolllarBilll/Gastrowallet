const pool = require('../config/db');

async function adjustCustomerPoints({
  storeId,
  customerId,
  type,
  pointsAmount,
  offerId = null,
  note = null,
}) {
  if (!Number.isInteger(pointsAmount) || pointsAmount <= 0) {
    throw new Error('Points amount must be a positive integer');
  }

  if (!['EARN', 'REDEEM'].includes(type)) {
    throw new Error('Invalid transaction type');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the customer row to prevent concurrent balance race conditions
    const customerRes = await client.query(
      `SELECT id, points_balance
       FROM customers
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [customerId, storeId]
    );

    if (customerRes.rowCount === 0) {
      throw new Error('Customer not found for this store');
    }

    const currentBalance = customerRes.rows[0].points_balance;
    const pointsDelta = type === 'EARN' ? pointsAmount : -pointsAmount;
    const nextBalance = currentBalance + pointsDelta;

    if (nextBalance < 0) {
      throw new Error('Insufficient points balance');
    }

    const updatedCustomerRes = await client.query(
      `UPDATE customers
       SET points_balance = $1
       WHERE id = $2 AND store_id = $3
       RETURNING id, store_id, full_name, email, qr_token, points_balance`,
      [nextBalance, customerId, storeId]
    );

    const txRes = await client.query(
      `INSERT INTO point_transactions
        (store_id, customer_id, offer_id, tx_type, points_delta, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [storeId, customerId, offerId, type, pointsDelta, note]
    );

    await client.query('COMMIT');

    return {
      customer: updatedCustomerRes.rows[0],
      transaction: txRes.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { adjustCustomerPoints };