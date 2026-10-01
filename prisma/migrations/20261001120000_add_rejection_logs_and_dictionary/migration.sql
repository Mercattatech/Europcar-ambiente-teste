-- CreateTable
CREATE TABLE IF NOT EXISTS "transaction_rejection_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" VARCHAR(150),
    "attempt_number" INTEGER,
    "customer_name" VARCHAR(255),
    "customer_email" VARCHAR(255),
    "customer_phone" VARCHAR(50),
    "reservation_id" VARCHAR(100),
    "cielo_payment_id" VARCHAR(100),
    "cielo_merchant_order_id" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" VARCHAR(50),
    "provider" VARCHAR(50) NOT NULL,
    "card_brand" VARCHAR(50),
    "rejection_category" VARCHAR(80) NOT NULL,
    "rejection_type" VARCHAR(30),
    "can_retry" BOOLEAN,
    "return_code_raw" VARCHAR(100),
    "return_code_normalized" VARCHAR(50),
    "return_message" TEXT,
    "dictionary_message" TEXT,
    "customer_message" TEXT,
    "customer_friendly_message" TEXT,
    "friendly_explanation" TEXT,
    "recommended_action" TEXT,
    "action_status" TEXT,
    "responsibility" VARCHAR(120),
    "root_cause" TEXT,
    "ai_behavior_instruction" TEXT,
    "retry_policy_text" VARCHAR(50),
    "mapping_status" VARCHAR(30) DEFAULT 'MAPPED',
    "mapping_confidence" DECIMAL(5,2),
    "http_status" INTEGER,
    "source_endpoint" VARCHAR(255),
    "raw_payload" JSONB,
    "fingerprint" VARCHAR(255),

    CONSTRAINT "transaction_rejection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "rejection_code_dictionary" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(50) DEFAULT 'Cielo',
    "card_brand" VARCHAR(50) NOT NULL,
    "code_display" VARCHAR(100) NOT NULL,
    "code_normalized" VARCHAR(50),
    "aliases" JSONB,
    "rejection_type" VARCHAR(30),
    "technical_message" TEXT,
    "customer_message" TEXT,
    "rejection_category" VARCHAR(80),
    "friendly_explanation" TEXT,
    "recommended_action" TEXT,
    "action_status" TEXT,
    "responsibility" VARCHAR(120),
    "root_cause" TEXT,
    "ai_behavior_instruction" TEXT,
    "customer_friendly_message" TEXT,
    "retry_policy_text" VARCHAR(50),
    "active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejection_code_dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_rejection_logs_event_id_key" ON "transaction_rejection_logs"("event_id");
CREATE INDEX IF NOT EXISTS "idx_trl_created_at" ON "transaction_rejection_logs"("created_at");
CREATE INDEX IF NOT EXISTS "idx_trl_provider" ON "transaction_rejection_logs"("provider");
CREATE INDEX IF NOT EXISTS "idx_trl_brand_code" ON "transaction_rejection_logs"("card_brand", "return_code_normalized");
CREATE INDEX IF NOT EXISTS "idx_trl_category" ON "transaction_rejection_logs"("rejection_category");
CREATE INDEX IF NOT EXISTS "idx_trl_order" ON "transaction_rejection_logs"("cielo_merchant_order_id");
CREATE INDEX IF NOT EXISTS "idx_trl_payment" ON "transaction_rejection_logs"("cielo_payment_id");
CREATE INDEX IF NOT EXISTS "idx_rcd_brand_code" ON "rejection_code_dictionary"("card_brand", "code_normalized");
