import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/brand/BrandMark';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoOrientation = 'horizontal' | 'vertical';

interface LogoProps {
  size?: LogoSize;
  orientation?: LogoOrientation;
  showWordmark?: boolean;
  glow?: boolean;
  className?: string;
}

const mark: Record<LogoSize, string> = {
  sm: 'w-10',
  md: 'w-16',
  lg: 'w-24',
};

const wordmark: Record<LogoSize, string> = {
  sm: 'text-lg tracking-[0.14em]',
  md: 'text-2xl tracking-[0.16em]',
  lg: 'text-[2rem] tracking-[0.18em]',
};

const layout: Record<LogoOrientation, string> = {
  horizontal: 'flex-row gap-2.5',
  vertical: 'flex-col gap-4',
};

export function Logo({
  size = 'md',
  orientation = 'horizontal',
  showWordmark = true,
  glow = false,
  className,
}: LogoProps) {
  return (
    <div className={cn('inline-flex items-center', layout[orientation], className)}>
      <BrandMark
        className={cn(
          mark[size],
          glow && 'drop-shadow-[0_12px_26px_color-mix(in_srgb,var(--brand)_28%,transparent)]',
        )}
      />
      {showWordmark ? (
        <span className={cn('font-heading font-bold leading-none text-ink', wordmark[size])}>
          REKR
        </span>
      ) : (
        <span className="sr-only">Rekr</span>
      )}
    </div>
  );
}
