'use client';

import Link from 'next/link';

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-5 md:px-10 py-5 flex justify-between items-center bg-gray-50/85 backdrop-blur-md border-b border-black/5">
      <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
        <span className="text-primary">[</span>
        AGENTIOM
        <span className="text-primary">]</span>
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/login" className="text-gray-900 text-sm font-medium hover:text-primary transition-colors">
          Sign in
        </Link>
        <Link href="/signup" className="nav-button">
          Sign Up
        </Link>
      </div>
    </nav>
  );
}
