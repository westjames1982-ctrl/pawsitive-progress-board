import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Column } from "./Column";
import { TaskDialog } from "./TaskDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskStatus } from "@/lib/use-tasks";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

export function Board({
  userId,
  tasks,
  refresh,
}: {
  userId: string;
  tasks: Task[];
  refresh: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");

  const grouped = useMemo(() => {
    const out: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) out[t.status].push(t);
    return out;
  }, [tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;
    let newStatus: TaskStatus | undefined;
    if (typeof over.id === "string" && over.id.startsWith("col:")) {
      newStatus = over.id.slice(4) as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      newStatus = overTask?.status;
    }
    if (!newStatus || newStatus === draggedTask.status) return;
    await supabase
      .from("tasks")
      .update({ status: newStatus, position: Date.now() })
      .eq("id", draggedTask.id);
    refresh();
  }

  function openCreate(status: TaskStatus) {
    setEditing(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  }
  function openEdit(task: Task) {
    setEditing(task);
    setDialogOpen(true);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-5 overflow-x-auto px-6 pb-8">
          {COLUMNS.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={grouped[s]}
              onAdd={openCreate}
              onEdit={openEdit}
            />
          ))}
        </div>
      </DndContext>
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={userId}
        task={editing}
        defaultStatus={defaultStatus}
      />
    </>
  );
}