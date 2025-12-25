'use client';

import Link from 'next/link';

const links = [
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: 'https://github.com/agentiom', label: 'GitHub' },
  { href: 'https://twitter.com/agentiom', label: 'Twitter' },
];

export function Footer() {
  return (
    <footer className="px-10 py-10 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10 bg-gray-50/90">
      <span className="font-mono text-sm font-semibold text-gray-500">
        [AGENTIOM]
      </span>
      <div className="flex gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-gray-500 text-sm hover:text-primary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
