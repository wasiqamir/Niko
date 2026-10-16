import { TextField } from "@/components/text-field";

export function HostSearchForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  return (
    <form action="/book" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField
          label="Host email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          placeholder="david@gmail.com"
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background"
      >
        Show schedule
      </button>
    </form>
  );
}
