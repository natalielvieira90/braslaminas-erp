/**
 * Interface PaymentProvider.
 *
 * Todo provedor de pagamento deve implementar estes métodos. O checkout NÃO
 * conhece o provedor: chama sempre o PaymentService (services/payment/index.js).
 *
 * Implementações:
 *  - DemoPaymentProvider            (modo demo)
 *  - MercadoPagoPaymentProvider     (produção)
 */
class PaymentProvider {
  /**
   * Cria um pagamento pendente para um pedido.
   * @param {object} params
   * @param {object} params.order - pedido (id, total).
   * @param {string} params.method - pix | credit_card | boleto.
   * @param {object} [params.card] - dados do cartão (somente validação; não armazenar).
   * @returns {Promise<object>} pagamento (status pending).
   */
  async createPayment() {
    throw new Error("Método createPayment não implementado.");
  }

  /**
   * Consulta um pagamento pelo id interno.
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  async getPayment() {
    throw new Error("Método getPayment não implementado.");
  }

  /**
   * Cancela um pagamento pendente.
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  async cancelPayment() {
    throw new Error("Método cancelPayment não implementado.");
  }

  /**
   * Estorna um pagamento aprovado.
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  async refundPayment() {
    throw new Error("Método refundPayment não implementado.");
  }
}

module.exports = PaymentProvider;
