-- =====================================================
-- BrasLâminas - Migração 005
-- Frete, pagamento, dimensões de produto e rastreamento
-- =====================================================

-- Dimensões e peso dos produtos (usados na cotação de frete)
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(8,3) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC(8,2) NOT NULL DEFAULT 0;

-- Pedidos: totais e frete
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cep VARCHAR(9);

-- Novos status de pedido: preparando, em trânsito, saiu para entrega
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','paid','preparing','shipped','in_transit','out_for_delivery','delivered','cancelled'));

-- Migra status antigos de pagamento antes de aplicar as novas restrições
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
UPDATE orders SET payment_status = 'approved' WHERE payment_status = 'paid';
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending','approved','rejected','refunded'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
UPDATE payments SET status = 'approved' WHERE status = 'paid';
UPDATE payments SET status = 'rejected' WHERE status = 'failed';
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled','refunded'));

-- Timeline de rastreamento (um pedido pode ter várias etapas)
CREATE TABLE IF NOT EXISTS tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tracking_code VARCHAR(60),
    status VARCHAR(40) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_order ON tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_code ON tracking_events(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON orders(shipping_status);
