import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type AvatarBannerSize = 'md' | 'lg';

const MEDIA: Record<AvatarBannerSize, string> = {
  md: 'size-14',
  lg: 'size-20',
};

const INITIAL: Record<AvatarBannerSize, string> = {
  md: 'text-xl',
  lg: 'text-3xl',
};

interface AvatarBannerProps extends ComponentProps<'div'> {
  name: string;
  imageUrl: string | null;
  size?: AvatarBannerSize;
}

/**
 * The round avatar a detail header opens on — a logo, or the initial on the
 * brand tint, the same treatment as the feed card's avatar. No band behind it:
 * the header card it sits in is the frame.
 *
 * The initial is `aria-hidden`: the name is always spelled out right next to
 * it, and a lone letter read aloud is noise. The URL is normalised rather than
 * compared to `null`, because an empty string is a valid `string | null` and
 * the API is free to send one.
 */
export function AvatarBanner({
  name,
  imageUrl,
  size = 'md',
  className,
  ...props
}: AvatarBannerProps) {
  const source = imageUrl?.trim() || null;

  return (
    <div
      data-slot="avatar-banner"
      className={cn('flex shrink-0 items-center justify-center', className)}
      {...props}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint',
          MEDIA[size],
        )}
      >
        {source === null ? (
          <span aria-hidden="true" className={cn('font-extrabold text-brand-strong', INITIAL[size])}>
            {name.trim().charAt(0).toUpperCase()}
          </span>
        ) : (
          <img src={source} alt={name} className="size-full object-cover" />
        )}
      </span>
    </div>
  );
}
