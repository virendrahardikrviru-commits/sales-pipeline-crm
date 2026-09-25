"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import {
  createDealAction,
  deleteDealAction,
  updateDealAction,
  updateDealStageAction,
} from "@/app/actions";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  DEAL_STAGES,
  type Contact,
  type Deal,
  type DealInput,
  type DealStage,
} from "@/lib/types";

export interface DealsBoardProps {
  deals: Deal[];
  contacts: Contact[];
}

interface DealFormState {
  title: string;
  value: string;
  product: string;
  sales_rep: string;
  stage: DealStage;
  contact_id: string;
  close_date: string;
  notes: string;
}

const emptyForm: DealFormState = {
  title: "",
  value: "",
  product: "",
  sales_rep: "",
  stage: "Lead",
  contact_id: "",
  close_date: "",
  notes: "",
};

const PRODUCT_OPTIONS = [
  "Starter Plan",
  "Pro Plan",
  "Enterprise Plan",
  "Add-on Support",
] as const;

const SALES_REP_OPTIONS = [
  "Ava Chen",
  "Marcus Reid",
  "Priya Sharma",
  "Jonas Weber",
] as const;

const UNASSIGNED_REP = "unassigned";

const STAGE_TONES: Record<DealStage, BadgeTone> = {
  Lead: "info",
  Qualified: "info",
  Proposal: "warning",
  Won: "success",
  Lost: "danger",
};

const fieldClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

function dealAmount(deal: Deal): number {
  const amount = Number(deal.value);
  return Number.isFinite(amount) ? amount : 0;
}

function parseCloseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getCloseDateTone(deal: Deal): "overdue" | "today" | "neutral" {
  if (deal.close_date == null || deal.close_date === "") return "neutral";
  if (deal.stage === "Won" || deal.stage === "Lost") return "neutral";

  const close = parseCloseDate(String(deal.close_date));
  if (Number.isNaN(close.getTime())) return "neutral";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (close.getTime() === today.getTime()) return "today";
  if (close.getTime() < today.getTime()) return "overdue";
  return "neutral";
}

const CLOSE_DATE_TONES: Record<ReturnType<typeof getCloseDateTone>, string> = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  neutral: "text-zinc-500 dark:text-zinc-400",
};

function formToInput(form: DealFormState): DealInput | { error: string } {
  if (!form.title.trim()) return { error: "Title is required." };

  const value = Number(form.value);
  if (!Number.isFinite(value)) return { error: "Value must be a number." };

  return {
    title: form.title.trim(),
    value,
    stage: form.stage,
    contact_id: form.contact_id ? Number(form.contact_id) : null,
    close_date: form.close_date || null,
    notes: form.notes.trim() || null,
    product: form.product.trim() || null,
    sales_rep: form.sales_rep.trim() || null,
  };
}

function dealToForm(deal: Deal): DealFormState {
  return {
    title: deal.title,
    value: String(deal.value),
    product: deal.product ?? "",
    sales_rep: deal.sales_rep ?? "",
    stage: deal.stage,
    contact_id: deal.contact_id == null ? "" : String(deal.contact_id),
    close_date: deal.close_date ?? "",
    notes: deal.notes ?? "",
  };
}

function matchesSalesRep(deal: Deal, filter: string): boolean {
  if (!filter) return true;
  if (filter === UNASSIGNED_REP) {
    return deal.sales_rep == null || deal.sales_rep === "";
  }
  return deal.sales_rep === filter;
}

