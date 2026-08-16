const pool = require("../config/db");

function generatePixCode(orderId, amount) {
  amount = Number(amount);
  const merchant = "BrasLaminas Comercio LTDA";
  const key = "pagamentos@braslaminas.com.br";
  const txid = `BL${orderId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const text =
    `00020126${pad(String(merchant.length).length * 0 + merchant.length)}${merchant}` +
    `0014BR.GOV.BCB.PIX0136${key}02${pad(txid.length)}${txid}520400005303986` +
    `540${amount.toFixed(2).replace(".", "").length}${amount.toFixed(2)}5802BR59` +
    `${pad(merchant.length)}${merchant}6009SAO PAULO62070503***6304A13F`;
  return { pix_code: text, qr_text: text };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function generateBoleto(orderId, amount, dueDays = 3) {
  amount = Number(amount);
  const due = new Date();
  due.setDate(due.getDate() + dueDays);
  const base = orderId.replace(/-/g, "").replace(/[^0-9]/g, "").padEnd(38, "7");
  const barcode = `34191.79001 01043.510047 91020.150041 ${base.slice(0, 11)} 7 7001000000000${Math.floor(
    amount
  )}`;
  return {
    barcode,
    due_date: due.toISOString().slice(0, 10),
    boleto_url: null,
  };
}

function generateCardAuthorization(orderId) {
  return `AUTH-${orderId.replace(/-/g, "").slice(0, 6).toUpperCase()}${Math.floor(
    100000 + Math.random() * 900000
  )}`;
}

function validateCard(card = {}) {
  const { number, holder, expiry, cvv } = card;
  if (!number || !holder || !expiry || !cvv) {
    return "Preencha os dados do cartão (número, titular, validade e CVV).";
  }
  if (!/^\d{16}$/.test(String(number).replace(/\s/g, ""))) {
    return "Número do cartão inválido.";
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(expiry))) {
    return "Validade inválida (use MM/AA).";
  }
  if (!/^\d{3,4}$/.test(String(cvv))) {
    return "CVV inválido.";
  }
  return null;
}

async function create(orderId, { method, amount, card }) {
  let status = "paid";
  let transactionCode = null;
  let details = null;
  let paidAt = new Date();

  if (method === "pix") {
    details = generatePixCode(orderId, amount);
    transactionCode = `PIX-${Date.now()}`;
  } else if (method === "credit_card") {
    const cardError = validateCard(card);
    if (cardError) {
      const err = new Error(cardError);
      err.status = 400;
      throw err;
    }
    details = {
      card_brand: "VISA",
      card_last4: String(card.number).replace(/\s/g, "").slice(-4),
      holder: card.holder,
    };
    transactionCode = generateCardAuthorization(orderId);
  } else if (method === "boleto") {
    status = "pending";
    paidAt = null;
    details = generateBoleto(orderId, amount);
    transactionCode = `BOL-${Date.now()}`;
  } else {
    const err = new Error("Método de pagamento inválido.");
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO payments (order_id, method, status, amount, transaction_code, details, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, order_id, method, status, amount, transaction_code, details, paid_at, created_at`,
    [orderId, method, status, amount, transactionCode, details, paidAt]
  );

  return rows[0];
}

async function findByOrder(orderId) {
  const { rows } = await pool.query(
    `SELECT id, order_id, method, status, amount, transaction_code, details, paid_at, created_at
     FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows[0];
}

async function listAll() {
  const { rows } = await pool.query(
    `SELECT id, order_id, method, status, amount, transaction_code, paid_at, created_at
     FROM payments ORDER BY created_at DESC`
  );
  return rows;
}

async function confirm(id) {
  const { rows } = await pool.query(
    `UPDATE payments
     SET status = 'paid', paid_at = COALESCE(paid_at, now())
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id]
  );
  return rows[0];
}

async function refund(id) {
  const { rows } = await pool.query(
    `UPDATE payments
     SET status = 'refunded'
     WHERE id = $1 AND status = 'paid'
     RETURNING *`,
    [id]
  );
  return rows[0];
}

module.exports = { create, findByOrder, listAll, confirm, refund };
