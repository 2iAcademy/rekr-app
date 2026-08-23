import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type AvatarBannerSize = 'md' | 'lg';

const BANNER: Record<AvatarBannerSize, string> = {
  md: 'h-[8.4375rem] shrink-0 sm:h-[11.25rem]',
  lg: 'relative h-52 pt-12',
};

const MEDIA: Record<AvatarBannerSize, string> = {
  md: 'size-[5.625rem] bg-card',
  lg: 'size-24 bg-white shadow-md',
};

const INITIAL: Record<AvatarBannerSize, string> = {
  md: 'text-4xl text-role',
  lg: 'text-3xl text-brand',
};

interface AvatarBannerProps extends ComponentProps<'div'> {
  name: string;
  imageUrl: string | null;
  size?: AvatarBannerSize;
}

/**
 * The gradient band with a round avatar that both the candidate card and the
 * offer detail open on.
 *
 * The initial is `aria-hidden`: the name is always spelled out by the heading
 * right below, and a lone letter read aloud is noise. The URL is normalised
 * rather than compared to `null`, because an empty string is a valid
 * `string | null` and the API is free to send one.
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
      className={cn('flex items-center justify-center bg-role-gradient', BANNER[size], className)}
      {...props}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          MEDIA[size],
        )}
      >
        {source === null ? (
          <span aria-hidden="true" className={cn('font-heading font-bold', INITIAL[size])}>
            {name.trim().charAt(0).toUpperCase()}
          </span>
        ) : (
          <img src={source} alt={name} className="size-full object-cover" />
        )}
      </span>
    </div>
  );
}
