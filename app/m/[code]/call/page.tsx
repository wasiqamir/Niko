import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CallRoom } from "@/components/call-room";
import { loadCallRoom } from "@/lib/call";

export const metadata = {
  title: "Live room",
};

export default function CallPage(props: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#10241c]" />}>
      <Room params={props.params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const room = await loadCallRoom(code);
  if (!room.ok) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 text-foreground">
        <h1 className="font-serif text-4xl tracking-tight">The call is closed</h1>
        <p className="mt-3 text-muted">{room.message}</p>
        <Link href={`/m/${code}`} className="mt-6 text-sm font-medium underline underline-offset-4">
          Back to the meeting
        </Link>
      </div>
    );
  }

  return (
    <CallRoom
      code={code}
      title={room.title}
      name={room.name}
      startsAt={room.startsAt}
      open={Date.parse(room.startsAt) <= Date.now()}
    />
  );
}
