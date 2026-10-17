import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CallRoom } from "@/components/call-room";
import { loadBookedCall } from "@/lib/booked-call";

export const metadata = {
  title: "Live room",
};

export default function BookedCallPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#10241c]" />}>
      <Room params={props.params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const room = await loadBookedCall(id);
  if (!room.ok) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 text-foreground">
        <h1 className="font-serif text-4xl tracking-tight">
          {room.message === "This meeting has ended." ? "Meeting is ended" : "The call is closed"}
        </h1>
        <p className="mt-3 text-muted">{room.message}</p>
        <Link href="/home" className="mt-6 text-sm font-medium underline underline-offset-4">
          Back to your meetings
        </Link>
      </div>
    );
  }

  return (
    <CallRoom
      code={id}
      title={room.title}
      name={room.name}
      role={room.role}
      startsAt={room.startsAt}
      endsAt={room.endsAt}
      open={Date.parse(room.startsAt) <= Date.now()}
      leaveHref="/home"
    />
  );
}
