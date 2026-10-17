import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { CandidateDrawer } from "@/features/candidates/candidate-drawer";
import { CandidateFormDialog } from "@/features/candidates/candidate-form-dialog";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Applicant Tracker", template: "%s · Applicant Tracker" },
  description: "Track candidates through hiring stages, search applicants and monitor hiring metrics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
          {/* Global overlays, driven by the UI store so any page can open them. */}
          <CandidateDrawer />
          <CandidateFormDialog />
        </Providers>
      </body>
    </html>
  );
}
