/**
 * Interface ShippingProvider.
 *
 * Todo provedor de frete deve implementar estes métodos. O checkout não
 * conhece o provedor: ele chama sempre o ShippingService (services/shipping/index.js).
 *
 * Implementações:
 *  - DemoShippingProvider        (modo demo)
 *  - MelhorEnvioShippingProvider (produção)
 */
class ShippingProvider {
  /**
   * Calcula as opções de frete para um destino.
   * @param {object} params
   * @param {string} params.cepDestino - CEP de destino (somente dígitos).
   * @param {Array<{product_id, quantity, name, price, weight, height, width, length}>} params.items
   * @returns {Promise<Array<{id, carrier, service, price, delivery_days}>>}
   */
  async calculateQuote() {
    throw new Error("Método calculateQuote não implementado.");
  }

  /**
   * Gera um envio (pedido já pago) e retorna o código de rastreamento.
   * @param {object} params
   * @param {object} params.order - pedido (id, shipping_method, shipping_address, cep, total).
   * @param {object} params.option - opção de frete escolhida na cotação.
   * @returns {Promise<{tracking_code: string, events: Array<{status, description}>}>}
   */
  async createShipment() {
    throw new Error("Método createShipment não implementado.");
  }

  /**
   * Consulta o rastreamento de um envio.
   * @param {string} trackingCode
   * @returns {Promise<{tracking_code: string, status: string, events: Array<{status, description, date}>}>}
   */
  async getTracking() {
    throw new Error("Método getTracking não implementado.");
  }

  /**
   * Cancela um envio ainda não entregue.
   * @param {object} params
   * @returns {Promise<{cancelled: boolean}>}
   */
  async cancelShipment() {
    throw new Error("Método cancelShipment não implementado.");
  }
}

module.exports = ShippingProvider;
