import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw } from "lucide-react";

type CostKey = "travelFare" | "stayCost" | "dailyAllowance" | "localTravelCost" | "miscCost";

export type CostField = {
  value: number;
  isManual: boolean;
};

export type CostState = Record<CostKey, CostField> & {
  totalEstimatedCost: number;
  currency: string;
};

type CostTableProps = {
  costs: CostState;
  onChange: (key: CostKey, value: number, isManual: boolean) => void;
};

const costLabels: Record<CostKey, string> = {
  travelFare: "Travel Fare",
  stayCost: "Stay Cost",
  dailyAllowance: "Daily Allowance",
  localTravelCost: "Local Travel",
  miscCost: "Miscellaneous",
};

const hints: Record<CostKey, string> = {
  travelFare: "Flight/Train/Bus fare",
  stayCost: "Hotel rate per night",
  dailyAllowance: "DA per day",
  localTravelCost: "Local travel per day",
  miscCost: "Spare parts / misc",
};

export function CostTable({ costs, onChange }: CostTableProps) {
  const handleValueChange = (key: CostKey, value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    onChange(key, numeric, true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Amount (₹)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(["travelFare", "stayCost", "dailyAllowance", "localTravelCost", "miscCost"] as CostKey[]).map(
              (key) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">{costLabels[key]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{hints[key]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        value={costs[key].value}
                        onChange={(e) => handleValueChange(key, e.target.value)}
                        type="number"
                        min={0}
                        className="w-32"
                      />
                      {costs[key].isManual && (
                        <Badge variant="outline" className="gap-1">
                          <Pencil className="h-3 w-3" />
                          Manual
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {costs[key].isManual ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => onChange(key, costs[key].value, false)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Auto
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Auto</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t pt-3 mt-3">
          <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
          <p className="text-lg font-semibold">
            ₹{costs.totalEstimatedCost.toLocaleString("en-IN")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

