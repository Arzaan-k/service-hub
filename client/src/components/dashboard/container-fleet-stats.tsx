import { GlassCard } from "@/components/ui/animated-card";
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
      case "A": return "bg-green-500/20 text-green-500 border-green-500/30";
      case "B": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "C": return "bg-amber-500/20 text-amber-500 border-amber-500/30";
      default: return "bg-gray-500/20 text-gray-500 border-gray-500/30";
    }
  };

  const getProductTypeIcon = (type: string) => {
    if (type?.toLowerCase().includes("reefer")) return "❄️";
    if (type?.toLowerCase().includes("dry")) return "📦";
    return "📦";
  };

  return (
    <GlassCard className="h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl">
            <Package className="h-5 w-5 text-purple-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground tracking-tight">Fleet Overview</h3>
        </div>
        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
          {stats.withMasterData}/{stats.total} tracked
        </Badge>
      </div>

      <div className="space-y-8">
        {/* Product Type Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-purple-500" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Product Type</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.byProductType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <span className="text-sm flex items-center gap-2 font-medium">
                    <span>{getProductTypeIcon(type)}</span>
                    <span className="truncate max-w-[80px]">{type || "Unknown"}</span>
                  </span>
                  <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Grade Distribution */}
        {Object.keys(stats.byGrade).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Grade</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byGrade)
                .sort((a, b) => b[1] - a[1])
                .map(([grade, count]) => (
                  <div key={grade} className={`px-3 py-1.5 rounded-lg border ${getGradeColor(grade)} flex items-center gap-2`}>
                    <span className="text-xs font-bold">Grade {grade}</span>
                    <span className="text-xs opacity-80 border-l border-current pl-2 ml-1">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Depot/Location Breakdown */}
        {Object.keys(stats.byDepot).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Depots</h4>
            </div>
            <div className="space-y-3">
              {Object.entries(stats.byDepot)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([depot, count]) => (
                  <div key={depot} className="flex items-center justify-between group">
                    <span className="text-sm text-foreground/80 truncate group-hover:text-purple-500 transition-colors">{depot}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {Object.keys(stats.byCategory).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Factory className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Category</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <Badge key={category} variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors py-1.5">
                    {category}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Average Year of Manufacture */}
        {stats.avgYom > 0 && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calendar className="h-4 w-4 text-purple-500" />
              </div>
              <span className="text-sm font-medium">Avg. Year of Manufacture</span>
            </div>
            <span className="text-lg font-bold text-foreground">{stats.avgYom}</span>
          </div>
        )}

        {/* Data Coverage */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Data Completeness</span>
            </div>
            <span className="text-xs font-bold text-green-500">{Math.round((stats.withMasterData / stats.total) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              style={{ width: `${(stats.withMasterData / stats.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {stats.withMasterData} of {stats.total} containers have complete master data
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
