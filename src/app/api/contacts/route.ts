import { getContacts } from "@/lib/contacts";

// The list of name → email the assistant can resolve when you say "email John".
// Powers the "who can I email" browser on the People page.
export async function GET() {
  const contacts = await getContacts().catch(() => []);
  contacts.sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({ contacts });
}
