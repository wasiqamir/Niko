-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "reminderSentAt" DATETIME;

-- AlterTable
ALTER TABLE "MeetingLink" ADD COLUMN "reminderSentAt" DATETIME;
