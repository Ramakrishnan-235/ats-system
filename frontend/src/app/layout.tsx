import type { Metadata } from "next";
import "./globals.css";
import { ApiSession } from "@/components/layout/api-session";

export const metadata: Metadata = {
  title: "ATS Core — AI-Powered Applicant Tracking System",
  description:
    "Enterprise-grade, privacy-first, AI-driven Applicant Tracking System with async ingestion, PII redaction, and deep LLM evaluations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans bg-[#f9f9ff] text-[#171c25]">
        <ApiSession>{children}</ApiSession>
      </body>
    </html>
  );
}
