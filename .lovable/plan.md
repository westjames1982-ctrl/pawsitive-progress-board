
# Kanban Board with AI Assistant

A clean, minimal kanban app inspired by the unprocrast reference: light background, soft gradients, rounded cards, sidebar nav, and an AI chat panel that can actually manage your board.

## What you'll get

**Board**
- Three columns: To Do, In Progress, Done
- Task cards with title, description, priority (Low / Normal / High / Urgent), estimated time, and column count summary in each column header
- Add, edit, delete tasks via a clean modal
- Drag and drop tasks between columns (and reorder within a column)
- Status badge color matches the column (gray TO DO, orange PROGRESS, green DONE)

**AI Assistant (right-side panel, collapsible)**
- Multiple chat threads with a thread list, "New chat" button, switch/delete threads
- Streaming responses, markdown rendering, message history persisted per thread
- Tool-calling so the AI can really act on the board:
  - `create_task` — add a task to a chosen column
  - `update_task` — edit title/description/priority/time
  - `delete_task` — remove a task
  - `move_task` — change a task's column
  - `list_tasks` / `summarize_board` — read state for summaries and suggestions
- Suggest/brainstorm mode: AI proposes tasks; you confirm before they're added (uses approval on `create_task`)

**Persistence (Lovable Cloud)**
- Auth: email/password sign-in (so each user has their own board + chats)
- Tables: `tasks`, `chat_threads`, `chat_messages`, all scoped to the signed-in user via RLS
- Realtime so the board updates instantly when the AI modifies it

## Visual direction (from reference image 1)

- Background: warm off-white (`oklch` near `#fcfbf8`)
- Sidebar: subtle gray, soft icons, section labels in uppercase muted text
- Cards: white, generous radius (~`xl`), soft shadow, hairline border
- Accent gradient (purple → pink → orange) used for the active board avatar and a hero card image, not for buttons
- Primary button: near-black pill ("New task") with white text
- Status pills: small uppercase rounded labels with soft background tints
- Typography: clean sans, slightly tighter headings, muted secondary text

## Pages / routes

```
/login                — sign in / sign up
/                     — Kanban board (default after login)
```

A right-hand AI panel slides over the board; no separate chat route needed.

## Technical details

- **Stack**: TanStack Start (already set up), Tailwind v4 tokens in `src/styles.css`, shadcn primitives, AI Elements for chat surface (`Conversation`, `Message`, `MessageResponse`, `PromptInput*`, `Tool*`, `Shimmer`)
- **Drag & drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **AI**: Vercel AI SDK + Lovable AI Gateway via `@ai-sdk/openai-compatible`, model `google/gemini-3-flash-preview`. Server route `src/routes/api/chat.ts` with `streamText`, tools defined with Zod, `stopWhen: stepCountIs(50)`, `toUIMessageStreamResponse({ originalMessages, onFinish })` to persist assistant messages.
- **Tool execution**: tools call authenticated `createServerFn`s that mutate `tasks` under RLS. `create_task` uses `needsApproval` so brainstormed tasks need a click to commit.
- **Database (migrations)**:
  - `tasks(id, user_id, title, description, status[todo|in_progress|done], priority, estimated_minutes, position, created_at, updated_at)`
  - `chat_threads(id, user_id, title, updated_at, created_at)`
  - `chat_messages(id, thread_id, user_id, role, parts jsonb, created_at)` — UUID PK, AI SDK message id stored separately if needed
  - RLS: `user_id = auth.uid()` on every table; thread ownership checked on message inserts
- **Realtime**: subscribe to `tasks` changes for the current user so AI-driven edits appear instantly
- **Auth gate**: `_authenticated` layout route with `beforeLoad` redirecting to `/login`; `requireSupabaseAuth` middleware on every server fn

## Out of scope (can add later)

- Multiple boards / projects
- Calendar, Timeline, Gantt views from the reference sidebar
- Sharing boards with other users
- File attachments on tasks

