-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('HOST', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MeetingLinkStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "hoursReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingLink" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "MeetingLinkStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingLinkGuest" (
    "id" TEXT NOT NULL,
    "meetingLinkId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingLinkGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallPresence" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSignal" (
    "id" SERIAL NOT NULL,
    "roomCode" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reminderSentAt" TIMESTAMP(3),
    "declineTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevMail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Availability_hostId_weekday_idx" ON "Availability"("hostId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingLink_code_key" ON "MeetingLink"("code");

-- CreateIndex
CREATE INDEX "MeetingLink_hostId_startAt_idx" ON "MeetingLink"("hostId", "startAt");

-- CreateIndex
CREATE INDEX "MeetingLinkGuest_participantId_idx" ON "MeetingLinkGuest"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingLinkGuest_meetingLinkId_participantId_key" ON "MeetingLinkGuest"("meetingLinkId", "participantId");

-- CreateIndex
CREATE INDEX "CallPresence_roomCode_lastSeen_idx" ON "CallPresence"("roomCode", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "CallPresence_roomCode_peerId_key" ON "CallPresence"("roomCode", "peerId");

-- CreateIndex
CREATE INDEX "CallSignal_roomCode_id_idx" ON "CallSignal"("roomCode", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_declineTokenHash_key" ON "Meeting"("declineTokenHash");

-- CreateIndex
CREATE INDEX "Meeting_hostId_startAt_idx" ON "Meeting"("hostId", "startAt");

-- CreateIndex
CREATE INDEX "Meeting_participantId_startAt_idx" ON "Meeting"("participantId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE INDEX "DevMail_userId_idx" ON "DevMail"("userId");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingLink" ADD CONSTRAINT "MeetingLink_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingLinkGuest" ADD CONSTRAINT "MeetingLinkGuest_meetingLinkId_fkey" FOREIGN KEY ("meetingLinkId") REFERENCES "MeetingLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingLinkGuest" ADD CONSTRAINT "MeetingLinkGuest_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevMail" ADD CONSTRAINT "DevMail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
