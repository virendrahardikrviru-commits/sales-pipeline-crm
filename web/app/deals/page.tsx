import { DealsBoard } from "@/components/DealsBoard";
import { listContacts, listDeals } from "@/lib/db";

export default async function Page() {
  const [deals, contacts] = await Promise.all([listDeals(), listContacts()]);
  return <DealsBoard deals={deals} contacts={contacts} />;
}
