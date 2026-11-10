-- Vendedores (User.role = VENDEDOR) e links de pagamento
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionType" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionValue" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sellerNotes" TEXT;

CREATE TABLE IF NOT EXISTS "PaymentLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "bookingData" JSONB NOT NULL,
    "customerData" JSONB NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "commissionType" TEXT,
    "commissionRate" DOUBLE PRECISION,
    "commissionAmount" DOUBLE PRECISION,
    "commissionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "commissionNotes" TEXT,
    "commissionPaidAt" TIMESTAMP(3),
    "resNumber" TEXT,
    "merchantOrderId" TEXT,
    "paymentMethod" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentLink_token_key" ON "PaymentLink"("token");
CREATE INDEX IF NOT EXISTS "PaymentLink_sellerId_idx" ON "PaymentLink"("sellerId");
CREATE INDEX IF NOT EXISTS "PaymentLink_status_idx" ON "PaymentLink"("status");
CREATE INDEX IF NOT EXISTS "PaymentLink_merchantOrderId_idx" ON "PaymentLink"("merchantOrderId");

DO $$ BEGIN
  ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

