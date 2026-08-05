import Image from 'next/image';
import { cn } from '@/lib/cn';
import { assetPath } from '@/lib/paths';
import { appName } from '@/lib/shared';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function Logo({ className, size = 24, showText = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-medium', className)}>
      <Image
        src={assetPath('/logo.png')}
        alt=""
        width={size}
        height={size}
        className="rounded-md"
        priority
      />
      {showText ? <span>{appName}</span> : null}
    </span>
  );
}
