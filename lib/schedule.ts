import "server-only";

import { prisma } from "@/lib/prisma";
import { dateKeyFromParts, slotStart, weekdayOfKey, zonedParts } from "@/lib/time";

export const DEFAULT_START_HOUR = 9;
export const DEFAULT_END_HOUR = 21;

export type OpenWindow = {
  weekday: number;
  startHour: number;
  endHour: number;
};

const DEFAULT_WINDOWS: OpenWindow[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startHour: DEFAULT_START_HOUR,
  endHour: DEFAULT_END_HOUR,
}));

export async function getOpenHours(hostId: string): Promise<OpenWindow[]> {
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    select: {
      hoursReady: true,
      availability: { orderBy: [{ weekday: "asc" }, { startHour: "asc" }] },
    },
  });
  if (!host) return [];

  if (host.hoursReady || host.availability.length > 0) {
    return host.availability.map((row) => ({
      weekday: row.weekday,
      startHour: row.startHour,
      endHour: row.endHour,
    }));
  }

  await prisma.$transaction([
    prisma.availability.createMany({
      data: DEFAULT_WINDOWS.map((window) => ({ hostId, ...window })),
    }),
    prisma.user.update({ where: { id: hostId }, data: { hoursReady: true } }),
  ]);

  return DEFAULT_WINDOWS;
}

export async function busyBlocks(hostId: string, dayStart: Date, dayEnd: Date) {
  const [meetings, links, teamMeetings] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        hostId,
        status: "SCHEDULED",
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
    }),
    prisma.meetingLink.findMany({
      where: {
        hostId,
        status: "SCHEDULED",
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
    }),
    prisma.teamMeeting.findMany({
      where: {
        status: "SCHEDULED",
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        team: {
          OR: [{ ownerId: hostId }, { members: { some: { userId: hostId, status: "ACTIVE" } } }],
        },
      },
    }),
  ]);

  return [...meetings, ...links, ...teamMeetings];
}

function hoursOnDate(start: Date, end: Date, dateKey: string) {
  const hours: number[] = [];
  for (let time = start.getTime(); time < end.getTime(); time += 60 * 60 * 1000) {
    const parts = zonedParts(new Date(time));
    if (dateKeyFromParts(parts.year, parts.month, parts.day) === dateKey) hours.push(parts.hour);
  }
  return hours;
}

export async function slotsForDay(hostId: string, dateKey: string, now = new Date()) {
  const windows = await getOpenHours(hostId);
  const weekday = weekdayOfKey(dateKey);
  const dayStart = slotStart(dateKey, 0);
  const dayEnd = slotStart(dateKey, 24);
  const blocks = await busyBlocks(hostId, dayStart, dayEnd);

  const hours = new Set<number>();
  for (const window of windows.filter((item) => item.weekday === weekday)) {
    for (let hour = window.startHour; hour < window.endHour; hour += 1) hours.add(hour);
  }
  for (const block of blocks) {
    for (const hour of hoursOnDate(block.startAt, block.endAt, dateKey)) hours.add(hour);
  }

  return [...hours]
    .sort((a, b) => a - b)
    .map((hour) => {
      const start = slotStart(dateKey, hour);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const booked = blocks.some((block) => block.startAt < end && block.endAt > start);
      return {
        start,
        end,
        hour,
        booked,
        past: end.getTime() <= now.getTime(),
      };
    })
    .filter((slot) => !slot.past);
}

export async function hoursForHost(hostId: string, dateKey: string, now = new Date()) {
  const dayStart = slotStart(dateKey, 0);
  const dayEnd = slotStart(dateKey, 24);
  const blocks = await busyBlocks(hostId, dayStart, dayEnd);

  return Array.from({ length: 14 }, (_, index) => index + 7).map((hour) => {
    const start = slotStart(dateKey, hour);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      start,
      end,
      hour,
      booked: blocks.some((block) => block.startAt < end && block.endAt > start),
      past: end.getTime() <= now.getTime(),
    };
  });
}

export function slotFitsOpenHours(windows: OpenWindow[], start: Date) {
  const parts = zonedParts(start);
  if (parts.minute !== 0) return false;
  return windows.some(
    (window) =>
      window.weekday === parts.weekday &&
      parts.hour >= window.startHour &&
      parts.hour < window.endHour,
  );
}
