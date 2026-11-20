-- Cria o banco isolado somma_vault caso você queira rodar separado,
-- ou cria as tabelas diretamente no banco atual do seu Postgres na Oracle.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS fin_piggybank (
    id_piggybank UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    composes_balance BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piggybank_user_id ON fin_piggybank(user_id);

CREATE TABLE IF NOT EXISTS fin_piggybank_transaction (
    id_transaction UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piggybank_id UUID NOT NULL REFERENCES fin_piggybank(id_piggybank) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piggybank_tx_piggy_id ON fin_piggybank_transaction(piggybank_id);
