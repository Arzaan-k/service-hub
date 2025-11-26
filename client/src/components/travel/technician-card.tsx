import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, AlertTriangle } from "lucide-react";

type TechnicianSuggestion = {
  id: string;
  name: string;
  score: number;
  available: boolean;
  reasons: string[];
};

type TechnicianCardProps = {
  technician: { id: string; name?: string; grade?: string; baseLocation?: string } | null;
  suggestions: TechnicianSuggestion[];
  selectedTechnicianId: string | null;
  onTechnicianChange: (id: string | null) => void;
  technicianSourceCity?: string;
};

export function TechnicianCard({
  technician,
  suggestions,
  selectedTechnicianId,
  onTechnicianChange,
  technicianSourceCity,
}: TechnicianCardProps) {
  const activeTechnician = suggestions.find((s) => s.id === selectedTechnicianId) || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Technician Suggestion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Assigned Technician</Label>
            <Select
              value={selectedTechnicianId || ""}
              onValueChange={(value) => onTechnicianChange(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {suggestions.map((suggestion) => (
                  <SelectItem
                    key={suggestion.id}
                    value={suggestion.id}
                    disabled={!suggestion.available}
                  >
                    {suggestion.name} {suggestion.available ? "" : "(Unavailable)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {technicianSourceCity && (
              <p className="text-xs text-muted-foreground">
                Origin city: {technicianSourceCity}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Auto Planner Score</Label>
            {activeTechnician ? (
              <div className="flex items-center gap-2">
                <Badge className="text-sm">
                  {activeTechnician.score.toFixed(0)} pts
                </Badge>
                {!activeTechnician.available && (
                  <Badge variant="destructive">Has overlap</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No technician selected</p>
            )}
          </div>
        </div>

        {!technician && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No suitable technician found</AlertTitle>
            <AlertDescription>
              The auto planner could not find a perfect match. Please pick a technician manually above.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label>Why this technician?</Label>
          {activeTechnician ? (
            <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2 space-y-1">
              {activeTechnician.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Select a technician to view matching reasons.
            </p>
          )}
        </div>

        <div>
          <Label>Other suggestions</Label>
          <ScrollArea className="h-32 mt-2 border rounded-md p-3">
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No technician suggestions available.</p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{suggestion.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Score {suggestion.score.toFixed(0)} • {suggestion.available ? "Available" : "Not available"}
                      </p>
                    </div>
                    <Badge variant={suggestion.available ? "default" : "secondary"}>
                      {suggestion.available ? "Available" : "Busy"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

