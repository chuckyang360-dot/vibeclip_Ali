export function AdminErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-950/20 px-6 py-5 text-sm text-red-200">
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/30"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
