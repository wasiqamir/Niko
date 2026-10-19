import { AuthFrame } from "@/components/auth-frame";
import { TeamSignupForm } from "@/components/team-signup-form";

export const metadata = {
  title: "Create a team",
};

export default function TeamsPage() {
  return (
    <AuthFrame
      mode="teams"
      title="Create a team account."
      subtitle="Add the people by name and email. The team opens after you confirm your own email. Niko then emails everyone else to join and set the hours they can meet."
      alternate={{ href: "/login", label: "Log in" }}
    >
      <TeamSignupForm />
    </AuthFrame>
  );
}
