# 배송 테이블 DDL (발주 기능)

마이그레이션은 사용자가 직접 수행합니다. 아래 DDL은 참고용입니다.

## shipments

```sql
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
```

## shipment_items

```sql
CREATE TABLE shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL
);

CREATE INDEX ix_shipment_items_shipment_id ON shipment_items(shipment_id);
```

## 흐름 요약

1. 주문 목록에서 "발주하기" 클릭 → 선택된(현재 페이지의) **ORDER** 상태 주문 ID로 `POST /orders/place-order` 호출.
2. 백엔드: 해당 주문들의 `status`를 **ORDER_PLACED**로 변경하고, 주문당 1건씩 **shipments** 행 생성, **shipment_items**는 해당 주문의 **order_items**를 복사해 생성.
3. 이후 확장: 묶음배송(수취인 동일 시 합침), 카테고리별 최대 수량 분리 등은 동일 API 내 로직 확장으로 구현 가능.
