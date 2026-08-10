const variants = {
  primary:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",

  secondary:
    "bg-slate-100 text-slate-700 hover:bg-slate-200",

  danger:
    "bg-red-500 text-white shadow-sm hover:bg-red-600",

  warning:
    "bg-amber-400 text-slate-900 shadow-sm hover:bg-amber-500",
};

const Button = ({ children, variant = "primary", onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-none
        px-5
        py-4
        text-base
        font-semibold
        transition-all
        duration-200
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-emerald-500
        focus-visible:ring-offset-2
        ${variants[variant]}
      `}
    >
      {children}
    </button>
  );
};

export default Button;