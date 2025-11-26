import { useId } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

export type TaskDraft = {
  id?: string;
  containerId: string;
  siteName?: string | null;
  customerId?: string | null;
  taskType: string;
  priority?: string;
  scheduledDate?: string | null;
  estimatedDurationHours?: number | null;
  serviceRequestId?: string | null;
  alertId?: string | null;
  notes?: string | null;
  source?: string;
  isManual?: boolean;
};

type TaskTableProps = {
  tasks: TaskDraft[];
  onChange: (tasks: TaskDraft[]) => void;
};

const TASK_TYPES = ["pm", "alert", "inspection"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function TaskTable({ tasks, onChange }: TaskTableProps) {
  const uid = useId();

  const handleUpdate = (index: number, updates: Partial<TaskDraft>) => {
    const next = tasks.map((task, idx) => (idx === index ? { ...task, ...updates, isManual: true } : task));
    onChange(next);
  };

  const handleRemove = (index: number) => {
    const next = tasks.filter((_, idx) => idx !== index);
    onChange(next);
  };

  const handleAdd = () => {
    const next: TaskDraft = {
      id: `${uid}-${Date.now()}`,
      containerId: "",
      siteName: "",
      taskType: "pm",
      priority: "MEDIUM",
      scheduledDate: "",
      estimatedDurationHours: 2,
      notes: "",
      source: "manual",
      isManual: true,
    };
    onChange([...tasks, next]);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Assigned Tasks & Containers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review PM jobs and alerts for this trip. Remove or add tasks before saving.
          </p>
        </div>
        <Button onClick={handleAdd} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 && (
          <Alert className="border-yellow-500/40 bg-yellow-500/10 text-yellow-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>No PM or alert tasks found for this city. You can add tasks manually.</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Container ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Duration (hrs)</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Source</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task, index) => (
              <TableRow key={task.id || `${task.containerId}-${index}`}>
                <TableCell className="max-w-[140px]">
                  <Input
                    value={task.containerId}
                    onChange={(e) => handleUpdate(index, { containerId: e.target.value })}
                    placeholder="Container ID"
                  />
                  <Input
                    value={task.siteName || ""}
                    onChange={(e) => handleUpdate(index, { siteName: e.target.value })}
                    placeholder="Site/Customer"
                    className="mt-2"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={task.taskType}
                    onValueChange={(value) => handleUpdate(index, { taskType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={task.priority || "MEDIUM"}
                    onValueChange={(value) => handleUpdate(index, { priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={task.scheduledDate?.split("T")[0] || ""}
                    onChange={(e) => handleUpdate(index, { scheduledDate: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={task.estimatedDurationHours ?? 2}
                    onChange={(e) => handleUpdate(index, { estimatedDurationHours: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={task.notes || ""}
                    onChange={(e) => handleUpdate(index, { notes: e.target.value })}
                    placeholder="Notes"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={task.source === "manual" ? "default" : "secondary"}>
                    {task.source === "manual" ? "Manual" : "Auto"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

