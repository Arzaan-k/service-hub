import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Factory, MapPin, Award, Calendar, TrendingUp } from "lucide-react";

interface ContainerFleetStatsProps {
  containers: any[];
}

export default function ContainerFleetStats({ containers }: ContainerFleetStatsProps) {
  // Calculate statistics from container master sheet data
  const stats = {
    total: containers.length,
    byProductType: {} as Record<string, number>,
    byGrade: {} as Record<string, number>,
    byDepot: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    avgYom: 0,
    withMasterData: 0,
  };

  let yomSum = 0;
  let yomCount = 0;

  containers.forEach((container) => {
    // Count by product type
    if (container.productType) {
      stats.byProductType[container.productType] = (stats.byProductType[container.productType] || 0) + 1;
    }

    // Count by grade
    if (container.grade) {
      stats.byGrade[container.grade] = (stats.byGrade[container.grade] || 0) + 1;
    }

    // Count by depot
    if (container.depot) {
      stats.byDepot[container.depot] = (stats.byDepot[container.depot] || 0) + 1;
    }

    // Count by category
    if (container.category) {
      stats.byCategory[container.category] = (stats.byCategory[container.category] || 0) + 1;
    }

    // Calculate average YOM
    if (container.yom) {
      yomSum += container.yom;
      yomCount++;
    }

    // Count containers with master sheet data
    if (container.masterSheetData || container.productType || container.depot) {
      stats.withMasterData++;
    }
  });

  stats.avgYom = yomCount > 0 ? Math.round(yomSum / yomCount) : 0;

  const getGradeColor = (grade: string) => {
    switch (grade?.toUpperCase()) {
      case "A": return "bg-green-500/20 text-green-200 border-green-400/30";
      case "B": return "bg-blue-500/20 text-blue-200 border-blue-400/30";
      case "C": return "bg-yellow-500/20 text-yellow-200 border-yellow-400/30";
      default: return "bg-gray-500/20 text-gray-200 border-gray-400/30";
    }
  };

  const getProductTypeIcon = (type: string) => {
    if (type?.toLowerCase().includes("reefer")) return "❄️";
    if (type?.toLowerCase().includes("dry")) return "📦";
    return "📦";
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Container Fleet Overview
          <Badge variant="outline" className="ml-auto">
            {stats.withMasterData}/{stats.total} with master data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Product Type Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">By Product Type</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stats.byProductType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <span className="text-sm flex items-center gap-1">
                    <span>{getProductTypeIcon(type)}</span>
                    <span className="truncate">{type || "Unknown"}</span>
                  </span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ))}
          </div>
        </div>

        {/* Grade Distribution */}
        {Object.keys(stats.byGrade).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">By Grade</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byGrade)
                .sort((a, b) => b[1] - a[1])
                .map(([grade, count]) => (
                  <Badge key={grade} className={`${getGradeColor(grade)} border`}>
                    Grade {grade}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Depot/Location Breakdown */}
        {Object.keys(stats.byDepot).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Top Depots</h4>
            </div>
            <div className="space-y-2">
              {Object.entries(stats.byDepot)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([depot, count]) => (
                  <div key={depot} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground truncate">{depot}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {Object.keys(stats.byCategory).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">By Category</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <Badge key={category} variant="outline">
                    {category}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Average Year of Manufacture */}
        {stats.avgYom > 0 && (
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Avg. Year of Manufacture</span>
            </div>
            <Badge variant="secondary">{stats.avgYom}</Badge>
          </div>
        )}

        {/* Data Coverage */}
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Master Sheet Coverage</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${(stats.withMasterData / stats.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.withMasterData} of {stats.total} containers ({Math.round((stats.withMasterData / stats.total) * 100)}%)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
