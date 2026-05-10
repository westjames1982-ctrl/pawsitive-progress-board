import { useEffect, useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type Thread = { id: string; title: string; updated_at: string };

export function ChatPanel({
  userId,
  token,
  onClose,
}: {
  userId: string;
  token: string;
  onClose: () => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bootstrapped = useRef(false);

  // Load threads + ensure one
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      let list = data ?? [];
      if (list.length === 0 && !bootstrapped.current) {
        bootstrapped.current = true;
        const { data: newT } = await supabase
          .from("chat_threads")
          .insert({ user_id: userId, title: "New chat" })
          .select("id,title,updated_at")
          .single();
        if (newT) list = [newT];
      }
      setThreads(list);
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
    })();
  }, [userId]);

  // Load messages for active thread
  useEffect(() => {
    if (!activeId) return;
    setLoadingMsgs(true);
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id,role,parts")
        .eq("thread_id", activeId)
        .order("created_at");
      const msgs: UIMessage[] = (data ?? []).map((r) => ({
        id: r.id,
        role: r.role as UIMessage["role"],
        parts: (r.parts ?? []) as UIMessage["parts"],
      }));
      setInitialMessages(msgs);
      setLoadingMsgs(false);
    })();
  }, [activeId]);

  async function newThread() {
    const { data } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, title: "New chat" })
      .select("id,title,updated_at")
      .single();
    if (data) {
      setThreads((t) => [data, ...t]);
      setActiveId(data.id);
    }
  }

  async function deleteThread(id: string) {
    await supabase.from("chat_threads").delete().eq("id", id);
    setThreads((t) => t.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(threads.find((x) => x.id !== id)?.id ?? null);
  }

  return (
    <aside className="flex h-full w-[400px] shrink-0 flex-col border-l bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="size-7 rounded-lg"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden
          />
          <h2 className="text-sm font-semibold">Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={newThread} aria-label="New chat">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex max-h-[140px] gap-1.5 overflow-x-auto border-b px-3 py-2">
        {threads.map((t) => (
          <div key={t.id} className="group relative shrink-0">
            <button
              onClick={() => setActiveId(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                activeId === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent",
              )}
            >
              <MessageSquare className="size-3" />
              <span className="max-w-[120px] truncate">{t.title || "New chat"}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteThread(t.id);
              }}
              className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block"
              aria-label="Delete chat"
            >
              <Trash2 className="size-2.5" />
            </button>
          </div>
        ))}
      </div>

      {activeId && !loadingMsgs ? (
        <ChatBody key={activeId} threadId={activeId} token={token} initialMessages={initialMessages} />
      ) : (
        <div className="flex-1" />
      )}
    </aside>
  );
}

function ChatBody({
  threadId,
  token,
  initialMessages,
}: {
  threadId: string;
  token: string;
  initialMessages: UIMessage[];
}) {
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      headers: { Authorization: `Bearer ${token}` },
      body: { threadId },
    }),
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: transport.current,
    onError: (e) => toast.error(e.message),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = async (msg: PromptInputMessage) => {
    if (!msg.text.trim()) return;
    await sendMessage({ text: msg.text });
  };

  return (
    <>
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles className="size-6" />}
              title="Hey, I'm your kanban assistant"
              description="Ask me to add tasks, move things around, or summarize the board."
            />
          ) : null}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return <MessageResponse key={i}>{part.text}</MessageResponse>;
                  }
                  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                    const tp = part as ToolPart;
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader
                          type={tp.type as never}
                          state={tp.state}
                          toolName={"toolName" in tp ? (tp.toolName as string) : undefined as never}
                        />
                        <ToolContent>
                          <ToolInput input={tp.input} />
                          <ToolOutput output={tp.output} errorText={tp.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" ? (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          ) : null}
          {error ? (
            <p className="text-xs text-destructive">{error.message}</p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea placeholder="Ask the assistant..." autoFocus />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}