const SectionPageTitle = ({
  icon: Icon,
  eyebrow,
  title,
  description,
  plain = false
}) => (
  <div className={`min-w-0 ${plain ? "" : "rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6 md:p-8"}`}>
    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
      {Icon && <Icon size={17} />}
      {eyebrow}
    </p>
    <h1 className="mt-1 text-3xl font-bold text-slate-900">
      {title}
    </h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
      {description}
    </p>
  </div>
);

export default SectionPageTitle;
