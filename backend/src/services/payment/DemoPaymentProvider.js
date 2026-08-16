const PaymentProvider = require("./PaymentProvider");
const paymentModel = require("../../models/payment.model");

function pad(n) {
  return String(n).padStart(2, "0");
}

function generatePixCode(orderId, amount) {
  amount = Number(amount);
  const merchant = "BrasLaminas Comercio LTDA";
  const key = "pagamentos@braslaminas.com.br";
  const txid = `BL${String(orderId).replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const text =
    `00020126${pad(String(merchant.length).length * 0 + merchant.length)}${merchant}` +
    `0014BR.GOV.BCB.PIX0136${key}02${pad(txid.length)}${txid}520400005303986` +
    `540${amount.toFixed(2).replace(".", "").length}${amount.toFixed(2)}5802BR59` +
    `${pad(merchant.length)}${merchant}6009SAO PAULO62070503***6304A13F`;
  return { pix_code: text, qr_text: text };
}

function generateBoleto(orderId, amount, dueDays = 3) {
  amount = Number(amount);
  const due = new Date();
  due.setDate(due.getDate() + dueDays);
  const base = String(orderId).replace(/-/g, "").replace(/[^0-9]/g, "").padEnd(38, "7");
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
  return `AUTH-${String(orderId).replace(/-/g, "").slice(0, 6).toUpperCase()}${Math.floor(
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

/**
 * Provedor de pagamento DEMO.
 *
 * Simula PIX, cartão e boleto sem movimentação financeira real.
 * O pagamento sempre nasce "pending" e a aprovação/recusa acontece por
 * eventos (webhook/simulação) processados no backend — nunca confiando no
 * frontend para confirmar valores ou status.
 */
class DemoPaymentProvider extends PaymentProvider {
  async createPayment({ order, method, card }) {
    let transactionCode;
    let details;

    if (method === "pix") {
      details = generatePixCode(order.id, order.total);
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
      transactionCode = generateCardAuthorization(order.id);
    } else if (method === "boleto") {
      details = generateBoleto(order.id, order.total);
      transactionCode = `BOL-${Date.now()}`;
    } else {
      const err = new Error("Método de pagamento inválido.");
      err.status = 400;
      throw err;
    }

    return paymentModel.create({
      orderId: order.id,
      method,
      amount: order.total,
      status: "pending",
      transactionCode,
      details,
      paidAt: null,
    });
  }

  async getPayment(paymentId) {
    return paymentModel.findById(paymentId);
  }

  async cancelPayment(paymentId) {
    return paymentModel.cancel(paymentId);
  }

  async refundPayment(paymentId) {
    return paymentModel.refund(paymentId);
  }
}

module.exports = new DemoPaymentProvider();
