import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

type CreateTripButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};

export function CreateTripButton({ onClick, disabled, isLoading }: CreateTripButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="w-full md:w-auto gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating Trip…
        </>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Create Trip & Auto-Assign Tasks
        </>
      )}
    </Button>
  );
}

