import { Link } from "react-router-dom";

const variants = {
  primary: "bg-flash-forest text-white hover:bg-flash-deep",
  light: "bg-white text-flash-forest hover:bg-flash-mist"
};

const PillButton = ({
  children,
  to,
  type = "button",
  variant = "primary",
  className = "",
  ...props
}) => {
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-emerald focus-visible:ring-offset-2 ${variants[variant] || variants.primary} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
};

export default PillButton;
