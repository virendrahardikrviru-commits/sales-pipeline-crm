import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  ActivityItem,
  Contact,
  ContactInput,
  ContactStatus,
  DashboardSummary,
  Deal,
  DealInput,
  DealStage,
  MonthlySummary,
  ProductSalesSummary,
  SalesRepSummary,
  Task,
  TaskInput,
  TaskPriority,
} from "./types";

const DEMO_USER = "demo-user";

type Sql = NeonQueryFunction<false, false>;

let sql: Sql | null = null;
let setupPromise: Promise<void> | null = null;

function getSql(): Sql {
  if (sql) return sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to web/.env.local.");
  }

  sql = neon(databaseUrl);
  return sql;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function asIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return String(value);
}

function asDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return String(value);
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asCount(value: unknown): number {
  return Math.max(0, Math.trunc(asNumber(value)));
}

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapContact(row: Record<string, unknown>): Contact {
  return {
    id: asCount(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    company: row.company == null ? null : String(row.company),
    status: row.status as ContactStatus,
    notes: row.notes == null ? null : String(row.notes),
    created_at: asIsoTimestamp(row.created_at),
    updated_at: asIsoTimestamp(row.updated_at),
  };
}

function mapDeal(row: Record<string, unknown>): Deal {
  return {
    id: asCount(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    value: asNumber(row.value),
    stage: row.stage as DealStage,
    contact_id: row.contact_id == null ? null : asCount(row.contact_id),
    contact_name: row.contact_name == null ? null : String(row.contact_name),
    close_date: asDateOnly(row.close_date),
    notes: row.notes == null ? null : String(row.notes),
    product: row.product == null ? null : String(row.product),
    sales_rep: row.sales_rep == null ? null : String(row.sales_rep),
    created_at: asIsoTimestamp(row.created_at),
    updated_at: asIsoTimestamp(row.updated_at),
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: asCount(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    due_date: asDateOnly(row.due_date),
    completed: Boolean(row.completed),
    priority: row.priority as TaskPriority,
    contact_id: row.contact_id == null ? null : asCount(row.contact_id),
    created_at: asIsoTimestamp(row.created_at),
    updated_at: asIsoTimestamp(row.updated_at),
  };
}

export async function ensureSchema(): Promise<void> {
  const client = getSql();

  await client`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT NOT NULL DEFAULT 'Lead',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'Lead',
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      close_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await client`ALTER TABLE deals ADD COLUMN IF NOT EXISTS product TEXT`;
  await client`ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_rep TEXT`;

  await client`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      priority TEXT NOT NULL DEFAULT 'medium',
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await client`CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id)`;
  await client`CREATE INDEX IF NOT EXISTS idx_deals_user ON deals(user_id)`;
  await client`CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id)`;
}

export async function seedIfEmpty(userId: string = DEMO_USER): Promise<void> {
  const client = getSql();
  const existing = await client`
    SELECT id FROM contacts WHERE user_id = ${userId} LIMIT 1
  `;
  if (existing.length === 0) {
    await seedDemoRecords(userId);
  }

  await backfillDealAnalytics(userId);
}

async function backfillDealAnalytics(userId: string): Promise<void> {
  const client = getSql();
  const counts = await client`
    SELECT
      COUNT(*)::int AS total,
      COUNT(product)::int AS labeled
    FROM deals
    WHERE user_id = ${userId}
  `;
  const total = asCount(counts[0]?.total);
  const labeled = asCount(counts[0]?.labeled);
  if (total === 0 || labeled > 0) return;

  await client`
    UPDATE deals
    SET
      product = CASE title
        WHEN 'Northwind expansion seats' THEN 'Enterprise Plan'
        WHEN 'Harbor onboarding package' THEN 'Pro Plan'
        WHEN 'LumenPath analytics suite' THEN 'Add-on Support'
        WHEN 'Brightside pilot' THEN NULL
        WHEN 'Atlas annual renewal' THEN 'Starter Plan'
        ELSE (ARRAY['Starter Plan', 'Pro Plan', 'Enterprise Plan', 'Add-on Support'])[(id % 4) + 1]
      END,
      sales_rep = CASE title
        WHEN 'Northwind expansion seats' THEN 'Ava Chen'
        WHEN 'Harbor onboarding package' THEN 'Marcus Reid'
        WHEN 'LumenPath analytics suite' THEN 'Priya Sharma'
        WHEN 'Brightside pilot' THEN 'Jonas Weber'
        WHEN 'Atlas annual renewal' THEN 'Ava Chen'
        ELSE (ARRAY['Ava Chen', 'Marcus Reid', 'Priya Sharma', 'Jonas Weber'])[(id % 4) + 1]
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `;
}

async function seedDemoRecords(userId: string): Promise<void> {
  const client = getSql();
  const today = isoDate(0);
  const yesterday = isoDate(-1);
  const inTwoDays = isoDate(2);
  const inFiveDays = isoDate(5);
  const nextMonth = isoDate(30);

  await client`
    WITH new_contacts AS (
      INSERT INTO contacts (user_id, name, email, phone, company, status, notes)
      VALUES
        (${userId}, 'Ava Chen', 'ava.chen@northwind.io', '+1 415-555-0142', 'Northwind Labs', 'Customer', 'Signed last quarter and is evaluating an expansion seat.'),
        (${userId}, 'Marcus Hale', 'marcus.hale@harborand.co', '+1 212-555-0198', 'Harbor & Co', 'Lead', 'Referred by Ava. Looking for a Q4 rollout.'),
        (${userId}, 'Priya Nair', 'priya.nair@lumenpath.com', '+1 312-555-0176', 'LumenPath', 'Customer', 'Primary champion on the analytics package.'),
        (${userId}, 'Jonah Ortiz', 'jonah.ortiz@brightside.media', '+1 646-555-0114', 'Brightside Media', 'Lead', 'Wants a short pilot before committing budget.'),
        (${userId}, 'Elena Voss', 'elena.voss@atlasfreight.com', '+1 206-555-0160', 'Atlas Freight', 'Inactive', 'Paused after a procurement freeze.')
      RETURNING id, name
    ),
    new_deals AS (
      INSERT INTO deals (user_id, title, "value", stage, contact_id, close_date, notes, product, sales_rep)
      SELECT
        ${userId},
        seed.title,
        seed.deal_value,
        seed.stage,
        contacts.id,
        seed.close_date::date,
        seed.notes,
        seed.product,
        seed.sales_rep
      FROM (
        VALUES
          ('Ava Chen', 'Northwind expansion seats', 48000, 'Proposal', ${nextMonth}, 'Adding 40 seats across two teams.', 'Enterprise Plan', 'Ava Chen'),
          ('Marcus Hale', 'Harbor onboarding package', 12500, 'Qualified', ${isoDate(18)}, 'Needs security review before legal.', 'Pro Plan', 'Marcus Reid'),
          ('Priya Nair', 'LumenPath analytics suite', 72000, 'Won', ${isoDate(-12)}, 'Closed after a successful proof of value.', 'Add-on Support', 'Priya Sharma'),
          ('Jonah Ortiz', 'Brightside pilot', 8900, 'Lead', ${isoDate(40)}, 'Six-week trial with weekly check-ins.', ${null}, 'Jonas Weber'),
          ('Elena Voss', 'Atlas annual renewal', 21000, 'Lost', ${isoDate(-6)}, 'Lost to an incumbent after budget freeze.', 'Starter Plan', 'Ava Chen')
      ) AS seed(contact_name, title, deal_value, stage, close_date, notes, product, sales_rep)
      JOIN new_contacts AS contacts ON contacts.name = seed.contact_name
    ),
    new_tasks AS (
      INSERT INTO tasks (user_id, title, description, due_date, completed, priority, contact_id)
      SELECT
        ${userId},
        seed.title,
        seed.description,
        seed.due_date::date,
        seed.completed,
        seed.priority,
        contacts.id
      FROM (
        VALUES
          ('Ava Chen', 'Send proposal deck', 'Share the expansion pricing and rollout timeline.', ${today}, FALSE, 'high'),
          ('Marcus Hale', 'Follow up Harbor call', 'Recap security questions and send SOC 2 packet.', ${inTwoDays}, FALSE, 'medium'),
          ('Priya Nair', 'Collect LumenPath invoice', 'Confirm billing contact before finance close.', ${yesterday}, FALSE, 'low'),
          ('Jonah Ortiz', 'Schedule Brightside demo', 'Book a 45-minute walkthrough with their ops lead.', ${inFiveDays}, FALSE, 'high'),
          ('Elena Voss', 'Archive Atlas notes', 'Move the lost-deal recap into the shared folder.', ${yesterday}, TRUE, 'low')
      ) AS seed(contact_name, title, description, due_date, completed, priority)
      JOIN new_contacts AS contacts ON contacts.name = seed.contact_name
    )
    SELECT 1
  `;
}

export async function readyDb(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      await ensureSchema();
      await seedIfEmpty();
    })();
  }

  await setupPromise;
}

