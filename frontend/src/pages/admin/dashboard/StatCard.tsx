import { Link } from 'react-router-dom';

export interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
  to: string;
  sub: string;
  compact?: boolean;
}

export const StatCard = ({ label, value, icon: Icon, iconClass, to, sub, compact }: StatCardProps) =>
  compact ? (
    <Link
      to={to}
      className='relative bg-card rounded-xl shadow hover:shadow-md transition-shadow px-4 py-3 flex items-center gap-3'
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={15} />
      </span>
      <div className='min-w-0'>
        <p className='text-xl text-charcoal leading-none'>{value}</p>
        <p className='text-xs font-sans font-medium text-charcoal mt-1 truncate'>{label}</p>
      </div>
    </Link>
  ) : (
    <Link to={to} className='relative bg-card rounded-xl shadow hover:shadow-md transition-shadow p-5 block'>
      <span className={`absolute top-3 end-3 w-7 h-7 rounded-full flex items-center justify-center ${iconClass}`}>
        <Icon size={13} />
      </span>
      <p className='text-3xl  text-charcoal leading-none mb-1'>{value}</p>
      <p className='text-sm font-sans font-medium text-charcoal'>{label}</p>
      <p className='text-xs text-warm-gray mt-0.5'>{sub}</p>
    </Link>
  );
