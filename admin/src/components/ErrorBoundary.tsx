import React from 'react';

/**
 * Catches render crashes so a bug shows a message instead of a white page.
 *
 * This is not theoretical: a single undefined dereference in one homepage
 * section took the entire storefront blank, and the only signal was a console
 * error nobody was watching. A customer would have seen nothing at all.
 */
interface Props {
  children: React.ReactNode;
  /** Where the crash happened, for the log line. */
  area: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Reported, not swallowed. Wired to a reporter in one place so switching
    // providers later does not mean touching every boundary.
    reportCrash(this.props.area, error, info.componentStack ?? undefined);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-[50vh] grid place-items-center px-4 py-16 text-center"
      >
        <div className="max-w-md">
          <h2 className="text-xl font-semibold text-[#483828]">
            Something went wrong on this page
          </h2>
          <p className="text-sm text-[#483828]/75 mt-2">
            Your data is safe — nothing was saved. Reloading usually fixes it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 px-6 bg-[#87380F] hover:bg-[#6d2d0c] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
            >
              Reload
            </button>
            <a
              href="/"
              className="min-h-11 inline-flex items-center px-6 border border-[#EBD9BC] hover:bg-[#F3E7D0]/40 text-[#483828] rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Crash reporting, deliberately vendor-agnostic.
 *
 * Logs to the console always, and forwards to Sentry only if it has been
 * loaded. No SDK is bundled — that is a decision to make when there is an
 * account, not a dependency to carry now.
 */
export function reportCrash(area: string, error: Error, componentStack?: string) {
  // eslint-disable-next-line no-console
  console.error(`[crash:${area}]`, error, componentStack);

  const sentry = (window as { Sentry?: { captureException: (e: Error, c?: unknown) => void } }).Sentry;
  sentry?.captureException(error, { tags: { area }, extra: { componentStack } });
}
