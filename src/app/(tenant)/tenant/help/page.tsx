"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LogIn,
  CreditCard,
  FileText,
  Wrench,
  RefreshCw,
  Receipt,
  MessageSquare,
  Search,
  Mail,
  Phone,
  HelpCircle,
  Users,
  ChevronDown,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  icon: LucideIcon;
  items: FaqItem[];
}

const QUICK_START_STEPS = [
  {
    step: 1,
    icon: LogIn,
    title: "Log Into Your Portal",
    description: "Access your dashboard to manage everything",
    href: "/tenant",
  },
  {
    step: 2,
    icon: CreditCard,
    title: "Pay Your Rent",
    description: "Pay via ACH bank transfer or credit/debit card",
    href: "/tenant/pay",
  },
  {
    step: 3,
    icon: FileText,
    title: "View Your Lease",
    description: "Access lease details and download documents",
    href: "/tenant/leases",
  },
  {
    step: 4,
    icon: Wrench,
    title: "Submit Tickets",
    description: "Report maintenance issues and track their progress",
    href: "/tenant/tickets/new",
  },
];

const FEATURE_OVERVIEW = [
  {
    icon: CreditCard,
    title: "Pay Rent",
    description: "Pay your rent securely online",
    href: "/tenant/pay",
  },
  {
    icon: Receipt,
    title: "Payment History",
    description: "View all past payments and receipts",
    href: "/tenant/history",
  },
  {
    icon: FileText,
    title: "Lease Details",
    description: "Access lease terms and documents",
    href: "/tenant/leases",
  },
  {
    icon: RefreshCw,
    title: "Autopay",
    description: "Set up automatic monthly payments",
    href: "/tenant/autopay",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    description: "Submit and track service requests",
    href: "/tenant/tickets",
  },
  {
    icon: MessageSquare,
    title: "Messages",
    description: "Communicate with your manager",
    href: "/tenant/messages",
  },
];

const FAQ_DATA: FaqCategory[] = [
  {
    title: "Paying Rent",
    icon: CreditCard,
    items: [
      {
        question: "How do I pay rent?",
        answer:
          "Go to Pay Rent from your dashboard or the sidebar. Choose your payment method (ACH bank transfer or credit/debit card), confirm the amount, and submit your payment.",
      },
      {
        question: "What's the difference between ACH and card?",
        answer:
          "ACH is a bank transfer with no extra fee to you. Card payments have a 3.25% convenience fee added to your total. ACH payments typically take 1-3 business days to process, while card payments are processed immediately.",
      },
      {
        question: "Can I set up autopay?",
        answer:
          "Yes, go to Autopay from the sidebar to enable automatic payments. Choose your saved payment method and the system will automatically pay your rent each month on the due date.",
      },
      {
        question: "What is a convenience fee?",
        answer:
          "A convenience fee is a small percentage-based charge applied when you pay rent using a credit or debit card. This fee covers card processing costs. ACH bank transfers do not have a convenience fee.",
      },
      {
        question: "When is my rent due?",
        answer:
          "Your rent due date is specified in your lease agreement and is displayed on your dashboard. Most leases set rent due on the 1st of each month. Check your lease details or dashboard for your specific due date.",
      },
      {
        question: "Can I make a partial payment?",
        answer:
          "Partial payments depend on your manager's settings. Some managers allow partial payments, while others require the full balance to be paid at once. If partial payments are enabled, you can enter a custom amount on the Pay Rent page.",
      },
      {
        question: "How long does ACH take to process?",
        answer:
          "ACH bank transfers typically take 1-3 business days to process. The payment will show as 'Processing' in your payment history until it clears. We recommend submitting ACH payments a few days before your due date to ensure on-time delivery.",
      },
    ],
  },
  {
    title: "Lease",
    icon: FileText,
    items: [
      {
        question: "Where can I find my lease?",
        answer:
          "Go to the Lease section from the sidebar to view your current lease details, including the lease term, monthly rent amount, and any attached lease documents.",
      },
      {
        question: "When does my lease expire?",
        answer:
          "Your lease start and end dates are shown on both your dashboard overview and the Lease page. You will also receive notifications as your lease expiration date approaches.",
      },
      {
        question: "Can I download my lease document?",
        answer:
          "Yes. Navigate to the Lease page and look for the download button next to your lease document. You can save a PDF copy of your signed lease to your device for your records.",
      },
      {
        question: "What are lease addendums?",
        answer:
          "Lease addendums are additional documents attached to your lease that modify or add terms to the original agreement. Common addendums include pet policies, parking agreements, and move-in condition reports. You can view any addendums from the Lease page.",
      },
      {
        question: "When does my lease renew?",
        answer:
          "Lease renewal terms vary by agreement. Your landlord may offer renewal options as your lease end date approaches. Check your lease details for renewal terms, and watch for notifications or messages from your landlord about renewal.",
      },
    ],
  },
  {
    title: "Maintenance & Tickets",
    icon: Wrench,
    items: [
      {
        question: "How do I submit a maintenance request?",
        answer:
          "Go to Tickets > New Ticket. Describe the issue in detail, select a priority level (Low, Medium, High, or Urgent), and submit. Your landlord or property manager will be notified immediately.",
      },
      {
        question: "How long does it take to resolve a ticket?",
        answer:
          "Response times vary depending on the priority and nature of the issue. High and urgent priority tickets are typically addressed within 24 hours. You can track the status of your ticket from the Tickets page.",
      },
      {
        question: "What priority levels are available?",
        answer:
          "There are four priority levels: Low (cosmetic or minor issues), Medium (non-urgent functional problems), High (significant issues affecting daily life), and Urgent (emergencies like water leaks, no heat, or safety hazards). Choose the level that best matches your situation.",
      },
      {
        question: "Can I add photos to tickets?",
        answer:
          "Yes, you can attach photos when creating a new ticket. Adding photos helps your landlord or maintenance team understand the issue more quickly and can speed up resolution. You can upload images directly from your device.",
      },
      {
        question: "How will I know when my ticket is updated?",
        answer:
          "You will receive notifications when your ticket status changes or when your landlord adds a comment. You can also check the Tickets page at any time to see the latest status and any messages related to your request.",
      },
    ],
  },
  {
    title: "Account",
    icon: Users,
    items: [
      {
        question: "How do I update my profile?",
        answer:
          "Go to Settings from the sidebar to update your name, email address, and phone number. Changes take effect immediately.",
      },
      {
        question: "How do I change my password?",
        answer:
          "Go to Settings > Change Password. Enter your current password and your new password, then confirm the change.",
      },
      {
        question: "How do I enable autopay?",
        answer:
          "Navigate to the Autopay page from the sidebar. Select your preferred saved payment method (ACH or card), review the settings, and toggle autopay on. Your rent will be automatically paid each month on your due date.",
      },
      {
        question: "Can I view my payment receipts?",
        answer:
          "Yes. Go to the Payment History page from the sidebar to see a complete list of all past payments. Each entry shows the date, amount, payment method, and status. You can view detailed receipt information for any transaction.",
      },
    ],
  },
  {
    title: "Roommates & Rent Splits",
    icon: Users,
    items: [
      {
        question: "How do rent splits work?",
        answer:
          "If your landlord has enabled rent splitting, each roommate on the lease is assigned a portion of the total rent. Each person can log into their own portal and pay their individual share independently.",
      },
      {
        question: "Can I see what my roommates owe?",
        answer:
          "You can see the overall payment status for your unit on your dashboard. However, for privacy reasons, detailed payment information for individual roommates is only visible to the landlord or property manager.",
      },
      {
        question: "What if my roommate doesn't pay?",
        answer:
          "If a roommate misses their payment, the remaining balance will still be due on the unit. Contact your landlord or property manager to discuss the situation. You can also reach out to your roommate directly. Ultimately, all tenants on the lease share responsibility for the full rent amount.",
      },
    ],
  },
  {
    title: "Messages",
    icon: MessageSquare,
    items: [
      {
        question: "How do I read announcements?",
        answer:
          "Announcements from your landlord appear in the Messages section, accessible from the sidebar. New announcements will also trigger a notification so you don't miss important updates about your property.",
      },
      {
        question: "What does 'Acknowledge' mean?",
        answer:
          "Some messages from your landlord require acknowledgment. Clicking 'Acknowledge' confirms that you have read and understood the message. This helps your landlord know that important information has been received by all tenants.",
      },
      {
        question: "Can I reply to messages?",
        answer:
          "Yes, you can reply to messages from your landlord directly within the Messages section. This creates a conversation thread so all communication is organized in one place. You will be notified when you receive a new reply.",
      },
    ],
  },
];

