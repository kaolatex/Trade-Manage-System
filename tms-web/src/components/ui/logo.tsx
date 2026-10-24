import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'orig';
  className?: string;
  priority?: boolean;
}

const FULL_SIZES = {
  xs: { width: 114, height: 22 },
  sm: { width: 145, height: 28 },
  md: { width: 186, height: 36 },
  lg: { width: 248, height: 48 },
  xl: { width: 310, height: 60 },
};

const MARK_SIZES = {
  xs: { width: 24, height: 18 },
  sm: { width: 32, height: 24 },
  md: { width: 44, height: 33 },
  lg: { width: 64, height: 48 },
  xl: { width: 88, height: 66 },
};

export function TmsLogo({
  size = 'sm',
  variant = 'full',
  className,
  priority = true,
}: LogoProps) {
  const isMark = variant === 'mark';
  const s = isMark ? MARK_SIZES[size] : FULL_SIZES[size];
  const src = isMark
    ? '/logo-mark.png'
    : variant === 'orig'
      ? '/logo-orig.png'
      : '/logo.png';

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center select-none transition-opacity duration-200 hover:opacity-90',
        className,
      )}
    >
      <Image
        src={src}
        alt="Trade Manage System"
        width={s.width}
        height={s.height}
        priority={priority}
        className="h-auto w-auto object-contain"
        style={{ maxHeight: s.height, maxWidth: s.width }}
      />
    </div>
  );
}
