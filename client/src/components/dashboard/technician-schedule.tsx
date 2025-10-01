interface TechnicianScheduleProps {
  technicians: any[];
}

export default function TechnicianSchedule({ technicians }: TechnicianScheduleProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Today's Technician Schedule</h3>
          <p className="text-sm text-muted-foreground">Jan 15, 2025</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-smooth">
            Auto-Schedule
          </button>
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted/20 transition-smooth">
            Manual Override
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Technician 1 */}
        <div className="p-4 bg-muted/10 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                MR
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Mike Rodriguez</p>
                <p className="text-xs text-muted-foreground">Senior Technician • Elec/HVAC</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-success/20 text-success text-xs font-medium rounded">On Route</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <i className="fas fa-clock text-muted-foreground"></i>
              <span className="text-muted-foreground">09:00 AM - 05:00 PM</span>
              <span className="ml-auto font-medium text-foreground">5 jobs assigned</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <i className="fas fa-map-marker-alt text-muted-foreground"></i>
              <span className="text-muted-foreground">Route: LA Port → San Pedro → Long Beach</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded flex-shrink-0">
                <p className="text-xs font-medium text-destructive">CNT-4892</p>
                <p className="text-xs text-muted-foreground">Power Failure</p>
              </div>
              <div className="px-3 py-2 bg-warning/10 border border-warning/20 rounded flex-shrink-0">
                <p className="text-xs font-medium text-warning">CNT-3401</p>
                <p className="text-xs text-muted-foreground">Temp Issue</p>
              </div>
              <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded flex-shrink-0">
                <p className="text-xs font-medium text-primary">CNT-5590</p>
                <p className="text-xs text-muted-foreground">Preventive</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technician 2 */}
        <div className="p-4 bg-muted/10 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold">
                SC
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sarah Chen</p>
                <p className="text-xs text-muted-foreground">Electronics Specialist • IoT</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-warning/20 text-warning text-xs font-medium rounded">Starting Soon</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <i className="fas fa-clock text-muted-foreground"></i>
              <span className="text-muted-foreground">10:00 AM - 06:00 PM</span>
              <span className="ml-auto font-medium text-foreground">4 jobs assigned</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <i className="fas fa-map-marker-alt text-muted-foreground"></i>
              <span className="text-muted-foreground">Route: Oakland → San Francisco</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
