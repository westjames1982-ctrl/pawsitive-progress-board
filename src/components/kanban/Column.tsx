import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/lib/use-tasks";

const COLUMN_META: Record<TaskStatus, { title: string }> = {
  todo: { title: "To Do" },
  in_progress: { title: "In Progress" },
  done: { title: "Done" },
};

export function Column({
  status,
  tasks,
  onAdd,
  onEdit,
}: {
  status: TaskStatus;
  tasks: Task[];
  onAdd: (status: TaskStatus) => void;
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${status}`,
    data: { type: "column", status },
  });
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
  const meta = COLUMN_META[status];

  return (
    <div className="flex w-[300px] shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{meta.title}</h3>
          <p className="text-xs text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            {totalMinutes ? `, ${Math.round(totalMinutes / 60 * 10) / 10} hours` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => onAdd(status)}
          aria-label="Add task"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-3 rounded-2xl p-1 transition-colors ${
          isOver ? "bg-accent/60" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onEdit(task)} />
          ))}
        </SortableContext>
        {tasks.length === 0 ? (
          <button
            onClick={() => onAdd(status)}
            className="w-full rounded-xl border border-dashed border-border/70 py-6 text-xs text-muted-foreground hover:bg-accent/40"
          >
            + Add a task
          </button>
        ) : null}
      </div>
    </div>
  );
}