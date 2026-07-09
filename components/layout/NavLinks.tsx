'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { navGroups, navIcons, computeActiveHref } from './navConfig';

interface NavLinksProps {
  userRole: 'dueño' | 'tendero';
  onNavigate?: () => void;
  className?: string;
}

export function NavLinks({ userRole, onNavigate, className }: NavLinksProps) {
  const pathname = usePathname();
  const visibleGroups = navGroups.filter(
    (group) => !group.ownerOnly || userRole === 'dueño'
  );
  const activeHref = computeActiveHref(
    pathname,
    visibleGroups.flatMap((g) => g.items)
  );

  return (
    <div className={className}>
      {visibleGroups.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          <p className="px-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                      isActive
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {navIcons[item.icon]}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
