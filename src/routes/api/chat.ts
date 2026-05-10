import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM = `You are an in-app assistant for a kanban board.

The board has 3 columns: "todo" (To Do), "in_progress" (In Progress), and "done" (Done).
Tasks have: title, description, priority (low/normal/high/urgent), estimated_minutes, and status.

You can read and modify the user's tasks using your tools. Be proactive: when the user asks to add tasks, just create them. When they ask for a summary, list the board state with counts and key tasks. Use markdown formatting in your replies. Keep replies concise.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId?: string;
        };
        const { messages, threadId } = body;

        const tools = {
          list_tasks: tool({
            description: "List all tasks on the user's kanban board.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await supabase
                .from("tasks")
                .select("id,title,description,status,priority,estimated_minutes")
                .order("position");
              if (error) return { error: error.message };
              return { tasks: data ?? [] };
            },
          }),
          create_task: tool({
            description: "Create a new task on the kanban board.",
            inputSchema: z.object({
              title: z.string().min(1),
              description: z.string().optional(),
              status: z.enum(["todo", "in_progress", "done"]).default("todo"),
              priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
              estimated_minutes: z.number().int().positive().optional(),
            }),
            execute: async (input) => {
              const { data, error } = await supabase
                .from("tasks")
                .insert({
                  user_id: userId,
                  title: input.title,
                  description: input.description ?? null,
                  status: input.status,
                  priority: input.priority,
                  estimated_minutes: input.estimated_minutes ?? null,
                  position: Date.now(),
                })
                .select()
                .single();
              if (error) return { error: error.message };
              return { ok: true, task: data };
            },
          }),
          update_task: tool({
            description: "Update an existing task.",
            inputSchema: z.object({
              id: z.string().uuid(),
              title: z.string().optional(),
              description: z.string().nullable().optional(),
              priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
              estimated_minutes: z.number().int().positive().nullable().optional(),
            }),
            execute: async ({ id, ...patch }) => {
              const { data, error } = await supabase
                .from("tasks")
                .update(patch)
                .eq("id", id)
                .select()
                .single();
              if (error) return { error: error.message };
              return { ok: true, task: data };
            },
          }),
          move_task: tool({
            description: "Move a task to a different column.",
            inputSchema: z.object({
              id: z.string().uuid(),
              status: z.enum(["todo", "in_progress", "done"]),
            }),
            execute: async ({ id, status }) => {
              const { error } = await supabase
                .from("tasks")
                .update({ status, position: Date.now() })
                .eq("id", id);
              if (error) return { error: error.message };
              return { ok: true };
            },
          }),
          delete_task: tool({
            description: "Delete a task.",
            inputSchema: z.object({ id: z.string().uuid() }),
            execute: async ({ id }) => {
              const { error } = await supabase.from("tasks").delete().eq("id", id);
              if (error) return { error: error.message };
              return { ok: true };
            },
          }),
        };

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            if (!threadId) return;
            // Persist any new messages (last user + final assistant)
            const newMsgs = finalMessages.slice(-2);
            for (const m of newMsgs) {
              const { error } = await supabase.from("chat_messages").insert({
                thread_id: threadId,
                user_id: userId,
                role: m.role,
                parts: m.parts as never,
              });
              if (error) console.error("[chat] persist message", error);
            }
            await supabase
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});