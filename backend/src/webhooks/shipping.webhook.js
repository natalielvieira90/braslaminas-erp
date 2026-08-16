const orderModel = require("../models/order.model");
const trackingModel = require("../models/tracking.model");
const shippingService = require("../services/shipping");

/**
 * Confirmação de envio/rastreamento (fonte única de verdade).
 * Tanto os webhooks reais quanto as simulações DEMO passam por aqui.
 */
async function handleShippingEvent(event = {}) {
  const { event: type, order_id, tracking_code, option } = event;

  const order = await orderModel.findById(order_id);
  if (!order) {
    const err = new Error("Pedido não encontrado.");
    err.status = 404;
    throw err;
  }

  switch (type) {
    case "shipment.created": {
      if (order.shipping_status !== "pending") {
        const err = new Error("Envio já gerado para este pedido.");
        err.status = 400;
        throw err;
      }
      await trackingModel.addEvent({
        orderId: order.id,
        status: "order_prepared",
        description: "Pedido preparado para envio",
      });
      await shippingService.createShipment(order, option || null);
      await orderModel.updateStatus(order.id, "shipped");
      break;
    }
    case "tracking.in_transit": {
      await trackingModel.addEvent({
        orderId: order.id,
        trackingCode: tracking_code,
        status: "in_transit",
        description: "Objeto em trânsito",
      });
      await orderModel.updateShippingStatus(order.id, "in_transit");
      await orderModel.updateStatus(order.id, "in_transit");
      break;
    }
    case "tracking.out_for_delivery": {
      await trackingModel.addEvent({
        orderId: order.id,
        trackingCode: tracking_code,
        status: "out_for_delivery",
        description: "Saiu para entrega",
      });
      await orderModel.updateShippingStatus(order.id, "out_for_delivery");
      await orderModel.updateStatus(order.id, "out_for_delivery");
      break;
    }
    case "tracking.delivered": {
      await trackingModel.addEvent({
        orderId: order.id,
        trackingCode: tracking_code,
        status: "delivered",
        description: "Objeto entregue",
      });
      await orderModel.updateShippingStatus(order.id, "delivered");
      await orderModel.updateStatus(order.id, "delivered");
      break;
    }
    default:
      const err = new Error(`Evento de envio desconhecido: ${type}`);
      err.status = 400;
      throw err;
  }

  return { order: await orderModel.findById(order.id) };
}

module.exports = { handleShippingEvent };
