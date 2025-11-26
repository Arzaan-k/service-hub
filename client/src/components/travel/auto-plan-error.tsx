import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

type AutoPlanErrorProps = {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
};

export function AutoPlanError({ message, onRetry, isRetrying }: AutoPlanErrorProps) {
  return (
    <Alert variant="destructive" className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <div>
          <AlertTitle>Auto Planner Failed</AlertTitle>
          <AlertDescription>
            {message || "Something went wrong while generating the travel plan. Please try again."}
          </AlertDescription>
        </div>
      </div>
      <Button onClick={onRetry} disabled={isRetrying} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {isRetrying ? "Retrying..." : "Retry Auto Plan"}
      </Button>
    </Alert>
  );
}

