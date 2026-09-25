import { TasksList } from "@/components/TasksList";
import { listContacts, listTasks } from "@/lib/db";

export default async function Page() {
  const [tasks, contacts] = await Promise.all([listTasks(), listContacts()]);
  return <TasksList tasks={tasks} contacts={contacts} />;
}
