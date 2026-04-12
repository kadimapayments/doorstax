export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

/**
 * Legacy route — "Agents" was renamed to "Team" in the PM portal.
 * The Agent concept (PM/partner revenue share) lives in the admin panel only.
 */
export default function AgentsRedirect() {
  redirect("/dashboard/team");
}
