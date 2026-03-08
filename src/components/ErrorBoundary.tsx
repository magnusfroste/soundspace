import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { compact, fallbackMessage } = this.props;

    if (compact) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          <span className="truncate">{fallbackMessage ?? "Something went wrong"}</span>
          <button onClick={this.handleRetry} className="underline hover:text-foreground ml-auto flex-shrink-0">
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {fallbackMessage ?? "Something went wrong"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            An unexpected error occurred. Try again or reload the page.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
        {this.state.error && (
          <pre className="mt-4 max-w-lg text-[10px] text-muted-foreground/60 overflow-auto whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
