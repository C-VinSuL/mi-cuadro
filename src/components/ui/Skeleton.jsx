const Skeleton = ({ className = "", ...props }) => (
  <div
    aria-hidden="true"
    className={`skeleton-shimmer rounded-xl bg-slate-200/80 ${className}`}
    {...props}
  />
);

export default Skeleton;
