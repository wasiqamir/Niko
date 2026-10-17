import { cancelMeetingLink, declineAsHost } from "@/app/actions/meetings";
import { CopyLink } from "@/components/copy-link";
import { JoinMeeting } from "@/components/join-meeting";
import { SubmitButton } from "@/components/submit-button";
import { formatMeetingWhen } from "@/lib/time";

export type MeetingCard = {
  id: string;
  startAt: Date;
  endAt?: Date;
  tone: "scheduled" | "closed";
  kicker: string;
  title: string;
  detail?: string;
  note?: string;
  url?: string;
  callUrl?: string;
  guests?: { name: string; email: string }[];
  action?: "decline" | "cancel";
};

export function MeetingList({ meetings, empty }: { meetings: MeetingCard[]; empty: string }) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
        <p className="text-sm leading-6 text-muted">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {meetings.map((meeting) => (
        <li
          key={meeting.id}
          className={`rounded-2xl border px-4 py-4 ${
            meeting.tone === "scheduled" ? "border-line bg-background" : "border-line bg-line/40"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{meeting.kicker}</p>
          <p className="mt-1 font-medium">{formatMeetingWhen(meeting.startAt, meeting.endAt)}</p>
          <p className="mt-1 text-sm">{meeting.title}</p>
          {meeting.detail ? <p className="mt-1 text-sm text-muted">{meeting.detail}</p> : null}
          {meeting.note ? <p className="mt-2 text-sm text-clay">{meeting.note}</p> : null}
          {meeting.guests && meeting.guests.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {meeting.guests.map((guest) => (
                <li key={guest.email} className="text-sm text-muted">
                  {guest.name} · {guest.email}
                </li>
              ))}
            </ul>
          ) : null}
          {meeting.callUrl && meeting.endAt ? (
            <JoinMeeting href={meeting.callUrl} endsAt={meeting.endAt.toISOString()} />
          ) : null}
          {meeting.url ? <CopyLink url={meeting.url} /> : null}
          {meeting.action === "decline" ? (
            <form action={declineAsHost} className="mt-3">
              <input type="hidden" name="meetingId" value={meeting.id} />
              <SubmitButton variant="ghost" pendingLabel="Sending…">
                Not possible
              </SubmitButton>
            </form>
          ) : null}
          {meeting.action === "cancel" ? (
            <form action={cancelMeetingLink} className="mt-3">
              <input type="hidden" name="linkId" value={meeting.id} />
              <SubmitButton variant="ghost" pendingLabel="Cancelling…">
                Cancel meeting
              </SubmitButton>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
