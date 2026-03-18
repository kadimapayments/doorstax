import { emailStyles, emailHeader, emailFooter } from "./_layout";

interface AcquiringAgreementEmailData {
  merchantName: string;
  dba: string;
  signedAt: string;
  principalCount: number;
}

export function acquiringAgreementEmail(data: AcquiringAgreementEmailData): string {
  const { merchantName, dba, signedAt, principalCount } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEW DOORSTAX APPLICATION SUBMITTED</title>
  <style>${emailStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>NEW DOORSTAX APPLICATION SUBMITTED</h1>
      <p>A new merchant account application has been signed and submitted through the DoorStax platform.</p>

      <div class="highlight">
        <table>
          <tr>
            <td>Legal Business Name</td>
            <td>${merchantName}</td>
          </tr>
          <tr>
            <td>DBA</td>
            <td>${dba || "N/A"}</td>
          </tr>
          <tr>
            <td>Signed At</td>
            <td>${signedAt}</td>
          </tr>
          <tr>
            <td>Principals</td>
            <td>${principalCount} signer${principalCount !== 1 ? "s" : ""}</td>
          </tr>
        </table>
      </div>

      <p>The signed Merchant Account Application and Agreement (V1.8) and the Signature Verification &amp; Audit Trail document are attached to this email.</p>

      <p style="font-size:12px;color:#999;">This application is now pending review. Please allow 1-2 business days for underwriting.</p>

      ${emailFooter()}
    </div>
  </div>
</body>
</html>`;
}
