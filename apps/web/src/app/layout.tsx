import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agentiom | Deploy Stateful AI Agents',
  description: 'Create and deploy stateful AI agents in one command. Persistent storage. Zero cold starts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
