import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1080 1080"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
    >
      <path
        d="M794.06 759.245V318.663L857 354.629V723.279L794.06 759.245Z"
        fill="white"
        stroke="white"
        strokeWidth="3.59659"
      />
      <path
        d="M457.778 295.284L394.838 257.52L538.702 173L722.128 273.705V507.483H651.994V311.469L538.702 248.528L457.778 295.284Z"
        fill="#00DDB2"
        stroke="#00DCB2"
        strokeWidth="3.59659"
      />
      <path
        d="M362.469 642.356V570.424L722.128 575.819L718.531 802.404L545.895 906.705L362.469 802.404V696.305H430.804V762.841L545.895 827.58L655.591 762.841V642.356H362.469Z"
        fill="#00DDB2"
        stroke="#00DCB2"
        strokeWidth="3.59659"
      />
      <path
        d="M224 721.481L290.537 761.043V390.594L326.503 370.813L360.67 390.594V566.827H432.602V430.157L540.5 496.694L589.054 471.518V390.594L540.5 421.165L319.31 298.881L224 354.629V721.481Z"
        fill="white"
        stroke="white"
        strokeWidth="3.59659"
      />
    </svg>
  );
}

interface LogoWithTextProps {
  className?: string;
  logoSize?: number;
  textClassName?: string;
}

export function LogoWithText({ className, logoSize = 32, textClassName }: LogoWithTextProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Logo size={logoSize} />
      <span className={cn('text-lg font-bold', textClassName)}>Sentier</span>
    </div>
  );
}
