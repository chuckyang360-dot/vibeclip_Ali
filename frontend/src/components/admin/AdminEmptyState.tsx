export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-8 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
        <i className="ri-inbox-line text-xl text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description ? <p className="mt-2 text-xs text-gray-500">{description}</p> : null}
    </div>
  );
}
