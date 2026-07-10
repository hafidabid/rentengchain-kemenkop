-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "onchain_registered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "onchain_loan_id" BIGINT,
ADD COLUMN     "tx_hash" VARCHAR(66);

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "onchain_registered" BOOLEAN NOT NULL DEFAULT false;
