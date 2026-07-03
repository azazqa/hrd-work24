-- 주문(orders) · 발주(shipments) 테이블 초기화 SQL
-- 1) 데이터만 비우기 (TRUNCATE)
-- 2) 테이블 삭제 후 재생성 (DROP + CREATE)

-- ----------------------------------------
-- 1) 데이터만 비우기 (TRUNCATE)
-- FK 순서: shipment_items → shipments, order_items → orders
-- ----------------------------------------
TRUNCATE TABLE shipment_items, shipments, order_items, orders
  RESTART IDENTITY
  CASCADE;


-- ----------------------------------------
-- 2) 테이블 삭제 후 재생성 (DROP + CREATE)
-- 실행 전 위 TRUNCATE 는 사용하지 말 것.
-- ----------------------------------------
-- DROP (자식 → 부모)
DROP TABLE IF EXISTS shipment_items;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;

-- orders (Base 상속: created_at, updated_at, is_delete)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiver_id UUID NOT NULL REFERENCES receivers(id) UNIQUE,
    channel_id UUID REFERENCES channels(id),
    mall_product_name VARCHAR,
    price NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    memo VARCHAR,
    order_date TIMESTAMP NOT NULL DEFAULT now(),
    invoice_number VARCHAR,
    update_user_id UUID NOT NULL REFERENCES "user"(id),
    status VARCHAR NOT NULL DEFAULT 'order' CHECK (status IN ('order', 'order_placed', 'shipping')),
    order_placed_date TIMESTAMP,
    shipping_date TIMESTAMP,
    raw JSONB,
    consolidated_to_order_id UUID REFERENCES orders(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    is_delete BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX ix_orders_receiver_id ON orders(receiver_id);
CREATE INDEX ix_orders_channel_id ON orders(channel_id);
CREATE INDEX ix_orders_consolidated_to_order_id ON orders(consolidated_to_order_id);

-- order_items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL
);

CREATE INDEX ix_order_items_order_id ON order_items(order_id);
CREATE INDEX ix_order_items_product_id ON order_items(product_id);

-- shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    invoice_number VARCHAR,
    shipping_date TIMESTAMP NOT NULL DEFAULT now(),
    receiver_id UUID NOT NULL REFERENCES receivers(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    is_delete BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX ix_shipments_order_id ON shipments(order_id);
CREATE INDEX ix_shipments_receiver_id ON shipments(receiver_id);

-- shipment_items
CREATE TABLE shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL
);

CREATE INDEX ix_shipment_items_shipment_id ON shipment_items(shipment_id);
