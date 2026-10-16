import { connection } from "next/server";
import { CALL_LIMIT, callMember, freshPeers } from "@/lib/call";
import { prisma } from "@/lib/prisma";

const KINDS = new Set(["offer", "answer", "ice"]);

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await context.params;
  const member = await callMember(code);
  if (!member) return Response.json({ error: "This call is closed." }, { status: 403 });

  const url = new URL(request.url);
  const peerId = url.searchParams.get("peerId") ?? "";
  const after = Number(url.searchParams.get("after") ?? "0");
  if (!peerId || peerId.length > 80) return Response.json({ error: "Missing peer." }, { status: 400 });

  const claimed = await prisma.callPresence.findUnique({
    where: { roomCode_peerId: { roomCode: code, peerId } },
  });
  if (claimed && claimed.userId !== member.user.id) {
    return Response.json({ error: "That seat is taken." }, { status: 409 });
  }

  const peers = await freshPeers(code);
  if (!claimed && peers.length >= CALL_LIMIT) {
    return Response.json({ error: "The live room is full." }, { status: 409 });
  }

  await prisma.callPresence.upsert({
    where: { roomCode_peerId: { roomCode: code, peerId } },
    create: {
      roomCode: code,
      peerId,
      userId: member.user.id,
      name: member.user.name,
      lastSeen: new Date(),
    },
    update: { lastSeen: new Date(), name: member.user.name },
  });

  const signals = await prisma.callSignal.findMany({
    where: {
      roomCode: code,
      id: { gt: Number.isInteger(after) ? after : 0 },
      toId: peerId,
      NOT: { fromId: peerId },
    },
    orderBy: { id: "asc" },
    take: 100,
  });

  const room = await freshPeers(code);
  return Response.json({
    peers: room.map((peer) => ({
      peerId: peer.peerId,
      name: peer.name,
      role: peer.userId === member.hostId ? "host" : "participant",
    })),
    signals: signals.map((signal) => ({
      id: signal.id,
      fromId: signal.fromId,
      kind: signal.kind,
      payload: signal.payload,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await context.params;
  const member = await callMember(code);
  if (!member) return Response.json({ error: "This call is closed." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    peerId?: string;
    toId?: string;
    kind?: string;
    payload?: string;
  } | null;
  const peerId = body?.peerId ?? "";
  if (!peerId || peerId.length > 80) return Response.json({ error: "Missing peer." }, { status: 400 });

  const presence = await prisma.callPresence.findUnique({
    where: { roomCode_peerId: { roomCode: code, peerId } },
  });
  if (presence && presence.userId !== member.user.id) {
    return Response.json({ error: "That seat is taken." }, { status: 409 });
  }

  if (body?.kind === "leave") {
    if (presence?.userId === member.user.id) {
      await prisma.callPresence.deleteMany({
        where: { roomCode: code, peerId, userId: member.user.id },
      });
    }
    return Response.json({ ok: true });
  }

  if (!presence || presence.userId !== member.user.id) {
    return Response.json({ error: "Join the room first." }, { status: 409 });
  }

  if (!body?.kind || !KINDS.has(body.kind) || !body.toId || typeof body.payload !== "string") {
    return Response.json({ error: "Incomplete signal." }, { status: 400 });
  }
  if (body.payload.length > 20_000 || body.toId.length > 80) {
    return Response.json({ error: "That signal is too large." }, { status: 400 });
  }

  await prisma.callSignal.create({
    data: {
      roomCode: code,
      fromId: peerId,
      toId: body.toId,
      kind: body.kind,
      payload: body.payload,
    },
  });
  await prisma.callSignal.deleteMany({
    where: { roomCode: code, createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
  });

  return Response.json({ ok: true });
}
