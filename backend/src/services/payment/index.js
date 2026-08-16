const config = require("../../config");

const providers = {
  demo: require("./DemoPaymentProvider"),
  mercadopago: require("./MercadoPagoPaymentProvider"),
};

const provider = providers[config.paymentProvider] || providers.demo;

/**
 * PaymentService.
 *
 * Única porta de entrada para pagamento no checkout. O checkout NÃO sabe
 * qual provedor está ativo: trocar PAYMENT_PROVIDER no .env é suficiente.
 */
class PaymentService {
  constructor(activeProvider) {
    this.provider = activeProvider;
  }

  createPayment(params) {
    return this.provider.createPayment(params);
  }

  getPayment(paymentId) {
    return this.provider.getPayment(paymentId);
  }

  cancelPayment(paymentId) {
    return this.provider.cancelPayment(paymentId);
  }

  refundPayment(paymentId) {
    return this.provider.refundPayment(paymentId);
  }
}

module.exports = new PaymentService(provider);
