interface ColorGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ColorGuide({ isOpen, onClose }: ColorGuideProps) {
  if (!isOpen) return null;

  const colorCategories = [
    {
      name: "Dashboard & Overview",
      color: "dashboard",
      icon: "fas fa-th-large",
      description: "Main dashboard, fleet overview, and general analytics"
    },
    {
      name: "Containers & Fleet",
      color: "containers",
      icon: "fas fa-box",
      description: "Container management, fleet tracking, and IoT devices"
    },
    {
      name: "Alerts & Issues",
      color: "alerts",
      icon: "fas fa-exclamation-triangle",
      description: "Critical alerts, warnings, and system issues"
    },
    {
      name: "Service Requests",
      color: "service",
      icon: "fas fa-wrench",
      description: "Maintenance requests, repairs, and service scheduling"
    },
    {
      name: "Technicians",
      color: "technicians",
      icon: "fas fa-user-hard-hat",
      description: "Technician profiles, skills, and performance"
    },
    {
      name: "Scheduling",
      color: "scheduling",
      icon: "fas fa-calendar-alt",
      description: "Appointment scheduling and calendar management"
    },
    {
      name: "Clients & Customers",
      color: "clients",
      icon: "fas fa-users",
      description: "Customer management and client relationships"
    },
    {
      name: "WhatsApp Communication",
      color: "whatsapp",
      icon: "fab fa-whatsapp",
      description: "WhatsApp messaging and communication hub"
    },
    {
      name: "Inventory Management",
      color: "inventory",
      icon: "fas fa-warehouse",
      description: "Parts inventory, stock management, and supplies"
    },
    {
      name: "Analytics & Reports",
      color: "analytics",
      icon: "fas fa-chart-line",
      description: "Data analytics, reports, and business intelligence"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Color Coding Guide</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {colorCategories.map((category) => (
            <div
              key={category.color}
              className={`p-4 bg-${category.color}/5 border border-${category.color}/20 rounded-lg`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-${category.color}/10 rounded-lg`}>
                  <i className={`${category.icon} text-${category.color} text-sm`}></i>
                </div>
                <h3 className={`font-semibold text-${category.color}`}>{category.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/10 rounded-lg">
          <h3 className="font-semibold text-foreground mb-2">How to Use This System:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Each functional area has its own distinct color for easy identification</li>
            <li>• Navigation items are color-coded to match their corresponding sections</li>
            <li>• Component headers include colored icons and borders for quick recognition</li>
            <li>• Status indicators and badges use consistent color patterns</li>
            <li>• Hover effects and active states maintain the color theme</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