export default function TenantHelpPage() {
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const query = search.toLowerCase().trim();

  const filteredCategories = FAQ_DATA.map((category) => ({
    ...category,
    items: category.items.filter(
      (item) =>
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
    ),
  })).filter((category) => category.items.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Help & Support"
        description="Find answers to common questions or contact our support team."
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search help articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Quick Start Guide */}
      {!query && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Quick Start Guide</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {QUICK_START_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <Link key={step.step} href={step.href}>
                  <Card className="hover:border-primary/30 cursor-pointer transition-all card-hover h-full">
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                        {step.step}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-purple-600" />
                          <h3 className="font-semibold">{step.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Feature Overview */}
      {!query && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Feature Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_OVERVIEW.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.title} href={feature.href}>
                  <Card className="hover:border-primary/30 cursor-pointer transition-all card-hover h-full">
                    <CardContent className="flex items-start gap-3 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ Accordion */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          {query ? "Search Results" : "Frequently Asked Questions"}
        </h2>

        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No results found for &quot;{search}&quot;. Try a different
                search term or contact support below.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isOpen = openCategory === category.title;
              return (
                <Card key={category.title}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-4 text-left"
                    onClick={() =>
                      setOpenCategory(isOpen ? null : category.title)
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-base font-semibold">
                        {category.title}
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <CardContent className="pt-0">
                      <Accordion type="single" collapsible className="w-full">
                        {category.items.map((item, idx) => (
                          <AccordionItem
                            key={idx}
                            value={`${category.title}-${idx}`}
                          >
                            <AccordionTrigger className="text-left">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {item.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Contact Support */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need more help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Our support team is here to assist you with any questions or issues.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <a
              href="mailto:support@doorstax.com"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              support@doorstax.com
            </a>
            <a
              href="tel:+18005553667"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone className="h-4 w-4" />
              (800) 555-DOOR
              <span className="text-xs text-muted-foreground">(Software Support)</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
