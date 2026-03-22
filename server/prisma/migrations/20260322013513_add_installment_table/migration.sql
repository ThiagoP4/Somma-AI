-- DropForeignKey
ALTER TABLE "fin_purchase" DROP CONSTRAINT "fin_purchase_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "fin_purchase" DROP CONSTRAINT "fin_purchase_obsId_fkey";

-- CreateTable
CREATE TABLE "fin_installment" (
    "idInstallment" SERIAL NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMPTZ NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fin_installment_pkey" PRIMARY KEY ("idInstallment")
);

-- CreateTable
CREATE TABLE "opt_subscription" (
    "idSubscription" SERIAL NOT NULL,
    "plan_name" TEXT NOT NULL,
    "monthly_price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" UUID NOT NULL,

    CONSTRAINT "opt_subscription_pkey" PRIMARY KEY ("idSubscription")
);

-- AddForeignKey
ALTER TABLE "fin_purchase" ADD CONSTRAINT "fin_purchase_obsId_fkey" FOREIGN KEY ("obsId") REFERENCES "fin_observation_types"("idObservation") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_purchase" ADD CONSTRAINT "fin_purchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fin_category"("idCategory") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_installment" ADD CONSTRAINT "fin_installment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "fin_purchase"("idPurchase") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opt_subscription" ADD CONSTRAINT "opt_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usr_profile"("idProfile") ON DELETE CASCADE ON UPDATE CASCADE;
