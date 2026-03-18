import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SignAgreementClient } from "./sign-client";

export const metadata = { title: "Sign Agreement" };

export default async function SignAgreementPage() {
  const user = await requireRole("PM");

  const app = await db.merchantApplication.findUnique({
    where: { userId: user.id },
    include: {
      principals: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          ownershipPercent: true,
          signatureBase64: true,
          signedAt: true,
        },
      },
    },
  });

  if (!app) {
    redirect("/dashboard");
  }

  const alreadySigned = !!app.agreementSignedAt;

  const principals = app.principals.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    title: p.title,
    ownershipPercent: p.ownershipPercent,
    alreadySigned: !!p.signedAt,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SignAgreementClient
        applicationId={app.id}
        businessName={app.businessLegalName || "Your Business"}
        dba={app.dba || ""}
        principals={principals}
        alreadySigned={alreadySigned}
        agreementPdfUrl={app.agreementPdfUrl}
      />
    </div>
  );
}
