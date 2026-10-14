import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export const SITE_MAP_PATH = '/plan-du-site';

const LINKS = [
  { to: SITE_MAP_PATH, label: 'Plan du site' },
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
] as const;

/**
 * The same three links at the foot of every layout. The site map is the second
 * way through the site next to the menu (RGAA 12.1), and it has to be reached
 * the same way from every page (RGAA 12.4).
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('text-center text-xs text-ink-muted', className)}>
      <nav aria-label="Liens du site">
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="inline-flex min-h-11 items-center rounded-md underline underline-offset-2 hover:text-ink focus-visible:ring-3 focus-visible:ring-brand/70 focus-visible:outline-none"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
