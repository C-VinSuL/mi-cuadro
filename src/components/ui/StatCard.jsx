import { ArrowUpRight } from "lucide-react";
import BentoCard from "./BentoCard";

const StatCard = ({
  title,
  value,
  variation,
  icon: Icon,
  className = ""
}) => (
  <BentoCard className={`flex min-h-40 flex-col p-5 sm:p-6 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flash-mist text-flash-deep">
          <Icon size={20} aria-hidden="true" />
        </span>
      )}
    </div>
    <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
      {value}
    </p>
    {variation && (
      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-flash-emerald">
        <ArrowUpRight size={15} aria-hidden="true" />
        <span>{variation}</span>
      </p>
    )}
  </BentoCard>
);

export default StatCard;
