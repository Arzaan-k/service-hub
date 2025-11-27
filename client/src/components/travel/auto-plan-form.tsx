import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plane, Sparkles } from "lucide-react";

export type AutoPlanFormPayload = {
  destinationCity: string;
  startDate: string;
  endDate: string;
  technicianId?: string;
};

type CityOption = { name: string };

type AutoPlanFormProps = {
  destinations: CityOption[] | string[];
  technicians: Array<{ id: string; name?: string; employeeCode?: string }>;
  onSubmit: (payload: AutoPlanFormPayload) => void;
  isLoading?: boolean;
};

const FALLBACK_CITIES: CityOption[] = [
  { name: "Chennai" },
  { name: "Mumbai" },
  { name: "Delhi" },
  { name: "Bengaluru" },
  { name: "Hyderabad" },
  { name: "Pune" },
  { name: "Kolkata" },
];

export function AutoPlanForm({
  destinations,
  technicians,
  onSubmit,
  isLoading,
}: AutoPlanFormProps) {
  // Normalize destinations to CityOption format
  const cities = useMemo(() => {
    const normalized: CityOption[] = (destinations || []).map(d => 
      typeof d === 'string' ? { name: d } : d
    );
    const merged = new Map<string, CityOption>();
    
    // Add fallback cities
    FALLBACK_CITIES.forEach(city => merged.set(city.name, city));
    
    // Add destinations (overwrites fallbacks if duplicate)
    normalized.forEach(city => {
      if (city.name && city.name.trim()) {
        merged.set(city.name.trim(), city);
      }
    });
    
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [destinations]);

  const [destinationCity, setDestinationCity] = useState(cities[0]?.name || "");
  const [customCity, setCustomCity] = useState("");
  const [useCustomCity, setUseCustomCity] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  });
  const [technicianValue, setTechnicianValue] = useState("__auto");

  useEffect(() => {
    if (!useCustomCity && cities.length > 0 && !destinationCity) {
      setDestinationCity(cities[0]?.name || "");
    }
  }, [cities, destinationCity, useCustomCity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fallbackCity = cities[0]?.name || "";
    const payloadCity = (useCustomCity ? customCity.trim() : destinationCity || fallbackCity).trim();
    if (!payloadCity) return;
    onSubmit({
      destinationCity: payloadCity,
      startDate,
      endDate,
      technicianId: technicianValue === "__auto" ? undefined : technicianValue,
    });
  };

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plane className="h-5 w-5 text-primary" />
          Technician Travel & Auto PM
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a city and window to generate a fully automatic travel plan.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Destination City *</Label>
            <Select
              value={useCustomCity ? "__custom" : destinationCity}
              onValueChange={(value) => {
                if (value === "__custom") {
                  setUseCustomCity(true);
                } else {
                  setUseCustomCity(false);
                  setDestinationCity(value);
                  setCustomCity("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.name} value={city.name}>
                    {city.name}
                  </SelectItem>
                ))}
                <SelectItem value="__custom">Other (type manually)</SelectItem>
              </SelectContent>
            </Select>
            {useCustomCity && (
              <Input
                placeholder="Enter destination city"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Optional Technician Override</Label>
            <Select value={technicianValue} onValueChange={setTechnicianValue}>
              <SelectTrigger>
                <SelectValue placeholder="Let system choose automatically" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto">Automatic (recommended)</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name || tech.employeeCode || "Technician"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-2">
            <Label>End Date *</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button
              type="submit"
              disabled={isLoading || !startDate || !endDate || !(useCustomCity ? customCity.trim() : destinationCity)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isLoading ? "Generating..." : "Auto Plan Trip"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

