import { Heart, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

interface FeedActionsProps {
  onPass: () => void;
  onLike: () => void;
  subject?: 'profil' | 'offre';
}

export function FeedActions({ onPass, onLike, subject = 'profil' }: FeedActionsProps) {
  const groupLabel = subject === 'offre' ? "Décision sur l'offre" : 'Décision sur le profil';

  return (
    <div role="group" aria-label={groupLabel} className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onPass}
        className={cn(buttonVariants({ variant: 'outline', size: 'xl' }), 'w-full')}
      >
        <X aria-hidden="true" />
        Passer
      </button>
      <button
        type="button"
        onClick={onLike}
        className={cn(buttonVariants({ variant: 'brand', size: 'xl' }), 'w-full')}
      >
        <Heart aria-hidden="true" />
        Ça m'intéresse
      </button>
    </div>
  );
}
