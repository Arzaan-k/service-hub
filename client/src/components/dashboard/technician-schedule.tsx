import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, User, AlertTriangle } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface TechnicianScheduleProps {
  technicians: any[];
}

interface ScheduleData {
  date: string;
  schedules: Array<{
    technician: any;
    schedule: any[];
  }>;
}

export default function TechnicianSchedule({ technicians }: TechnicianScheduleProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: scheduleData, isLoading, error } = useQuery<ScheduleData>({
    queryKey: ["/api/technicians/schedules", selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/technicians/schedules?date=${selectedDate.toISOString().split('T')[0]}`);
      return response.json();
    },
    enabled: !!selectedDate,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Helper functions
  const getTechnicianStatus = (schedule: any[]) => {
    if (schedule.length === 0) return { status: "available", label: "Available" };

    const now = new Date();
    const hasActiveJobs = schedule.some(job =>
      job.status === 'in_progress' ||
      (job.scheduledDate && new Date(job.scheduledDate) <= now && job.status === 'scheduled')
    );

    if (hasActiveJobs) return { status: "active", label: "On Route" };

    const upcomingJobs = schedule.filter(job =>
      job.scheduledDate && new Date(job.scheduledDate) > now
    );

    if (upcomingJobs.length > 0) {
      const nextJob = upcomingJobs[0];
      const timeDiff = new Date(nextJob.scheduledDate).getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff <= 2) return { status: "starting", label: "Starting Soon" };
      return { status: "scheduled", label: "Scheduled" };
    }

    return { status: "available", label: "Available" };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/20 text-success";
      case "starting": return "bg-warning/20 text-warning";
      case "scheduled": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted/20 text-muted-foreground";
    }
  };

  const getJobPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "critical": return "bg-destructive/10 border-destructive/20 text-destructive";
      case "high": return "bg-warning/10 border-warning/20 text-warning";
      case "medium": return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      default: return "bg-primary/10 border-primary/20 text-primary";
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  return (
    <div className="bg-card border border-scheduling/20 rounded-lg p-6">
      {/* Header with Date Selection */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-scheduling/10 rounded-lg">
            <CalendarIcon className="text-scheduling text-sm w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Technician Schedule</h3>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Navigation */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('prev')}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMM dd") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('next')}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(new Date())}
            className="text-xs"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="max-h-[700px] overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading schedules...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">Failed to load technician schedules</p>
          </div>
        ) : scheduleData?.schedules?.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No technicians found</p>
          </div>
        ) : (
          scheduleData?.schedules?.map(({ technician, schedule }) => {
            const statusInfo = getTechnicianStatus(schedule);

            return (
              <div key={technician.id} className="p-4 bg-muted/10 rounded-lg border border-border/50">
                {/* Technician Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                      {getInitials(technician.name || technician.employeeCode)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {technician.name || technician.employeeCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {technician.experienceLevel || "Technician"} • {Array.isArray(technician.skills) ? technician.skills.join(", ") : technician.skills || "General"}
                      </p>
                    </div>
                  </div>
                  <span className={cn("px-2 py-1 text-xs font-medium rounded", getStatusColor(statusInfo.status))}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Schedule Summary */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <i className="fas fa-calendar-check text-muted-foreground"></i>
                    <span className="text-muted-foreground">
                      {schedule.length} job{schedule.length !== 1 ? 's' : ''} scheduled
                    </span>
                    {schedule.length > 0 && (
                      <span className="ml-auto font-medium text-foreground">
                        {schedule.filter(job => job.status === 'completed').length} completed
                      </span>
                    )}
                  </div>
                </div>

                {/* Job Cards */}
                {schedule.length > 0 && (
                  <div className="border-t border-border/50 pt-3">
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-2">
                        {schedule.map((job: any) => (
                          <Tooltip key={job.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "px-3 py-2 border rounded-md cursor-pointer hover:shadow-sm transition-shadow flex-shrink-0 min-w-[100px] max-w-[140px]",
                                  getJobPriorityColor(job.priority)
                                )}
                              >
                                <p className="text-xs font-medium truncate">
                                  {job.requestNumber || `SR-${job.id.slice(-4)}`}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {job.issueDescription || "Service"}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs p-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-warning" />
                                  <span className="font-medium text-sm">
                                    {job.requestNumber || `SR-${job.id.slice(-4)}`}
                                  </span>
                                </div>

                                <div className="text-xs space-y-1">
                                  <div className="flex items-start gap-2">
                                    <User className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                    <span>{technician.name || technician.employeeCode}</span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                    <span>{job.issueDescription || "Service request"}</span>
                                  </div>

                                  {job.scheduledTimeWindow && (
                                    <div className="flex items-start gap-2">
                                      <Clock className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                      <span>{job.scheduledTimeWindow}</span>
                                    </div>
                                  )}

                                  {job.scheduledDate && (
                                    <div className="flex items-start gap-2">
                                      <CalendarIcon className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                      <span>{format(new Date(job.scheduledDate), "MMM dd, yyyy")}</span>
                                    </div>
                                  )}

                                  {job.priority && (
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        job.priority?.toLowerCase() === "critical" ? "bg-destructive" :
                                        job.priority?.toLowerCase() === "high" ? "bg-warning" :
                                        job.priority?.toLowerCase() === "medium" ? "bg-blue-500" :
                                        "bg-primary"
                                      )} />
                                      <span className="capitalize">{job.priority} Priority</span>
                                    </div>
                                  )}

                                  {job.container && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                      <span>Container: {job.container.containerCode || job.containerId}</span>
                                    </div>
                                  )}

                                  {job.status && (
                                    <div className="mt-2 pt-2 border-t border-border/50">
                                      <span className={cn(
                                        "text-xs px-2 py-1 rounded-full font-medium",
                                        job.status === 'completed' ? 'bg-success/20 text-success' :
                                        job.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                        job.status === 'scheduled' ? 'bg-muted/20 text-muted-foreground' :
                                        'bg-warning/20 text-warning'
                                      )}>
                                        {job.status.replace('_', ' ').toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </div>
                )}

                {schedule.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground border-t border-border/50">
                    No jobs scheduled for this date
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer with summary */}
      {scheduleData && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-foreground">{scheduleData.schedules?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Technicians</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">
                {scheduleData.schedules?.reduce((sum, s) => sum + s.schedule.length, 0) || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total Jobs</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-success">
                {scheduleData.schedules?.reduce((sum, s) => sum + s.schedule.filter(job => job.status === 'completed').length, 0) || 0}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-500">
                {scheduleData.schedules?.reduce((sum, s) => sum + s.schedule.filter(job => job.status === 'in_progress').length, 0) || 0}
              </div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
