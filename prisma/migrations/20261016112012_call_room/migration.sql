-- CreateTable
CREATE TABLE "CallPresence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CallSignal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomCode" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CallPresence_roomCode_lastSeen_idx" ON "CallPresence"("roomCode", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "CallPresence_roomCode_peerId_key" ON "CallPresence"("roomCode", "peerId");

-- CreateIndex
CREATE INDEX "CallSignal_roomCode_id_idx" ON "CallSignal"("roomCode", "id");
