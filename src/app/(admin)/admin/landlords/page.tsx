import { redirect } from "next/navigation";

/**
 * Legacy route — "Managers/Landlords" was merged into "Property Managers"
 * at /admin/merchants. Redirect for any bookmarks or cached links.
 */
export default function LandlordsRedirect() {
  redirect("/admin/merchants");
}
