import { cn } from '@/lib/utils';

interface CandidateAvatarProps {
  /** Full name: alternative text of the photo, and source of the fallback initial. */
  name: string;
  avatarUrl: string | null;
  /** Size — and, on the detail screen, elevation: the two screens frame it differently. */
  className: string;
}

/**
 * Falls back to the initial rather than to a placeholder image: an `img` with no
 * real photo behind it would still be announced as a picture of the candidate.
 */
export function CandidateAvatar({ name, avatarUrl, className }: CandidateAvatarProps) {
  // Normalised rather than compared to `null`: an empty string is a valid
  // `string | null`, and the API is free to send one.
  const src = avatarUrl?.trim() || null;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card',
        className,
      )}
    >
      {src === null ? (
        <span aria-hidden="true" className="font-heading text-4xl font-bold text-role">
          {name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img src={src} alt={name} className="size-full object-cover" />
      )}
    </span>
  );
}
