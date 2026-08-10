const Card = ({ children, className = "" }) => {
  return (
    <div
      className={`
        rounded-none
        border
        border-slate-200/90
        bg-white
        p-7
        shadow-sm
        transition-all
        duration-200
        sm:p-8
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;