-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "catatan_pengurus" TEXT;

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "loan_decisions" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "decision" VARCHAR(30) NOT NULL,
    "note" TEXT,
    "aktor" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renteng_events" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "event" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "period" INTEGER NOT NULL DEFAULT 0,
    "tx_hash" VARCHAR(66),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renteng_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_decisions_loan_id_idx" ON "loan_decisions"("loan_id");

-- CreateIndex
CREATE INDEX "renteng_events_member_id_idx" ON "renteng_events"("member_id");

-- AddForeignKey
ALTER TABLE "loan_decisions" ADD CONSTRAINT "loan_decisions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renteng_events" ADD CONSTRAINT "renteng_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
