import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Niko",
    template: "%s · Niko",
  },
  description:
    "Niko is a meeting app with two free accounts: one for hosting client meetings, and one for joining them. Both start with email verification.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="relative flex min-h-full flex-col">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="orb absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
          <div className="orb absolute -right-20 top-1/4 h-[22rem] w-[22rem] rounded-full bg-gold/30 blur-3xl [animation-delay:-7s]" />
          <div className="orb absolute bottom-[-8rem] left-1/3 h-[18rem] w-[18rem] rounded-full bg-clay/15 blur-3xl [animation-delay:-12s]" />
        </div>
        {children}
      </body>
    </html>
  );
}
