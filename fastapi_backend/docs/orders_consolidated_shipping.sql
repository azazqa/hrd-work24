-- 합배송 기능: orders 테이블에 대표 주문 참조 컬럼 추가
-- 하위 주문은 대표 주문 id를 consolidated_to_order_id 에 저장한다.
-- 대표 주문은 NULL 로 둔다.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS consolidated_to_order_id UUID REFERENCES orders(id);

CREATE INDEX IF NOT EXISTS ix_orders_consolidated_to_order_id
    ON orders(consolidated_to_order_id);
