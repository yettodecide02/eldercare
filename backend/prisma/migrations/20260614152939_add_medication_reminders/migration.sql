-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('DAILY', 'TWICE_DAILY', 'THREE_TIMES_DAILY', 'WEEKLY', 'AS_NEEDED');

-- CreateTable
CREATE TABLE "MedicationReminder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" "ReminderFrequency" NOT NULL DEFAULT 'DAILY',
    "times" TEXT[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationReminder_customerId_idx" ON "MedicationReminder"("customerId");

-- CreateIndex
CREATE INDEX "MedicationReminder_elderId_idx" ON "MedicationReminder"("elderId");

-- CreateIndex
CREATE INDEX "MedicationReminder_isActive_idx" ON "MedicationReminder"("isActive");

-- AddForeignKey
ALTER TABLE "MedicationReminder" ADD CONSTRAINT "MedicationReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationReminder" ADD CONSTRAINT "MedicationReminder_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "ElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
