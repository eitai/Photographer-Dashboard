import { Link } from 'react-router-dom';

export interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
  to: string;
  sub: string;
}

export const StatCard = ({ label, value, icon: Icon, iconClass, to, sub }: StatCardProps) => (
  <Link to={to} className='relative bg-card rounded-xl border border-beige p-5 hover:shadow-sm transition-shadow block'>
    <span className={`absolute top-3 end-3 w-7 h-7 rounded-full flex items-center justify-center ${iconClass}`}>
      <Icon size={13} />
    </span>
    <p className='text-3xl  text-charcoal leading-none mb-1'>{value}</p>
    <p className='text-sm font-sans font-medium text-charcoal'>{label}</p>
    <p className='text-xs text-warm-gray mt-0.5'>{sub}</p>
  </Link>
);
