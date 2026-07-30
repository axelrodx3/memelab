import "./globals.css";
import { DM_Sans, Manrope } from "next/font/google";
import PresenceBeacon from "./components/PresenceBeacon";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

export const metadata = {
  title: "MemeLab — The internet's meme studio",
  description: "Discover iconic meme templates, remix them in seconds, and export without watermarks."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable}`}>
      <body><PresenceBeacon />{children}</body>
    </html>
  );
}
