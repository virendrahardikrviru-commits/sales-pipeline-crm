"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import {
  createContactAction,
  deleteContactAction,
  updateContactAction,
} from "@/app/actions";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/Table";
import {
  CONTACT_STATUSES,
  type Contact,
  type ContactInput,
  type ContactStatus,
} from "@/lib/types";

export interface ContactsViewProps {
  contacts: Contact[];
}

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
  notes: string;
}

const emptyForm: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  status: "Lead",
  notes: "",
};

const STATUS_TONES: Record<ContactStatus, BadgeTone> = {
  Lead: "info",
  Customer: "success",
  Inactive: "neutral",
};

const fieldClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formToInput(form: ContactFormState): ContactInput {
  return {
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    company: form.company.trim() || null,
    status: form.status,
    notes: form.notes.trim() || null,
  };
}

export function ContactsView({ contacts }: ContactsViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactFormState>(emptyForm);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter((contact) => {
      const haystack = [contact.name, contact.email, contact.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, search]);

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

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({
      name: contact.name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      company: contact.company ?? "",
      status: contact.status,
      notes: contact.notes ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  function updateField<K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveContact() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    const input = formToInput(form);
    setError(null);
    setSubmitting(true);

    startTransition(async () => {
      const result = editing
        ? await updateContactAction(editing.id, input)
        : await createContactAction(input);

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
      const result = await deleteContactAction(deleting.id);
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
            Contacts
          </h1>
          <Badge tone="neutral">{contacts.length}</Badge>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No contacts yet"
          description="Add your first contact to get started"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Contact
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or company"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pr-3 pl-9 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                  <TH>Company</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((contact) => (
                  <TR key={contact.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {initials(contact.name)}
                        </div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {contact.name}
                        </span>
                      </div>
                    </TD>
                    <TD>{contact.email ?? "—"}</TD>
                    <TD>{contact.phone ?? "—"}</TD>
                    <TD>{contact.company ?? "—"}</TD>
                    <TD>
                      <Badge tone={STATUS_TONES[contact.status]}>
                        {contact.status}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(contact)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {contact.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setDeleting(contact);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {contact.name}</span>
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit contact" : "Add contact"}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={saveContact} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveContact();
          }}
        >
          {error && formOpen ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name
            <input
              required
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Company
            <input
              value={form.company}
              onChange={(event) => updateField("company", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Status
            <select
              value={form.status}
              onChange={(event) =>
                updateField("status", event.target.value as ContactStatus)
              }
              className={fieldClassName}
            >
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
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
        title="Delete this contact?"
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
