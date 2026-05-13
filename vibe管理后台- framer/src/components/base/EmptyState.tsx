import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 mb-3">
        <i className={`${icon} text-gray-400 text-xl`} />
      </div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  );
}