const ShippingProvider = require("./ShippingProvider");
const trackingModel = require("../../models/tracking.model");
const orderModel = require("../../models/order.model");

function round2(value) {
  return Math.round(value * 100) / 100;
}

function estimateDistance(cep) {
  const digits = String(cep || "00000").replace(/\D/g, "").padStart(5, "0");
  const prefix = parseInt(digits.slice(0, 5), 10) || 0;
  return round2(((prefix % 90) + 10) * 4 + 30);
}

/**
 * Provedor de frete DEMO.
 *
 * Calcula frete de forma simulada (mas dinâmica) usando distância aproximada,
 * peso, quantidade e valor do pedido. O rastreamento é persistido no banco
 * local (a "API" do provider demo é o próprio banco).
 */
class DemoShippingProvider extends ShippingProvider {
  async calculateQuote({ cepDestino, items }) {
    const list = Array.isArray(items) ? items : [];
    const distance = estimateDistance(cepDestino);
    const totalWeight = list.reduce((sum, i) => sum + Number(i.weight || 0) * i.quantity, 0) || 0.1;
    const totalQuantity = list.reduce((sum, i) => sum + i.quantity, 0) || 1;
    const totalValue = list.reduce((sum, i) => sum + Number(i.price || 0) * i.quantity, 0);

    const base = (shipping) =>
      round2(
        shipping.fixed +
          totalWeight * shipping.weightRate +
          totalQuantity * shipping.quantityRate +
          totalValue * shipping.valueRate +
          distance * shipping.distanceRate
      );

    const pac = {
      id: "demo-pac",
      carrier: "Correios",
      service: "PAC",
      price: Math.max(12, base({ fixed: 6, weightRate: 4, quantityRate: 1.5, valueRate: 0.02, distanceRate: 0.015 })),
      delivery_days: 7 + Math.ceil(distance / 100),
    };

    const sedex = {
      id: "demo-sedex",
      carrier: "Correios",
      service: "SEDEX",
      price: Math.max(18, base({ fixed: 10, weightRate: 7, quantityRate: 2, valueRate: 0.03, distanceRate: 0.045 })),
      delivery_days: Math.min(4, 2 + Math.ceil(distance / 150)),
    };

    const economico = {
      id: "demo-economico",
      carrier: "Transportadora",
      service: "Econômico",
      price: Math.max(10, base({ fixed: 5, weightRate: 2.5, quantityRate: 1, valueRate: 0.01, distanceRate: 0.008 })),
      delivery_days: 9 + Math.ceil(distance / 80),
    };

    return [pac, sedex, economico];
  }

  async createShipment({ order, option }) {
    const suffix = String(Date.now()).slice(-6);
    const trackingCode = `BR-DEMO-${suffix}`;

    await orderModel.updateTracking(order.id, trackingCode);
    await orderModel.updateShippingStatus(order.id, "shipped");

    return {
      tracking_code: trackingCode,
      events: [
        { status: "posted", description: `Objeto postado (${option ? option.service : "envio"})` },
      ],
    };
  }

  async getTracking(trackingCode) {
    const events = await trackingModel.listByTrackingCode(trackingCode);
    if (!events.length) {
      const err = new Error("Código de rastreamento não encontrado.");
      err.status = 404;
      throw err;
    }
    return {
      tracking_code: trackingCode,
      status: events[events.length - 1].status,
      events: events.map((e) => ({
        status: e.status,
        description: e.description,
        date: new Date(e.event_date).toISOString(),
      })),
    };
  }

  async cancelShipment() {
    return { cancelled: true };
  }
}

module.exports = new DemoShippingProvider();
