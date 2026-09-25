"use server";

import { revalidatePath } from "next/cache";
import {
  createContact,
  createDeal,
  createTask,
  deleteContact,
  deleteDeal,
  deleteTask,
  toggleTaskCompleted,
  updateContact,
  updateDeal,
  updateDealStage,
  updateTask,
} from "@/lib/db";
import type { ContactInput, DealInput, DealStage, TaskInput } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function actionError(error: unknown): ActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong.",
  };
}

function revalidateDashboardAnd(path: "/contacts" | "/deals" | "/tasks"): void {
  revalidatePath("/");
  revalidatePath(path);
}

export async function createContactAction(
  input: ContactInput,
): Promise<ActionResult> {
  try {
    await createContact(input);
    revalidateDashboardAnd("/contacts");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateContactAction(
  id: number,
  input: ContactInput,
): Promise<ActionResult> {
  try {
    await updateContact(id, input);
    revalidateDashboardAnd("/contacts");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteContactAction(id: number): Promise<ActionResult> {
  try {
    await deleteContact(id);
    revalidateDashboardAnd("/contacts");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function createDealAction(input: DealInput): Promise<ActionResult> {
  try {
    await createDeal(input);
    revalidateDashboardAnd("/deals");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDealAction(
  id: number,
  input: DealInput,
): Promise<ActionResult> {
  try {
    await updateDeal(id, input);
    revalidateDashboardAnd("/deals");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDealStageAction(
  id: number,
  stage: DealStage,
): Promise<ActionResult> {
  try {
    await updateDealStage(id, stage);
    revalidateDashboardAnd("/deals");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteDealAction(id: number): Promise<ActionResult> {
  try {
    await deleteDeal(id);
    revalidateDashboardAnd("/deals");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function createTaskAction(input: TaskInput): Promise<ActionResult> {
  try {
    await createTask(input);
    revalidateDashboardAnd("/tasks");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateTaskAction(
  id: number,
  input: TaskInput,
): Promise<ActionResult> {
  try {
    await updateTask(id, input);
    revalidateDashboardAnd("/tasks");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleTaskAction(id: number): Promise<ActionResult> {
  try {
    await toggleTaskCompleted(id);
    revalidateDashboardAnd("/tasks");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTaskAction(id: number): Promise<ActionResult> {
  try {
    await deleteTask(id);
    revalidateDashboardAnd("/tasks");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
