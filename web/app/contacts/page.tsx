import { ContactsView } from "@/components/ContactsView";
import { listContacts } from "@/lib/db";

export default async function Page() {
  const contacts = await listContacts();
  return <ContactsView contacts={contacts} />;
}
