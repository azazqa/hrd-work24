-- 정산(settlements) · 정산 이력(settlement_histories) 테이블 생성 SQL
-- NOTE:
-- - Base 상속 컬럼: created_at, updated_at, is_delete
-- - 본 SQL은 운영 환경에 맞게 schema/권한/인덱스 전략을 조정해서 사용하세요.

-- settlements
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    order_price NUMERIC(12, 2) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    state VARCHAR NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','settled','completed','reject','cancelled')),
    settled_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    update_user_id UUID NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    is_delete BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_settlements_order_id ON settlements(order_id);
CREATE INDEX IF NOT EXISTS ix_settlements_state ON settlements(state);
CREATE INDEX IF NOT EXISTS ix_settlements_state_created_at ON settlements(state, created_at);

-- settlement_histories (only insert)
CREATE TABLE IF NOT EXISTS settlement_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES settlements(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    action_type VARCHAR NOT NULL CHECK (action_type IN ('created','price_updated','state_changed','cancelled_by_order')),
    update_user_id UUID NOT NULL REFERENCES "user"(id),
    reason VARCHAR(500),
    from_state VARCHAR CHECK (from_state IN ('pending','settled','completed','reject','cancelled')),
    to_state VARCHAR CHECK (to_state IN ('pending','settled','completed','reject','cancelled')),
    before_price NUMERIC(12, 2),
    after_price NUMERIC(12, 2),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    is_delete BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_settlement_histories_settlement_id ON settlement_histories(settlement_id);
CREATE INDEX IF NOT EXISTS ix_settlement_histories_order_id ON settlement_histories(order_id);
CREATE INDEX IF NOT EXISTS ix_settlement_histories_update_user_id ON settlement_histories(update_user_id);

