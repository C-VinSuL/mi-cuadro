const variants = {
  primary:
    "bg-emerald-600 hover:bg-emerald-700 text-white",

  secondary:
    "bg-slate-200 hover:bg-slate-300 text-slate-700",

  danger:
    "bg-red-500 hover:bg-red-600 text-white",

  warning:
    "bg-yellow-400 hover:bg-yellow-500 text-black",
};

const Button = ({
  children,
  variant = "primary",
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        px-5
        py-3
        rounded-xl
        font-semibold
        transition-all
        duration-200
        ${variants[variant]}
      `}
    >
      {children}
    </button>
  );
};

export default Button;