export async function listContacts(userId: string = DEMO_USER): Promise<Contact[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT id, user_id, name, email, phone, company, status, notes, created_at, updated_at
    FROM contacts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapContact);
}

export async function getContact(
  id: number,
  userId: string = DEMO_USER,
): Promise<Contact | null> {
  await readyDb();
  const rows = await getSql()`
    SELECT id, user_id, name, email, phone, company, status, notes, created_at, updated_at
    FROM contacts
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ? mapContact(rows[0]) : null;
}

export async function createContact(
  input: ContactInput,
  userId: string = DEMO_USER,
): Promise<Contact> {
  await readyDb();
  const rows = await getSql()`
    INSERT INTO contacts (user_id, name, email, phone, company, status, notes)
    VALUES (
      ${userId},
      ${input.name.trim()},
      ${emptyToNull(input.email)},
      ${emptyToNull(input.phone)},
      ${emptyToNull(input.company)},
      ${input.status ?? "Lead"},
      ${emptyToNull(input.notes)}
    )
    RETURNING id, user_id, name, email, phone, company, status, notes, created_at, updated_at
  `;
  return mapContact(rows[0]);
}

export async function updateContact(
  id: number,
  input: ContactInput,
  userId: string = DEMO_USER,
): Promise<Contact> {
  await readyDb();
  const rows = await getSql()`
    UPDATE contacts
    SET
      name = ${input.name.trim()},
      email = ${emptyToNull(input.email)},
      phone = ${emptyToNull(input.phone)},
      company = ${emptyToNull(input.company)},
      status = ${input.status ?? "Lead"},
      notes = ${emptyToNull(input.notes)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, user_id, name, email, phone, company, status, notes, created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error(`Contact ${id} was not found.`);
  }
  return mapContact(rows[0]);
}

