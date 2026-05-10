import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/use-tasks";

const STATUS_PILL: Record<Task["status"], { label: string; bg: string; fg: string }> = {
  todo: { label: "TO DO", bg: "var(--status-todo)", fg: "var(--status-todo-fg)" },
  in_progress: {
    label: "PROGRESS",
    bg: "var(--status-progress)",
    fg: "var(--status-progress-fg)",
  },
  done: { label: "DONE", bg: "var(--status-done)", fg: "var(--status-done-fg)" },
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const pill = STATUS_PILL[task.status];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group cursor-grab active:cursor-grabbing rounded-2xl border bg-card p-4 shadow-card",
        "hover:shadow-md transition-shadow",
      )}
    >
      <h4 className="font-medium text-sm leading-snug text-card-foreground">{task.title}</h4>
      {task.description ? (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide"
          style={{ background: pill.bg, color: pill.fg }}
        >
          {pill.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Flag className="size-3" />
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.estimated_minutes ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {task.estimated_minutes} min
          </span>
        ) : null}
      </div>
    </div>
  );
}