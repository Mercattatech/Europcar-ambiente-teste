-- Permite que links de compartilhamento sejam gerados por usuários comuns sem vínculo com vendedor (sellerId NULL)
ALTER TABLE "PaymentLink" ALTER COLUMN "sellerId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "PaymentLink" DROP CONSTRAINT IF EXISTS "PaymentLink_sellerId_fkey";
  ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END $$;

