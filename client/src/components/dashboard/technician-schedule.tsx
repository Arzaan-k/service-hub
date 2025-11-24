import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, User, AlertTriangle } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/animated-card";

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
      case "active": return "bg-green-500/20 text-green-500 border-green-500/30";
      case "starting": return "bg-amber-500/20 text-amber-500 border-amber-500/30";
      case "scheduled": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-500 border-gray-500/30";
    }
  };

  const getJobPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "critical": return "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20";
      case "high": return "bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20";
      case "medium": return "bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500/20";
      default: return "bg-purple-500/10 border-purple-500/20 text-purple-500 hover:bg-purple-500/20";
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
    <GlassCard className="h-full p-6">
      {/* Header with Date Selection */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/10 rounded-xl">
            <CalendarIcon className="text-pink-500 text-lg" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">Technician Schedule</h3>
            <p className="text-sm text-muted-foreground font-medium">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
          {/* Date Navigation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('prev')}
            className="h-8 w-8 p-0 hover:bg-white/10 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-[130px] justify-start text-left font-medium text-sm hover:bg-white/10 hover:text-foreground",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
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
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('next')}
            className="h-8 w-8 p-0 hover:bg-white/10 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1"></div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(new Date())}
            className="text-xs font-bold hover:bg-white/10 hover:text-primary"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="max-h-[700px] overflow-y-auto space-y-4 pr-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
            <span className="ml-3 text-sm font-medium text-muted-foreground">Loading schedules...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-red-500/5 rounded-xl border border-red-500/10">
            <p className="text-sm font-medium text-red-500">Failed to load technician schedules</p>
          </div>
        ) : scheduleData?.schedules?.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm font-medium text-muted-foreground">No technicians found</p>
          </div>
        ) : (
          scheduleData?.schedules?.map(({ technician, schedule }) => {
            const statusInfo = getTechnicianStatus(schedule);

            return (
              <div key={technician.id} className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group">
                {/* Technician Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {getInitials(technician.name || technician.employeeCode)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground group-hover:text-pink-500 transition-colors">
                        {technician.name || technician.employeeCode}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {technician.experienceLevel || "Technician"} • {Array.isArray(technician.skills) ? technician.skills.join(", ") : technician.skills || "General"}
                      </p>
                    </div>
                  </div>
                  <span className={cn("px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md border", getStatusColor(statusInfo.status))}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Schedule Summary */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <i className="fas fa-calendar-check text-muted-foreground"></i>
                    <span className="text-muted-foreground">
                      {schedule.length} job{schedule.length !== 1 ? 's' : ''} scheduled
                    </span>
                    {schedule.length > 0 && (
                      <span className="ml-auto font-bold text-foreground">
                        {schedule.filter(job => job.status === 'completed').length} completed
                      </span>
                    )}
                  </div>
                </div>

                {/* Job Cards */}
                {schedule.length > 0 && (
                  <div className="border-t border-white/10 pt-4">
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-2">
                        {schedule.map((job: any) => (
                          <Tooltip key={job.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "px-3 py-2 border rounded-lg cursor-pointer transition-all flex-shrink-0 min-w-[100px] max-w-[140px]",
                                  getJobPriorityColor(job.priority)
                                )}
                              >
                                <p className="text-xs font-bold truncate">
                                  {job.requestNumber || `SR-${job.id.slice(-4)}`}
                                </p>
                                <p className="text-[10px] opacity-80 truncate mt-0.5">
                                  {job.issueDescription || "Service"}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs p-4 bg-zinc-900 border-zinc-800 text-zinc-100">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  <span className="font-bold text-sm text-white">
                                    {job.requestNumber || `SR-${job.id.slice(-4)}`}
                                  </span>
                                </div>

                                <div className="text-xs space-y-2">
                                  <div className="flex items-start gap-2">
                                    <User className="h-3 w-3 mt-0.5 text-zinc-400" />
                                    <span className="font-medium">{technician.name || technician.employeeCode}</span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-3 w-3 mt-0.5 text-zinc-400" />
                                    <span className="font-medium">{job.issueDescription || "Service request"}</span>
                                  </div>

                                  {job.scheduledTimeWindow && (
                                    <div className="flex items-start gap-2">
                                      <Clock className="h-3 w-3 mt-0.5 text-zinc-400" />
                                      <span className="font-medium">{job.scheduledTimeWindow}</span>
                                    </div>
                                  )}

                                  {job.scheduledDate && (
                                    <div className="flex items-start gap-2">
                                      <CalendarIcon className="h-3 w-3 mt-0.5 text-zinc-400" />
                                      <span className="font-medium">{format(new Date(job.scheduledDate), "MMM dd, yyyy")}</span>
                                    </div>
                                  )}

                                  {job.priority && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        job.priority?.toLowerCase() === "critical" ? "bg-red-500" :
                                          job.priority?.toLowerCase() === "high" ? "bg-orange-500" :
                                            job.priority?.toLowerCase() === "medium" ? "bg-blue-500" :
                                              "bg-green-500"
                                      )} />
                                      <span className="capitalize font-bold">{job.priority} Priority</span>
                                    </div>
                                  )}

                                  {job.container && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-3 w-3 mt-0.5 text-zinc-400" />
                                      <span className="font-medium">Container: {job.container.containerCode || job.containerId}</span>
                                    </div>
                                  )}

                                  {job.status && (
                                    <div className="mt-3 pt-2 border-t border-zinc-800">
                                      <span className={cn(
                                        "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider",
                                        job.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                          job.status === 'in_progress' ? 'bg-blue-500/20 text-blue-500' :
                                            job.status === 'scheduled' ? 'bg-zinc-500/20 text-zinc-400' :
                                              'bg-amber-500/20 text-amber-500'
                                      )}>
                                        {job.status.replace('_', ' ')}
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
                  <div className="text-center py-4 text-xs font-medium text-muted-foreground border-t border-white/10">
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
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 rounded-lg bg-white/5">
              <div className="font-bold text-foreground text-lg">{scheduleData.schedules?.length || 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Technicians</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <div className="font-bold text-foreground text-lg">
                {scheduleData.schedules?.reduce((sum, s) => sum + s.schedule.length, 0) || 0}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Jobs</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="font-bold text-green-500 text-lg">
                {scheduleData.schedules?.reduce((sum, s) => sum + s.schedule.filter(job => job.status === 'completed').length, 0) || 0}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-green-500/80 font-semibold">Completed</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="font-bold text-blue-500 text-lg">
                {scheduleData.schedules?.reduce((sum, s) => sum + s.schedule.filter(job => job.status === 'in_progress').length, 0) || 0}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-blue-500/80 font-semibold">In Progress</div>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
