const PaymentProvider = require("./PaymentProvider");
const config = require("../../config");

/**
 * Provedor de pagamento real: Mercado Pago.
 *
 * Implementa a mesma interface PaymentProvider. Em modo demo lança erro.
 * Em produção, cria preferências/ordens no Mercado Pago usando o token do .env.
 */
class MercadoPagoPaymentProvider extends PaymentProvider {
  _assertConfigured() {
    if (config.isDemo) {
      const err = new Error("Provedor Mercado Pago indisponível no modo demo.");
      err.status = 400;
      throw err;
    }
    if (!config.mercadopago.accessToken) {
      const err = new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
      err.status = 500;
      throw err;
    }
  }

  async createPayment() {
    this._assertConfigured();
    // TODO: criar pagamento via https://api.mercadopago.com/v1/payments
    // (PIX: QR code; cartão: processamento no MP; boleto: linha digitável).
    throw new Error("createPayment do Mercado Pago ainda não implementado.");
  }

  async getPayment() {
    this._assertConfigured();
    // TODO: GET /v1/payments/:id
    throw new Error("getPayment do Mercado Pago ainda não implementado.");
  }

  async cancelPayment() {
    this._assertConfigured();
    // TODO: PUT /v1/payments/:id { status: "cancelled" }
    throw new Error("cancelPayment do Mercado Pago ainda não implementado.");
  }

  async refundPayment() {
    this._assertConfigured();
    // TODO: POST /v1/payments/:id/refunds
    throw new Error("refundPayment do Mercado Pago ainda não implementado.");
  }
}

module.exports = new MercadoPagoPaymentProvider();
