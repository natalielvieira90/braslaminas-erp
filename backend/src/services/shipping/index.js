const config = require("../../config");
const trackingModel = require("../../models/tracking.model");

const providers = {
  demo: require("./DemoShippingProvider"),
  melhorenvio: require("./MelhorEnvioShippingProvider"),
};

const provider = providers[config.shippingProvider] || providers.demo;

/**
 * ShippingService.
 *
 * Única porta de entrada para frete no checkout. O checkout NÃO sabe qual
 * provedor está ativo: trocar SHIPPING_PROVIDER no .env é suficiente.
 */
class ShippingService {
  constructor(activeProvider) {
    this.provider = activeProvider;
  }

  async calculateQuote(cepDestino, items) {
    const options = await this.provider.calculateQuote({ cepDestino, items });
    if (!Array.isArray(options)) {
      throw new Error("Provedor de frete retornou formato inválido.");
    }
    return options;
  }

  async findOption(cepDestino, items, optionId) {
    const options = await this.calculateQuote(cepDestino, items);
    const option = options.find((o) => o.id === optionId);
    if (!option) {
      const err = new Error("Opção de frete inválida. Refaça a cotação.");
      err.status = 400;
      throw err;
    }
    return option;
  }

  async createShipment(order, option) {
    const result = await this.provider.createShipment({ order, option });
    if (!result || !result.tracking_code) {
      throw new Error("Provedor de frete não retornou código de rastreamento.");
    }
    for (const event of result.events || []) {
      await trackingModel.addEvent({
        orderId: order.id,
        trackingCode: result.tracking_code,
        status: event.status,
        description: event.description,
      });
    }
    return result;
  }

  async getTracking(trackingCode) {
    return this.provider.getTracking(trackingCode);
  }

  async cancelShipment(order) {
    return this.provider.cancelShipment({ order });
  }
}

module.exports = new ShippingService(provider);
