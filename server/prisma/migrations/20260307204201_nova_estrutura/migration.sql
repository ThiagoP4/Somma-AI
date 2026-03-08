-- CreateTable
CREATE TABLE "usr_profile" (
    "idProfile" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usr_profile_pkey" PRIMARY KEY ("idProfile")
);

-- CreateTable
CREATE TABLE "fin_category" (
    "idCategory" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "fin_category_pkey" PRIMARY KEY ("idCategory")
);

-- CreateTable
CREATE TABLE "fin_purchase" (
    "idPurchase" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "obsId" INTEGER,

    CONSTRAINT "fin_purchase_pkey" PRIMARY KEY ("idPurchase")
);

-- CreateTable
CREATE TABLE "fin_observation_types" (
    "idObservation" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "fin_observation_types_pkey" PRIMARY KEY ("idObservation")
);

-- CreateTable
CREATE TABLE "fin_income" (
    "idIncome" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP NOT NULL,
    "user_id" UUID NOT NULL,
    "categoryId" INTEGER,
    "obsId" INTEGER,

    CONSTRAINT "fin_income_pkey" PRIMARY KEY ("idIncome")
);

-- AddForeignKey
ALTER TABLE "fin_purchase" ADD CONSTRAINT "fin_purchase_obsId_fkey" FOREIGN KEY ("obsId") REFERENCES "fin_observation_types"("idObservation") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_purchase" ADD CONSTRAINT "fin_purchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fin_category"("idCategory") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_income" ADD CONSTRAINT "fin_income_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fin_category"("idCategory") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_income" ADD CONSTRAINT "fin_income_obsId_fkey" FOREIGN KEY ("obsId") REFERENCES "fin_observation_types"("idObservation") ON DELETE SET NULL ON UPDATE CASCADE;
