'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/', icon: '>', label: 'Dashboard' },
  { href: '/agents', icon: '[]', label: 'Agents' },
  { href: '/logs', icon: '#', label: 'Logs' },
  { href: '/settings', icon: '*', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <Link href="/" className="font-mono text-lg font-bold text-gray-900">
          [AGENTIOM]
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${
                isActive
                  ? 'active'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-primary font-bold w-5">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center text-xs font-bold">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.email || 'Guest'}</p>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
