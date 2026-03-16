import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const themeInitScript = `
(function() {
  try {
    var key = "assistant-theme";
    var stored = window.localStorage.getItem(key);
    var theme = stored === "dark" ? "dark" : "light";
    var root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark", "dark");
    if (theme === "dark") {
      root.classList.add("theme-dark", "dark");
    } else {
      root.classList.add("theme-light");
    }
  } catch (error) {
    document.documentElement.classList.add("theme-light");
  }
})();
`;

export const metadata: Metadata = {
  title: "AI Personal Student Assistant",
  description:
    "Chat + dashboard assistant for student tasks, events, and reminders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
