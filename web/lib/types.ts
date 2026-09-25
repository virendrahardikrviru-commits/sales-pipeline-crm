export const CONTACT_STATUSES = ["Lead", "Customer", "Inactive"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const DEAL_STAGES = ["Lead", "Qualified", "Proposal", "Won", "Lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Contact {
  id: number;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: ContactStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status?: ContactStatus;
  notes?: string | null;
}

export interface Deal {
  id: number;
  user_id: string;
  title: string;
  value: number;
  stage: DealStage;
  contact_id: number | null;
  contact_name: string | null;
  close_date: string | null;
  notes: string | null;
  product: string | null;
  sales_rep: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealInput {
  title: string;
  value: number;
  stage?: DealStage;
  contact_id?: number | null;
  close_date?: string | null;
  notes?: string | null;
  product?: string | null;
  sales_rep?: string | null;
}

export interface Task {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  priority: TaskPriority;
  contact_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
  completed?: boolean;
  priority?: TaskPriority;
  contact_id?: number | null;
}

export interface DashboardSummary {
  totalContacts: number;
  openDeals: number;
  pipelineValue: number;
  tasksDueToday: number;
}

export type ActivityKind = "contact" | "deal" | "task";

export interface ActivityItem {
  kind: ActivityKind;
  id: number;
  label: string;
  createdAt: string;
}

export interface ProductSalesSummary {
  product: string;
  total: number;
  count: number;
}

export interface SalesRepSummary {
  sales_rep: string;
  total: number;
  count: number;
  won: number;
}

export interface MonthlySummary {
  month: string;
  total: number;
  won: number;
}
