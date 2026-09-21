import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/brand/BrandMark';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoOrientation = 'horizontal' | 'vertical';

interface LogoProps {
  size?: LogoSize;
  orientation?: LogoOrientation;
  showWordmark?: boolean;
  showMark?: boolean;
  className?: string;
}

const mark: Record<LogoSize, string> = {
  sm: 'w-8',
  md: 'w-12',
  lg: 'w-20',
};

const wordmark: Record<LogoSize, string> = {
  sm: 'text-[1.375rem]',
  md: 'text-[1.75rem]',
  lg: 'text-[2.75rem]',
};

const layout: Record<LogoOrientation, string> = {
  horizontal: 'flex-row gap-2',
  vertical: 'flex-col gap-3',
};

export function Logo({
  size = 'md',
  orientation = 'horizontal',
  showWordmark = true,
  showMark = false,
  className,
}: LogoProps) {
  return (
    <div className={cn('inline-flex items-center text-ink', layout[orientation], className)}>
      {showMark && <BrandMark className={mark[size]} />}
      {showWordmark ? (
        <span
          className={cn(
            'font-heading leading-none font-extrabold tracking-[-0.04em]',
            wordmark[size],
          )}
        >
          rekr<span className="text-brand">.</span>
        </span>
      ) : (
        <span className="sr-only">Rekr</span>
      )}
    </div>
  );
}