export async function deleteContact(
  id: number,
  userId: string = DEMO_USER,
): Promise<void> {
  await readyDb();
  await getSql()`
    DELETE FROM contacts
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function listDeals(userId: string = DEMO_USER): Promise<Deal[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT
      d.id,
      d.user_id,
      d.title,
      d."value",
      d.stage,
      d.contact_id,
      c.name AS contact_name,
      d.close_date,
      d.notes,
      d.product,
      d.sales_rep,
      d.created_at,
      d.updated_at
    FROM deals d
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE d.user_id = ${userId}
    ORDER BY d.created_at DESC
  `;
  return rows.map(mapDeal);
}

export async function getDeal(
  id: number,
  userId: string = DEMO_USER,
): Promise<Deal | null> {
  await readyDb();
  const rows = await getSql()`
    SELECT
      d.id,
      d.user_id,
      d.title,
      d."value",
      d.stage,
      d.contact_id,
      c.name AS contact_name,
      d.close_date,
      d.notes,
      d.product,
      d.sales_rep,
      d.created_at,
      d.updated_at
    FROM deals d
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = ${id} AND d.user_id = ${userId}
  `;
  return rows[0] ? mapDeal(rows[0]) : null;
}

export async function createDeal(
  input: DealInput,
  userId: string = DEMO_USER,
): Promise<Deal> {
  await readyDb();
  const rows = await getSql()`
    INSERT INTO deals (user_id, title, "value", stage, contact_id, close_date, notes, product, sales_rep)
    VALUES (
      ${userId},
      ${input.title.trim()},
      ${input.value},
      ${input.stage ?? "Lead"},
      ${input.contact_id ?? null},
      ${emptyToNull(input.close_date)},
      ${emptyToNull(input.notes)},
      ${emptyToNull(input.product)},
      ${emptyToNull(input.sales_rep)}
    )
    RETURNING id
  `;
  const deal = await getDeal(asCount(rows[0]?.id), userId);
  if (!deal) {
    throw new Error("Deal was created but could not be loaded.");
  }
  return deal;
}

