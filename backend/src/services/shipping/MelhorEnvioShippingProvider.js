const ShippingProvider = require("./ShippingProvider");
const config = require("../../config");

/**
 * Provedor de frete real: Melhor Envio.
 *
 * Implementa a mesma interface ShippingProvider. Em modo demo lança erro
 * para deixar claro que o provider não está ativo. Em produção, chama a
 * API do Melhor Envio usando o token do .env.
 */
class MelhorEnvioShippingProvider extends ShippingProvider {
  _assertConfigured() {
    if (config.isDemo) {
      const err = new Error("Provedor Melhor Envio indisponível no modo demo.");
      err.status = 400;
      throw err;
    }
    if (!config.melhorEnvio.token) {
      const err = new Error("MELHOR_ENVIO_TOKEN não configurado.");
      err.status = 500;
      throw err;
    }
  }

  async calculateQuote({ cepDestino, items }) {
    this._assertConfigured();
    // TODO: chamar https://www.melhorenvio.com.br/api/v2/me/shipment/calculate
    // com { from: { postal_code }, to: { postal_code }, products: items }.
    throw new Error("calculateQuote do Melhor Envio ainda não implementado.");
  }

  async createShipment() {
    this._assertConfigured();
    // TODO: POST /api/v2/me/shipment/checkout + generate.
    throw new Error("createShipment do Melhor Envio ainda não implementado.");
  }

  async getTracking(trackingCode) {
    this._assertConfigured();
    // TODO: GET /api/v2/me/shipment/tracking com o código.
    throw new Error("getTracking do Melhor Envio ainda não implementado.");
  }

  async cancelShipment() {
    this._assertConfigured();
    // TODO: POST /api/v2/me/shipment/cancel.
    throw new Error("cancelShipment do Melhor Envio ainda não implementado.");
  }
}

module.exports = new MelhorEnvioShippingProvider();
