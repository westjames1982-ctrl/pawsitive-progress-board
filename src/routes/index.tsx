import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTasks } from "@/lib/use-tasks";
import { Board } from "@/components/kanban/Board";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, LogOut } from "lucide-react";
import { TaskDialog } from "@/components/kanban/TaskDialog";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Kanban Board" },
      { name: "description", content: "Organize your work with an AI-powered kanban board." },
    ],
  }),
});

function Index() {
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const { tasks, refresh } = useTasks(user?.id);

  if (loading || !user || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="size-9 rounded-xl shadow-card"
              style={{ background: "var(--gradient-brand)" }}
              aria-hidden
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Today</h1>
              <p className="text-xs text-muted-foreground">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"} on your board
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setDialogOpen(true)} className="rounded-full" size="sm">
              <Plus className="size-4" />
              New task
            </Button>
            {!chatOpen ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setChatOpen(true)}
              >
                <Sparkles className="size-4" />
                Assistant
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => signOut()}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden pt-6">
          <Board userId={user.id} tasks={tasks} refresh={refresh} />
        </div>
      </main>
      {chatOpen ? (
        <ChatPanel
          userId={user.id}
          token={session.access_token}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={user.id}
        defaultStatus="todo"
      />
    </div>
  );
}