export async function updateDeal(
  id: number,
  input: DealInput,
  userId: string = DEMO_USER,
): Promise<Deal> {
  await readyDb();
  const rows = await getSql()`
    UPDATE deals
    SET
      title = ${input.title.trim()},
      "value" = ${input.value},
      stage = ${input.stage ?? "Lead"},
      contact_id = ${input.contact_id ?? null},
      close_date = ${emptyToNull(input.close_date)},
      notes = ${emptyToNull(input.notes)},
      product = ${emptyToNull(input.product)},
      sales_rep = ${emptyToNull(input.sales_rep)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;
  if (!rows[0]) {
    throw new Error(`Deal ${id} was not found.`);
  }
  const deal = await getDeal(id, userId);
  if (!deal) {
    throw new Error(`Deal ${id} was updated but could not be loaded.`);
  }
  return deal;
}

export async function updateDealStage(
  id: number,
  stage: DealStage,
  userId: string = DEMO_USER,
): Promise<Deal> {
  await readyDb();
  const rows = await getSql()`
    UPDATE deals
    SET stage = ${stage}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;
  if (!rows[0]) {
    throw new Error(`Deal ${id} was not found.`);
  }
  const deal = await getDeal(id, userId);
  if (!deal) {
    throw new Error(`Deal ${id} was updated but could not be loaded.`);
  }
  return deal;
}

export async function deleteDeal(
  id: number,
  userId: string = DEMO_USER,
): Promise<void> {
  await readyDb();
  await getSql()`
    DELETE FROM deals
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function listTasks(userId: string = DEMO_USER): Promise<Task[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT id, user_id, title, description, due_date, completed, priority, contact_id, created_at, updated_at
    FROM tasks
    WHERE user_id = ${userId}
    ORDER BY completed ASC, due_date ASC NULLS LAST, created_at DESC
  `;
  return rows.map(mapTask);
}

export async function getTask(
  id: number,
  userId: string = DEMO_USER,
): Promise<Task | null> {
  await readyDb();
  const rows = await getSql()`
    SELECT id, user_id, title, description, due_date, completed, priority, contact_id, created_at, updated_at
    FROM tasks
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ? mapTask(rows[0]) : null;
}

export async function createTask(
  input: TaskInput,
  userId: string = DEMO_USER,
): Promise<Task> {
  await readyDb();
  const rows = await getSql()`
    INSERT INTO tasks (user_id, title, description, due_date, completed, priority, contact_id)
    VALUES (
      ${userId},
      ${input.title.trim()},
      ${emptyToNull(input.description)},
      ${emptyToNull(input.due_date)},
      ${input.completed ?? false},
      ${input.priority ?? "medium"},
      ${input.contact_id ?? null}
    )
    RETURNING id, user_id, title, description, due_date, completed, priority, contact_id, created_at, updated_at
  `;
  return mapTask(rows[0]);
}

export async function updateTask(
  id: number,
  input: TaskInput,
  userId: string = DEMO_USER,
): Promise<Task> {
  await readyDb();
  const rows = await getSql()`
    UPDATE tasks
    SET
      title = ${input.title.trim()},
      description = ${emptyToNull(input.description)},
      due_date = ${emptyToNull(input.due_date)},
      completed = ${input.completed ?? false},
      priority = ${input.priority ?? "medium"},
      contact_id = ${input.contact_id ?? null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, user_id, title, description, due_date, completed, priority, contact_id, created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error(`Task ${id} was not found.`);
  }
  return mapTask(rows[0]);
}

