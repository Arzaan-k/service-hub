import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, X, DollarSign } from "lucide-react";

interface WageBreakdownProps {
  technicianId: string;
}

interface WageData {
  grade: string;
  designation: string;
  hotelAllowance: number;
  localTravelAllowance: number;
  foodAllowance: number;
  personalAllowance: number;
  total: number;
}

export default function WageBreakdown({ technicianId }: WageBreakdownProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedWage, setEditedWage] = useState<WageData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch wage data
  const { data: wageData, isLoading } = useQuery<WageData>({
    queryKey: ["/api/technicians", technicianId, "wage"],
    queryFn: async () => (await apiRequest("GET", `/api/technicians/${technicianId}/wage`)).json(),
    enabled: !!technicianId,
  });

  // Update wage mutation
  const updateWageMutation = useMutation({
    mutationFn: async (wageData: Partial<WageData>) =>
      apiRequest("PUT", `/api/technicians/${technicianId}/wage`, wageData),
    onSuccess: (response) => {
      const data = response.json();
      toast({
        title: "Success",
        description: "Wage details updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "wage"] });
      setIsEditing(false);
      setEditedWage(null);
      return data;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update wage details",
        variant: "destructive",
      });
    },
  });

  // Initialize edited wage when entering edit mode
  useEffect(() => {
    if (isEditing && wageData && !editedWage) {
      setEditedWage({ ...wageData });
    }
  }, [isEditing, wageData, editedWage]);

  // Calculate total dynamically
  const calculateTotal = (data: WageData | null) => {
    if (!data) return 0;
    return (
      (data.hotelAllowance || 0) +
      (data.localTravelAllowance || 0) +
      (data.foodAllowance || 0) +
      (data.personalAllowance || 0)
    );
  };

  const handleSave = () => {
    if (!editedWage) return;

    const dataToSend = {
      grade: editedWage.grade || "",
      designation: editedWage.designation || "",
      hotelAllowance: editedWage.hotelAllowance || 0,
      localTravelAllowance: editedWage.localTravelAllowance || 0,
      foodAllowance: editedWage.foodAllowance || 0,
      personalAllowance: editedWage.personalAllowance || 0,
    };

    updateWageMutation.mutate(dataToSend);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedWage(null);
  };

  const handleInputChange = (field: keyof WageData, value: string | number) => {
    if (!editedWage) return;

    const updated = { ...editedWage };
    if (typeof value === 'string' && ['grade', 'designation'].includes(field)) {
      (updated as any)[field] = value;
    } else if (typeof value === 'number' && ['hotelAllowance', 'localTravelAllowance', 'foodAllowance', 'personalAllowance'].includes(field)) {
      (updated as any)[field] = Math.max(0, value); // Prevent negative values
    }

    updated.total = calculateTotal(updated);
    setEditedWage(updated);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayData = isEditing ? editedWage : wageData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Wage Breakdown
          </CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Grade */}
          <div className="space-y-2">
            <Label htmlFor="grade">Grade</Label>
            {isEditing ? (
              <Input
                id="grade"
                value={displayData?.grade || ""}
                onChange={(e) => handleInputChange("grade", e.target.value)}
                placeholder="e.g., S1, S2, S3"
              />
            ) : (
              <div className="p-2 bg-muted rounded text-sm font-medium">
                {displayData?.grade || "Not set"}
              </div>
            )}
          </div>

          {/* Designation */}
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            {isEditing ? (
              <Input
                id="designation"
                value={displayData?.designation || ""}
                onChange={(e) => handleInputChange("designation", e.target.value)}
                placeholder="e.g., Sr. Technician"
              />
            ) : (
              <div className="p-2 bg-muted rounded text-sm font-medium">
                {displayData?.designation || "Not set"}
              </div>
            )}
          </div>
        </div>

        {/* Allowances */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hotel Allowance */}
            <div className="space-y-2">
              <Label htmlFor="hotelAllowance">Hotel Allowance (₹)</Label>
              {isEditing ? (
                <Input
                  id="hotelAllowance"
                  type="number"
                  min="0"
                  value={displayData?.hotelAllowance || 0}
                  onChange={(e) => handleInputChange("hotelAllowance", parseFloat(e.target.value) || 0)}
                />
              ) : (
                <div className="p-2 bg-muted rounded text-sm">
                  ₹{displayData?.hotelAllowance || 0}
                </div>
              )}
            </div>

            {/* Local Travel Allowance */}
            <div className="space-y-2">
              <Label htmlFor="localTravelAllowance">Local Travel Allowance (₹)</Label>
              {isEditing ? (
                <Input
                  id="localTravelAllowance"
                  type="number"
                  min="0"
                  value={displayData?.localTravelAllowance || 0}
                  onChange={(e) => handleInputChange("localTravelAllowance", parseFloat(e.target.value) || 0)}
                />
              ) : (
                <div className="p-2 bg-muted rounded text-sm">
                  ₹{displayData?.localTravelAllowance || 0}
                </div>
              )}
            </div>

            {/* Food Allowance */}
            <div className="space-y-2">
              <Label htmlFor="foodAllowance">Food Allowance (₹)</Label>
              {isEditing ? (
                <Input
                  id="foodAllowance"
                  type="number"
                  min="0"
                  value={displayData?.foodAllowance || 0}
                  onChange={(e) => handleInputChange("foodAllowance", parseFloat(e.target.value) || 0)}
                />
              ) : (
                <div className="p-2 bg-muted rounded text-sm">
                  ₹{displayData?.foodAllowance || 0}
                </div>
              )}
            </div>

            {/* Personal Allowance */}
            <div className="space-y-2">
              <Label htmlFor="personalAllowance">Personal Allowance (₹)</Label>
              {isEditing ? (
                <Input
                  id="personalAllowance"
                  type="number"
                  min="0"
                  value={displayData?.personalAllowance || 0}
                  onChange={(e) => handleInputChange("personalAllowance", parseFloat(e.target.value) || 0)}
                />
              ) : (
                <div className="p-2 bg-muted rounded text-sm">
                  ₹{displayData?.personalAllowance || 0}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Total Daily Wage</Label>
            <div className="text-xl font-bold text-green-600">
              ₹{displayData?.total || 0}
            </div>
          </div>
        </div>

        {/* Edit Mode Buttons */}
        {isEditing && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={updateWageMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updateWageMutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={updateWageMutation.isPending}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
