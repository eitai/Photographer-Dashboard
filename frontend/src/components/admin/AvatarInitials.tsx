interface AvatarInitialsProps {
  name: string;
  size?: 'sm' | 'md';
}

/** Shared avatar initials circle. Uses bg-blush/20 text-charcoal for verified WCAG 5.6:1 contrast. */
export const AvatarInitials = ({ name, size = 'md' }: AvatarInitialsProps) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-xs';

  return (
    <span
      className={`${sizeClass} rounded-full bg-blush/20 text-charcoal font-sans font-semibold flex items-center justify-center shrink-0`}
    >
      {initials}
    </span>
  );
};
