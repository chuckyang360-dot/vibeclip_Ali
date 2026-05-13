interface BadgeProps {
  label: string;
  variant?: "green" | "blue" | "red" | "yellow" | "orange" | "gray" | "indigo";
  size?: "sm" | "md";
}

const variantStyles: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  gray: "bg-gray-100 text-gray-600 border-gray-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export default function Badge({ label, variant = "gray", size = "sm" }: BadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${variantStyles[variant]}`}>
      {label}
    </span>
  );
}