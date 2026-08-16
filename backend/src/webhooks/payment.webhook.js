const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");
const trackingModel = require("../models/tracking.model");

/**
 * Confirmação de pagamento (fonte única de verdade).
 * Tanto os webhooks reais quanto as simulações DEMO passam por aqui.
 */
async function handlePaymentEvent(event = {}) {
  const { event: type, payment_id, order_id } = event;

  let payment = payment_id ? await paymentModel.findById(payment_id) : null;
  if (!payment && order_id) {
    payment = await paymentModel.findByOrder(order_id);
  }
  if (!payment) {
    const err = new Error("Pagamento não encontrado.");
    err.status = 404;
    throw err;
  }

  const order = await orderModel.findById(payment.order_id);
  if (!order) {
    const err = new Error("Pedido não encontrado.");
    err.status = 404;
    throw err;
  }

  switch (type) {
    case "payment.approved": {
      if (payment.status !== "pending") {
        const err = new Error("Pagamento não está pendente.");
        err.status = 400;
        throw err;
      }
      payment = await paymentModel.approve(payment.id);
      await orderModel.updatePaymentStatus(order.id, "approved");
      if (order.status === "pending") {
        await orderModel.updateStatus(order.id, "paid");
      }
      await trackingModel.addEvent({
        orderId: order.id,
        trackingCode: null,
        status: "payment_approved",
        description: "Pagamento aprovado",
      });
      break;
    }
    case "payment.rejected": {
      if (payment.status !== "pending") {
        const err = new Error("Pagamento não está pendente.");
        err.status = 400;
        throw err;
      }
      payment = await paymentModel.reject(payment.id);
      await orderModel.updatePaymentStatus(order.id, "rejected");
      if (order.status === "pending") {
        await orderModel.updateStatus(order.id, "cancelled");
      }
      break;
    }
    case "payment.cancelled": {
      if (payment.status !== "pending") {
        const err = new Error("Pagamento não está pendente.");
        err.status = 400;
        throw err;
      }
      payment = await paymentModel.cancel(payment.id);
      await orderModel.updatePaymentStatus(order.id, "rejected");
      if (order.status === "pending") {
        await orderModel.updateStatus(order.id, "cancelled");
      }
      break;
    }
    case "payment.refunded": {
      if (payment.status !== "approved") {
        const err = new Error("Pagamento não está aprovado para estorno.");
        err.status = 400;
        throw err;
      }
      payment = await paymentModel.refund(payment.id);
      await orderModel.updatePaymentStatus(order.id, "refunded");
      if (order.status === "paid") {
        await orderModel.updateStatus(order.id, "cancelled");
      }
      break;
    }
    default:
      const err = new Error(`Evento de pagamento desconhecido: ${type}`);
      err.status = 400;
      throw err;
  }

  return { payment, order: await orderModel.findById(order.id) };
}

module.exports = { handlePaymentEvent };
