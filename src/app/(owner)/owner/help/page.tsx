"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronDown, ChevronRight, HelpCircle, Mail } from "lucide-react";

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: "How do I view my payout statements?",
    answer:
      "Navigate to the Statements page from the sidebar. You can view all payout statements, filter by month, and see a detailed breakdown of gross rent, fees, expenses, and your net payout for each period.",
  },
  {
    question: "When will I receive my payouts?",
    answer:
      "Payouts are processed according to the frequency set by your property manager, typically on a monthly basis. Once approved, payouts are sent via ACH to your linked bank account. Processing usually takes 2-3 business days.",
  },
  {
    question: "How is my management fee calculated?",
    answer:
      "Your management fee is calculated as a percentage of the gross rent collected for the period. The percentage is defined in your owner agreement and can be viewed in your payout statements.",
  },
  {
    question: "What are processing fees?",
    answer:
      "Processing fees are the costs associated with collecting rent payments from tenants (e.g., credit card fees, ACH fees). Depending on your agreement, these may be deducted from your payout or absorbed by the property manager.",
  },
  {
    question: "How do I update my bank account information?",
    answer:
      "Please contact your property manager directly to update your bank account details for payout deposits. For security, bank account changes require verification by your property manager.",
  },
  {
    question: "Where can I find my tax documents?",
    answer:
      "Tax documents such as 1099 forms are available on the Documents page once they have been generated and uploaded by your property manager. You can also filter by document type.",
  },
  {
    question: "How do I view my property details?",
    answer:
      "Go to the Properties page to see all properties assigned to you, including unit details, occupancy status, rent amounts, and current tenant information.",
  },
  {
    question: "What does occupancy rate mean?",
    answer:
      "The occupancy rate is the percentage of your total units that are currently occupied by tenants. A higher occupancy rate generally indicates better property performance.",
  },
  {
    question: "How do I contact my property manager?",
    answer:
      "You can reach your property manager through the contact information provided in your owner agreement or through the contact details displayed in the app. For urgent matters, we recommend calling directly.",
  },
];

export default function OwnerHelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Find answers to common questions about the owner portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {faqs.map((faq, index) => (
              <div key={index}>
                <button
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                  className="flex w-full items-center justify-between py-4 text-left text-sm font-medium transition-colors hover:text-primary"
                >
                  <span>{faq.question}</span>
                  {openIndex === index ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {openIndex === index && (
                  <p className="pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Still need help?</p>
            <p className="text-sm text-muted-foreground">
              Contact your property manager directly or reach out to DoorStax
              support at{" "}
              <a
                href="mailto:support@doorstax.com"
                className="text-primary hover:underline"
              >
                support@doorstax.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
