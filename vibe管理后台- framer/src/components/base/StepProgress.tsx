interface StepProgressProps {
  steps: {
    step: string;
    label: string;
    status: "completed" | "processing" | "error" | "not_started";
    updatedAt?: string;
    error?: string;
  }[];
}

export default function StepProgress({ steps }: StepProgressProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <i className="ri-check-line text-white text-xs" />;
      case "processing":
        return <i className="ri-loader-4-line text-white text-xs animate-spin" />;
      case "error":
        return <i className="ri-error-warning-line text-white text-xs" />;
      default:
        return <span className="text-xs text-gray-400 font-medium">{steps.find((s) => s.status === status)?.step.replace("S", "")}</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-500";
      case "processing": return "bg-indigo-500";
      case "error": return "bg-rose-500";
      default: return "bg-gray-200";
    }
  };

  const getLineColor = (index: number) => {
    if (index >= steps.length - 1) return "";
    const current = steps[index];
    const next = steps[index + 1];
    if (current.status === "completed" && next.status !== "not_started") return "bg-emerald-500";
    if (current.status === "completed" && next.status === "not_started") return "bg-gray-200";
    return "bg-gray-200";
  };

  return (
    <div className="flex items-start gap-0">
      {steps.map((step, index) => (
        <div key={step.step} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={`w-7 h-7 flex items-center justify-center rounded-full ${getStatusColor(step.status)}`}
            >
              {getStatusIcon(step.status)}
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1.5 whitespace-nowrap">
              {step.label}
            </span>
            {step.updatedAt && (
              <span className="text-xs text-gray-400 mt-0.5">{step.updatedAt}</span>
            )}
            {step.error && (
              <span className="text-xs text-rose-500 mt-0.5 max-w-[100px] truncate" title={step.error}>
                {step.error}
              </span>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 mt-3.5 rounded-full ${getLineColor(index)}`} />
          )}
        </div>
      ))}
    </div>
  );
}