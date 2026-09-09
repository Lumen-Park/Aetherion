import React from 'react';

export function LoadingState({ label = 'Loading workspace data…' }) {
  return <div className="panel flex min-h-44 flex-col items-center justify-center gap-4 p-8" role="status" aria-live="polite"><span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200" /><p className="text-sm font-semibold text-slate-300">{label}</p></div>;
}

export function ErrorState({ message = 'We could not load this information.', onRetry }) {
  return <div className="panel min-h-44 p-7" role="alert"><p className="eyebrow text-rose-200">Connection issue</p><h2 className="mt-2 text-xl font-bold text-white">Your workspace is still safe.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">{message}</p>{onRetry && <button className="btn-secondary mt-5" onClick={onRetry}>Try again</button>}</div>;
}