export async function toggleTaskCompleted(
  id: number,
  userId: string = DEMO_USER,
): Promise<Task> {
  await readyDb();
  const rows = await getSql()`
    UPDATE tasks
    SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, user_id, title, description, due_date, completed, priority, contact_id, created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error(`Task ${id} was not found.`);
  }
  return mapTask(rows[0]);
}

export async function deleteTask(
  id: number,
  userId: string = DEMO_USER,
): Promise<void> {
  await readyDb();
  await getSql()`
    DELETE FROM tasks
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function getDashboardSummary(
  userId: string = DEMO_USER,
): Promise<DashboardSummary> {
  await readyDb();
  const client = getSql();

  const [contactRows, dealRows, taskRows] = await Promise.all([
    client`
      SELECT COUNT(*)::int AS count
      FROM contacts
      WHERE user_id = ${userId}
    `,
    client`
      SELECT
        COUNT(*)::int AS open_deals,
        COALESCE(SUM("value"), 0) AS pipeline_value
      FROM deals
      WHERE user_id = ${userId}
        AND stage NOT IN ('Won', 'Lost')
    `,
    client`
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE user_id = ${userId}
        AND completed = FALSE
        AND due_date = CURRENT_DATE
    `,
  ]);

  return {
    totalContacts: asCount(contactRows[0]?.count),
    openDeals: asCount(dealRows[0]?.open_deals),
    pipelineValue: asNumber(dealRows[0]?.pipeline_value),
    tasksDueToday: asCount(taskRows[0]?.count),
  };
}

export async function listRecentActivity(
  userId: string = DEMO_USER,
  limit: number = 8,
): Promise<ActivityItem[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT kind, id, label, created_at
    FROM (
      SELECT 'contact'::text AS kind, id, name AS label, created_at
      FROM contacts
      WHERE user_id = ${userId}
      UNION ALL
      SELECT 'deal'::text, id, title, created_at
      FROM deals
      WHERE user_id = ${userId}
      UNION ALL
      SELECT 'task'::text, id, title, created_at
      FROM tasks
      WHERE user_id = ${userId}
    ) AS activity
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    kind: row.kind as ActivityItem["kind"],
    id: asCount(row.id),
    label: String(row.label),
    createdAt: asIsoTimestamp(row.created_at),
  }));
}

export async function getSalesByProduct(
  userId: string = DEMO_USER,
): Promise<ProductSalesSummary[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT
      COALESCE(product, 'Unassigned') AS product,
      SUM("value") AS total,
      COUNT(*)::int AS count
    FROM deals
    WHERE user_id = ${userId}
      AND stage != 'Lost'
    GROUP BY COALESCE(product, 'Unassigned')
    ORDER BY total DESC
  `;

  return rows.map((row) => ({
    product: String(row.product),
    total: asNumber(row.total),
    count: asCount(row.count),
  }));
}

export async function getSalesByRep(
  userId: string = DEMO_USER,
): Promise<SalesRepSummary[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT
      COALESCE(sales_rep, 'Unassigned') AS sales_rep,
      SUM("value") AS total,
      COUNT(*)::int AS count,
      SUM(CASE WHEN stage = 'Won' THEN "value" ELSE 0 END) AS won
    FROM deals
    WHERE user_id = ${userId}
    GROUP BY COALESCE(sales_rep, 'Unassigned')
    ORDER BY total DESC
  `;

  return rows.map((row) => ({
    sales_rep: String(row.sales_rep),
    total: asNumber(row.total),
    count: asCount(row.count),
    won: asNumber(row.won),
  }));
}

export async function getMonthlyPipeline(
  userId: string = DEMO_USER,
): Promise<MonthlySummary[]> {
  await readyDb();
  const rows = await getSql()`
    SELECT
      TO_CHAR(DATE_TRUNC('month', close_date), 'YYYY-MM') AS month,
      SUM("value") AS total,
      SUM(CASE WHEN stage = 'Won' THEN "value" ELSE 0 END) AS won
    FROM deals
    WHERE user_id = ${userId}
      AND close_date IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
    LIMIT 12
  `;

  return rows.map((row) => ({
    month: String(row.month),
    total: asNumber(row.total),
    won: asNumber(row.won),
  }));
}
