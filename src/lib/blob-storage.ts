import { put } from "@vercel/blob";

export async function uploadStatementPdf(
  pdfBuffer: Buffer,
  ownerName: string,
  period: string
): Promise<string> {
  const safeName = ownerName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const filename = `statements/${period}/${safeName}-${period}.pdf`;

  const blob = await put(filename, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  return blob.url;
}
