"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import {
  createTaskAction,
  deleteTaskAction,
  toggleTaskAction,
  updateTaskAction,
} from "@/app/actions";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/format";
import {
  TASK_PRIORITIES,
  type Contact,
  type Task,
  type TaskInput,
  type TaskPriority,
} from "@/lib/types";

export interface TasksListProps {
  tasks: Task[];
  contacts: Contact[];
}

type TaskFilter = "all" | "open" | "completed";

interface TaskFormState {
  title: string;
  description: string;
  due_date: string;
  priority: TaskPriority;
  contact_id: string;
  completed: boolean;
}

const emptyForm: TaskFormState = {
  title: "",
  description: "",
  due_date: "",
  priority: "medium",
  contact_id: "",
  completed: false,
};

const PRIORITY_TONES: Record<TaskPriority, BadgeTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const fieldClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseDueDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDueDateTone(task: Task): "overdue" | "today" | "neutral" {
  if (!task.due_date || task.completed) return "neutral";

  const due = parseDueDate(task.due_date);
  if (Number.isNaN(due.getTime())) return "neutral";

  const today = startOfToday();
  if (due.getTime() === today.getTime()) return "today";
  if (due.getTime() < today.getTime()) return "overdue";
  return "neutral";
}

const DUE_DATE_TONES: Record<ReturnType<typeof getDueDateTone>, string> = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  neutral: "text-zinc-500 dark:text-zinc-400",
};

function compareTasks(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  if (a.due_date && b.due_date) {
    const dueDiff = parseDueDate(a.due_date).getTime() - parseDueDate(b.due_date).getTime();
    if (dueDiff !== 0) return dueDiff;
  } else if (a.due_date) {
    return -1;
  } else if (b.due_date) {
    return 1;
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function formToInput(form: TaskFormState): TaskInput | { error: string } {
  if (!form.title.trim()) return { error: "Title is required." };

  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    due_date: form.due_date || null,
    priority: form.priority,
    contact_id: form.contact_id ? Number(form.contact_id) : null,
    completed: form.completed,
  };
}

export function TasksList({ tasks, contacts }: TasksListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(tasks);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );

  const completedCount = items.filter((task) => task.completed).length;

  const visibleTasks = useMemo(() => {
    const filtered = items.filter((task) => {
      if (filter === "open") return !task.completed;
      if (filter === "completed") return task.completed;
      return true;
    });

    return [...filtered].sort(compareTasks);
  }, [filter, items]);

  const closeForm = useCallback(() => {
    if (submitting) return;
    setFormOpen(false);
    setEditing(null);
    setError(null);
  }, [submitting]);

  const closeDelete = useCallback(() => {
    if (submitting) return;
    setDeleting(null);
    setError(null);
  }, [submitting]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      due_date: task.due_date ?? "",
      priority: task.priority,
      contact_id: task.contact_id == null ? "" : String(task.contact_id),
      completed: task.completed,
    });
    setError(null);
    setFormOpen(true);
  }

  function updateField<K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCompleted(task: Task) {
    const previous = items;
    setItems((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, completed: !item.completed } : item,
      ),
    );

    startTransition(async () => {
      const result = await toggleTaskAction(task.id);
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  function saveTask() {
    const input = formToInput(form);
    if ("error" in input) {
      setError(input.error);
      return;
    }

    setError(null);
    setSubmitting(true);

    startTransition(async () => {
      const result = editing
        ? await updateTaskAction(editing.id, input)
        : await createTaskAction(input);

      setSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setFormOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;

    setError(null);
    setSubmitting(true);

    startTransition(async () => {
      const result = await deleteTaskAction(deleting.id);
      setSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDeleting(null);
      router.refresh();
    });
  }

  const emptyCopy = {
    all: {
      title: "No tasks yet",
      description: "Add your first task to get started",
    },
    open: {
      title: "No open tasks",
      description: "Everything is done. Nice.",
    },
    completed: {
      title: "No completed tasks yet",
      description: "Completed tasks will show up here.",
    },
  }[filter];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tasks
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {completedCount} of {items.length} complete
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {(
          [
            ["all", "All"],
            ["open", "Open"],
            ["completed", "Completed"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === value
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && !formOpen && !deleting ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {visibleTasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-8 w-8" />}
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={
            filter === "all" ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {visibleTasks.map((task) => {
            const contact = task.contact_id
              ? contactsById.get(task.contact_id)
              : undefined;
            const dueTone = getDueDateTone(task);

            return (
              <div
                key={task.id}
                className="group flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.completed}
                  aria-label={`Mark ${task.title} as ${task.completed ? "open" : "complete"}`}
                  onClick={() => toggleCompleted(task)}
                  className="mt-0.5 shrink-0 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      task.completed
                        ? "text-zinc-400 line-through dark:text-zinc-600"
                        : "text-zinc-900 dark:text-zinc-50"
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description ? (
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {task.description}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span
                      suppressHydrationWarning
                      className={`inline-flex items-center gap-1 ${DUE_DATE_TONES[dueTone]}`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {task.due_date ? formatDate(task.due_date) : "No due date"}
                    </span>
                    {contact ? (
                      <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                        <User className="h-3.5 w-3.5" />
                        {contact.name}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={PRIORITY_TONES[task.priority]}>{task.priority}</Badge>
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(task)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {task.title}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setDeleting(task);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete {task.title}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit task" : "Add task"}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={saveTask} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveTask();
          }}
        >
          {error && formOpen ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Title
            <input
              required
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className={`${fieldClassName} resize-y`}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Due date
            <input
              type="date"
              value={form.due_date}
              onChange={(event) => updateField("due_date", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Priority
            <select
              value={form.priority}
              onChange={(event) =>
                updateField("priority", event.target.value as TaskPriority)
              }
              className={fieldClassName}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Contact
            <select
              value={form.contact_id}
              onChange={(event) => updateField("contact_id", event.target.value)}
              className={fieldClassName}
            >
              <option value="">No contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </label>
          {editing ? (
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={form.completed}
                onChange={(event) => updateField("completed", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600"
              />
              Completed
            </label>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={closeDelete}
        title="Delete this task?"
        footer={
          <>
            <Button variant="secondary" onClick={closeDelete} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p>This cannot be undone.</p>
        {error && deleting ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
