-- DropIndex
DROP INDEX "Availability_hostId_weekday_key";

-- CreateTable
CREATE TABLE "MeetingLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingLink_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingLinkGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingLinkId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingLinkGuest_meetingLinkId_fkey" FOREIGN KEY ("meetingLinkId") REFERENCES "MeetingLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingLinkGuest_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "hoursReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountType", "createdAt", "email", "emailVerifiedAt", "id", "name", "passwordHash", "updatedAt") SELECT "accountType", "createdAt", "email", "emailVerifiedAt", "id", "name", "passwordHash", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MeetingLink_code_key" ON "MeetingLink"("code");

-- CreateIndex
CREATE INDEX "MeetingLink_hostId_startAt_idx" ON "MeetingLink"("hostId", "startAt");

-- CreateIndex
CREATE INDEX "MeetingLinkGuest_participantId_idx" ON "MeetingLinkGuest"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingLinkGuest_meetingLinkId_participantId_key" ON "MeetingLinkGuest"("meetingLinkId", "participantId");

-- CreateIndex
CREATE INDEX "Availability_hostId_weekday_idx" ON "Availability"("hostId", "weekday");

-- Hosts who already saved open hours should keep them instead of receiving the default week again.
UPDATE "User" SET "hoursReady" = 1 WHERE "id" IN (SELECT DISTINCT "hostId" FROM "Availability");
