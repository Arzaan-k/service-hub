interface KPICardProps {
  icon: string;
  iconBg: string;
  title: string;
  value: string | number;
  subtitle: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  footer?: React.ReactNode;
}

export default function KPICard({ icon, iconBg, title, value, subtitle, trend, footer }: KPICardProps) {
  return (
    <div className="bg-[#0c1a2e] border border-[#223351] rounded-lg p-6 hover-lift transition-smooth">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 ${iconBg} rounded-lg`}>
          <i className={`${icon} text-xl text-white`}></i>
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? "text-green-400" : "text-red-400"}`}>
            <i className={`fas fa-arrow-${trend.isPositive ? "up" : "down"} mr-1`}></i>
            {trend.value}
          </span>
        )}
      </div>
      <h3 className="text-3xl font-bold text-white" data-testid={`text-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        {value}
      </h3>
      <p className="text-sm text-white/80 mt-1">{subtitle}</p>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
