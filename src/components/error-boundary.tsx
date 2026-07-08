"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console — production monitoring could be wired here
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="glass flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-crimson/15">
            <AlertTriangle className="h-6 w-6 text-crimson" />
          </div>
          <div>
            <h3 className="mb-1 text-base font-semibold text-white">Something went wrong</h3>
            <p className="mx-auto max-w-md text-sm text-slate-400">
              {this.state.error?.message ?? "An unexpected error occurred while rendering this view."}
            </p>
          </div>
          <Button
            onClick={this.handleReset}
            variant="outline"
            className="border-cobalt/30 bg-cobalt/10 text-cobalt hover:bg-cobalt/20"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
