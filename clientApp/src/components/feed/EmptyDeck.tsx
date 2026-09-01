import { Link } from 'react-router';
import { Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

interface EmptyDeckProps {
  title: string;
  itemPlural: string;
  likedCount: number;
  likedLabel: (count: number) => string;
}

/**
 * The end of the deck.
 *
 * One state, not two: the deck is shaped server-side by the candidate's own
 * profile, so an empty screen no longer distinguishes « filtered out » from
 * « all seen » — nothing on this page narrowed anything. The way to widen it is
 * to edit the preferences, hence the link rather than a reset button.
 */
export const EmptyDeck = ({ title, itemPlural, likedCount, likedLabel }: EmptyDeckProps) => (
  <section className="flex flex-col items-center gap-8 px-6 py-12 text-center">
    <span className="flex size-30 items-center justify-center rounded-full bg-role/10 text-role">
      <Sparkles className="size-10" aria-hidden="true" />
    </span>

    <div className="flex flex-col items-center gap-3">
      <h2 className="font-heading text-2xl font-bold text-ink">{title}</h2>

      <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
        {`Revenez plus tard, la liste des ${itemPlural} se met à jour chaque jour. Vos critères de recherche se règlent depuis votre profil.`}
      </p>
    </div>

    <Link
      to="/profil"
      className={cn(buttonVariants({ variant: 'role', size: 'xl' }), 'w-full max-w-xs')}
    >
      Ajuster mes critères
    </Link>

    <p className="text-sm text-ink-muted">{likedLabel(likedCount)}</p>
  </section>
);