export function DealsBoard({ deals, contacts }: DealsBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(deals);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState<DealFormState>(emptyForm);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropStage, setDropStage] = useState<DealStage | null>(null);
  const [salesRepFilter, setSalesRepFilter] = useState("");

  useEffect(() => {
    setItems(deals);
  }, [deals]);

  const salesRepChoices = useMemo(() => {
    const names = new Set<string>();
    for (const deal of items) {
      if (deal.sales_rep) names.add(deal.sales_rep);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleDeals = useMemo(
    () => items.filter((deal) => matchesSalesRep(deal, salesRepFilter)),
    [items, salesRepFilter],
  );

  const pipelineValue = useMemo(
    () =>
      visibleDeals
        .filter((deal) => deal.stage !== "Won" && deal.stage !== "Lost")
        .reduce((sum, deal) => sum + deal.value, 0),
    [visibleDeals],
  );

  const dealsByStage = useMemo(() => {
    const grouped = Object.fromEntries(
      DEAL_STAGES.map((stage) => [stage, [] as Deal[]]),
    ) as Record<DealStage, Deal[]>;

    for (const deal of visibleDeals) {
      grouped[deal.stage].push(deal);
    }

    return grouped;
  }, [visibleDeals]);

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

  function openEdit(deal: Deal) {
    setEditing(deal);
    setForm(dealToForm(deal));
    setError(null);
    setFormOpen(true);
  }

  function updateField<K extends keyof DealFormState>(
    key: K,
    value: DealFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function moveDeal(id: number, stage: DealStage) {
    const current = items.find((deal) => deal.id === id);
    if (!current || current.stage === stage) return;

    const previous = items;
    setItems((deals) =>
      deals.map((deal) => (deal.id === id ? { ...deal, stage } : deal)),
    );
    setBoardError(null);
    setSubmitting(true);

    startTransition(async () => {
      const result = await updateDealStageAction(id, stage);
      setSubmitting(false);

      if (!result.ok) {
        setItems(previous);
        setBoardError(result.error);
        return;
      }

      router.refresh();
    });
  }

  function saveDeal() {
    const input = formToInput(form);
    if ("error" in input) {
      setError(input.error);
      return;
    }

    setError(null);
    setSubmitting(true);

    startTransition(async () => {
      const result = editing
        ? await updateDealAction(editing.id, input)
        : await createDealAction(input);

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
      const result = await deleteDealAction(deleting.id);
      setSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Deals
          </h1>
          <Badge tone="info">{formatCurrency(pipelineValue)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by sales rep"
            value={salesRepFilter}
            onChange={(event) => setSalesRepFilter(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500"
          >
            <option value="">All reps</option>
            {salesRepChoices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={UNASSIGNED_REP}>Unassigned</option>
          </select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Deal
          </Button>
        </div>
      </div>

      {boardError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {boardError}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-8 w-8" />}
          title="No deals yet"
          description="Add your first deal to start the pipeline"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Deal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {DEAL_STAGES.map((stage) => {
            const columnDeals = dealsByStage[stage];
            const columnValue = columnDeals.reduce(
              (sum, deal) => sum + deal.value,
              0,
            );
            const isDropTarget = dropStage === stage;

            return (
              <section
                key={stage}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropStage(stage);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  setDropStage(null);
                  setDraggingId(null);
                  if (Number.isFinite(id)) moveDeal(id, stage);
                }}
                className={`flex min-h-72 flex-col rounded-xl border bg-zinc-50/80 p-3 dark:bg-zinc-900/40 ${
                  isDropTarget
                    ? "border-dashed border-zinc-900 dark:border-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <header className="mb-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={STAGE_TONES[stage]}>{stage}</Badge>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {columnDeals.length}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {formatCurrency(columnValue)}
                  </p>
                </header>

                <div className="flex flex-1 flex-col gap-3">
                  {columnDeals.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                      {draggingId ? "Drop deals here" : "No deals"}
                    </div>
                  ) : (
                    columnDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        dragging={draggingId === deal.id}
                        onDragStart={() => setDraggingId(deal.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropStage(null);
                        }}
                        onEdit={() => openEdit(deal)}
                        onDelete={() => {
                          setError(null);
                          setDeleting(deal);
                        }}
                        onStageChange={(nextStage) => moveDeal(deal.id, nextStage)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit deal" : "Add deal"}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={saveDeal} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveDeal();
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
            Value
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.value}
              onChange={(event) => updateField("value", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Product
            <input
              list="deal-product-options"
              placeholder="e.g. Enterprise Plan"
              value={form.product}
              onChange={(event) => updateField("product", event.target.value)}
              className={fieldClassName}
            />
            <datalist id="deal-product-options">
              {PRODUCT_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Sales rep
            <input
              list="deal-sales-rep-options"
              placeholder="e.g. Ava Chen"
              value={form.sales_rep}
              onChange={(event) => updateField("sales_rep", event.target.value)}
              className={fieldClassName}
            />
            <datalist id="deal-sales-rep-options">
              {SALES_REP_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Stage
            <select
              value={form.stage}
              onChange={(event) =>
                updateField("stage", event.target.value as DealStage)
              }
              className={fieldClassName}
            >
              {DEAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
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
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Close date
            <input
              type="date"
              value={form.close_date}
              onChange={(event) => updateField("close_date", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className={`${fieldClassName} resize-y`}
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={closeDelete}
        title="Delete this deal?"
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

interface DealCardProps {
  deal: Deal;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStageChange: (stage: DealStage) => void;
}

function DealCard({
  deal,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onStageChange,
}: DealCardProps) {
  const closeDateTone = getCloseDateTone(deal);

  return (
    <article
      draggable
      suppressHydrationWarning
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(deal.id));
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab rounded-xl border border-zinc-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <div
        className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit {deal.title}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete {deal.title}</span>
        </Button>
      </div>

      <div className="flex items-start gap-2 pr-14">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {deal.title}
          </h3>
          <p
            suppressHydrationWarning
            className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {formatCurrency(dealAmount(deal))}
          </p>
          <p
            suppressHydrationWarning
            className={`mt-1 flex items-center gap-1.5 text-xs ${CLOSE_DATE_TONES[closeDateTone]}`}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {deal.close_date ? formatDate(deal.close_date) : "No close date"}
          </p>
          {deal.contact_name ? (
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              <User className="h-3.5 w-3.5 shrink-0" />
              {deal.contact_name}
            </p>
          ) : null}
        </div>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Change stage for {deal.title}</span>
        <select
          value={deal.stage}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onStageChange(event.target.value as DealStage)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {DEAL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
