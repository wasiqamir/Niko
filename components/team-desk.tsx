import { resendTeamInvite } from "@/app/actions/teams";
import { ArrangeTeamForm } from "@/components/arrange-team-form";
import { JoinMeeting } from "@/components/join-meeting";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { formatMeetingWhen } from "@/lib/time";

export type TeamDeskMember = {
  id: string;
  name: string;
  email: string;
  role: "Creator" | "Member";
  state: string;
  canResend: boolean;
};

export type TeamDeskMeeting = {
  id: string;
  startAt: Date;
  endAt: Date;
};

export function TeamDesk({
  name,
  owner,
  members,
  meetings,
  notice,
}: {
  name: string;
  owner: boolean;
  members: TeamDeskMember[];
  meetings: TeamDeskMeeting[];
  notice?: string;
}) {
  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.22em] text-accent">Team</p>
      <h2 className="mt-2 font-serif text-4xl tracking-tight">{name}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        {owner
          ? "When everyone has joined and set their hours, arrange today's meeting. Niko picks a time that fits the whole team."
          : "Set your hours below. The team creator arranges today's meeting from everyone's schedule."}
      </p>

      {notice === "team" ? (
        <div className="mt-4">
          <Notice tone="info">Today&apos;s meeting is set. Everyone has the time by email.</Notice>
        </div>
      ) : null}
      {notice === "team-mail" ? (
        <div className="mt-4">
          <Notice tone="error">
            The meeting is on the team schedule, but one or more emails could not be sent.
          </Notice>
        </div>
      ) : null}
      {notice === "invite" ? (
        <div className="mt-4">
          <Notice tone="info">The invite was sent again.</Notice>
        </div>
      ) : null}
      {notice === "invite-mail" || notice === "invite-wait" ? (
        <div className="mt-4">
          <Notice tone="error">
            {notice === "invite-wait"
              ? "Wait a minute before sending that invite again."
              : "That invite email could not be sent."}
          </Notice>
        </div>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted">
                {member.email} · {member.role}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{member.state}</span>
              {member.canResend ? (
                <form action={resendTeamInvite}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <SubmitButton variant="ghost" pendingLabel="Sending…" fullWidth={false}>
                    Send invite again
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {owner ? <ArrangeTeamForm /> : null}

      {meetings.length > 0 ? (
        <div className="mt-8">
          <h3 className="font-serif text-2xl tracking-tight">Team meetings</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="rounded-2xl border border-line bg-background px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Team meeting</p>
                <p className="mt-1 font-medium">{formatMeetingWhen(meeting.startAt, meeting.endAt)}</p>
                <JoinMeeting href={`/teams/meetings/${meeting.id}`} endsAt={meeting.endAt.toISOString()} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-muted">
        While a team meeting is on the calendar, nobody else can book that hour with anyone on the team.
      </p>
    </section>
  );
}
