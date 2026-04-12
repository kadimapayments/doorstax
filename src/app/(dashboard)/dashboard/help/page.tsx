"use client";

export const dynamic = "force-dynamic";

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
  Building,
  Building2,
  Users,
  CreditCard,
  DollarSign,
  BarChart3,
  FileText,
  Wrench,
  Search,
  Mail,
  Phone,
  HelpCircle,
  MessageSquare,
  Ticket,
  ChevronDown,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Quick-Start Steps                                                  */
/* ------------------------------------------------------------------ */

interface Step {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    icon: Building,
    title: "Add Your Properties",
    description: "Enter property details and create units",
    href: "/dashboard/properties/new",
  },
  {
    number: 2,
    icon: Users,
    title: "Invite Your Tenants",
    description: "Send invitations or import tenants in bulk",
    href: "/dashboard/tenants/invite",
  },
  {
    number: 3,
    icon: CreditCard,
    title: "Complete Merchant Application",
    description: "Get approved to accept payments",
    href: "/dashboard/onboarding",
  },
  {
    number: 4,
    icon: DollarSign,
    title: "Collect Rent",
    description: "Tenants pay via ACH or card through their portal",
    href: "/dashboard/payments",
  },
  {
    number: 5,
    icon: BarChart3,
    title: "Track Performance",
    description: "Monitor income, expenses, and reports",
    href: "/dashboard/performance",
  },
];

/* ------------------------------------------------------------------ */
/*  Feature Overview                                                   */
/* ------------------------------------------------------------------ */

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}

const FEATURES: Feature[] = [
  {
    icon: Building2,
    title: "Properties",
    description: "Manage properties, units, and listings",
    href: "/dashboard/properties",
  },
  {
    icon: Users,
    title: "Tenants",
    description: "Add, invite, import, and manage tenants",
    href: "/dashboard/tenants",
  },
  {
    icon: CreditCard,
    title: "Payments",
    description: "Collect rent, charge tenants, schedule payments",
    href: "/dashboard/payments",
  },
  {
    icon: FileText,
    title: "Leases",
    description: "Create and track lease agreements",
    href: "/dashboard/leases",
  },
  {
    icon: Wrench,
    title: "Tickets",
    description: "Handle maintenance requests",
    href: "/dashboard/tickets",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Financial reports and analytics",
    href: "/dashboard/reports",
  },
];

/* ------------------------------------------------------------------ */
/*  FAQ Data                                                           */
/* ------------------------------------------------------------------ */

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  icon: LucideIcon;
  items: FaqItem[];
}

const FAQ_DATA: FaqCategory[] = [
  {
    title: "Getting Started",
    icon: HelpCircle,
    items: [
      {
        question: "How do I add my first property?",
        answer:
          "Go to Properties > Add Property. Enter the address, unit details, and rent amounts. Once saved, you can start adding units and assigning tenants.",
      },
      {
        question: "How do I set up payment collection?",
        answer:
          "Complete the Merchant Application under the onboarding banner on your dashboard. Once approved, tenants can pay via ACH (bank transfer) or credit/debit card directly through their portal.",
      },
      {
        question: "How do I complete the merchant application?",
        answer:
          "Click the onboarding banner on your dashboard or go to Settings > Payments. Fill out your business details, banking information for deposits, and identity verification. The application is typically reviewed within 1-2 business days.",
      },
      {
        question: "What payment methods do tenants have?",
        answer:
          "Tenants can pay rent through ACH (bank transfer) with a 1% fee capped at $20, or by credit/debit card with a 3.25% convenience surcharge. Both methods are available through the tenant portal once your merchant application is approved.",
      },
    ],
  },
  {
    title: "Properties & Units",
    icon: Building2,
    items: [
      {
        question: "How do I add units to a property?",
        answer:
          "Go to Properties, click on a property, then click Add Unit. Enter the unit number, bedroom/bathroom count, and rent amount.",
      },
      {
        question: "How do I list a unit for rent?",
        answer:
          'Edit the unit and enable "List for Rent". The unit will then appear on the public listings page where prospective tenants can view it and submit applications.',
      },
      {
        question: "How do I import properties from a spreadsheet?",
        answer:
          "Go to Properties > Import CSV. Download the template spreadsheet, fill it in with your property and unit data, then upload it. The system will validate and import your properties.",
      },
      {
        question: "What does listing a unit do?",
        answer:
          "Listing a unit makes it publicly visible on your DoorStax listings page. Prospective tenants can view photos, rent amount, and unit details, and submit rental applications directly through the listing.",
      },
      {
        question: "Can I edit a property after creating it?",
        answer:
          "Yes. Go to Properties, click on the property you want to modify, then click the Edit button. You can update the address, name, and other details. Changes take effect immediately.",
      },
    ],
  },
  {
    title: "Tenants",
    icon: Users,
    items: [
      {
        question: "How do I add a tenant?",
        answer:
          "Go to Tenants > Add Tenant. Fill in their name, contact information, and assign them to a unit. You can also set their lease dates and rent amount.",
      },
      {
        question: "How do I invite a tenant to create their own account?",
        answer:
          "Go to Tenants > Invite Tenant. Enter their email address and select the unit to assign them to. They will receive an email invitation to create their account and start paying rent online.",
      },
      {
        question: "How does tenant import work?",
        answer:
          "Go to Tenants > Import CSV. Download the template, fill in tenant names, emails, phone numbers, and unit assignments, then upload. The system validates each row and creates tenant records in bulk, saving you time when onboarding many tenants at once.",
      },
      {
        question: "What happens when I invite a tenant?",
        answer:
          "The tenant receives an email with a link to create their DoorStax account. Once they sign up, they are automatically linked to their assigned unit and can view their balance, make payments, submit maintenance requests, and access their lease documents.",
      },
      {
        question: "How do rent splits work with roommates?",
        answer:
          "You can assign multiple tenants to the same unit. Each tenant can be given a specific rent split amount. Each roommate logs into their own portal and pays their individual portion. The system tracks each payment separately so you can see who has paid and who is still outstanding.",
      },
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    items: [
      {
        question: "How do tenants pay rent?",
        answer:
          "Tenants can pay via ACH (bank transfer) or credit/debit card from their tenant portal. They log in, go to Pay Rent, select their payment method, and submit the payment.",
      },
      {
        question: "What are the payment processing fees?",
        answer:
          "ACH payments: Flat fee per transaction (default $6, platform cost $2). Who pays depends on your fee schedule configuration — Owner, Tenant, or PM. Card payments: 3.25% convenience fee, paid by the tenant.",
      },
      {
        question: "How do I charge a tenant manually?",
        answer:
          "Go to Payments > Charge Tenant. Select the tenant from the dropdown, enter the amount and a description, then submit. The tenant will be notified of the charge.",
      },
      {
        question: "Can I schedule payments?",
        answer:
          "Yes. When charging a tenant you can set a future date for the charge. You can also set up recurring charges on a monthly basis. Scheduled charges are processed automatically on the specified date.",
      },
      {
        question: "How do I view payment details?",
        answer:
          "Go to Payments to see a list of all transactions. Click on any payment to view its full details, including the tenant, amount, payment method, processing fees, status, and timestamp.",
      },
      {
        question: "What happens when a payment fails?",
        answer:
          "If a payment fails (e.g., insufficient funds, expired card), the tenant is notified by email. The payment status is updated to Failed in your dashboard. The tenant can retry the payment from their portal. Failed ACH payments may incur a return fee.",
      },
    ],
  },
  {
    title: "Leases",
    icon: FileText,
    items: [
      {
        question: "How do I create a lease?",
        answer:
          "Go to Leases > Create Lease. Select the tenant, unit, lease start and end dates, and monthly rent amount. You can also add any special terms or notes.",
      },
      {
        question: "Can I upload a lease document?",
        answer:
          "Yes, when creating or editing a lease you can attach a PDF document. This allows you to keep a digital copy of the signed lease alongside the lease details in the system.",
      },
      {
        question: "How do I add an addendum?",
        answer:
          "Open an existing lease and click Add Addendum. You can enter additional terms or upload a PDF of the signed addendum. The addendum is linked to the original lease and both landlord and tenant can view it.",
      },
      {
        question: "Can tenants see the lease document?",
        answer:
          "Yes. Any lease documents or addendums you upload are visible to the tenant through their portal under the Lease section. Tenants can view and download copies of their lease agreements at any time.",
      },
    ],
  },
  {
    title: "Expenses",
    icon: DollarSign,
    items: [
      {
        question: "How do I track expenses?",
        answer:
          "Go to Expenses > Add Expense. Enter the amount, select a category (e.g., Maintenance, Utilities, Insurance), add the vendor name, and associate it with a property.",
      },
      {
        question: "Can I set up recurring expenses?",
        answer:
          "Yes, when creating an expense you can mark it as recurring. Set the frequency (monthly, quarterly, annually) and the system will automatically create the expense entries for you.",
      },
      {
        question: "What expense categories are available?",
        answer:
          "DoorStax provides categories including Maintenance, Repairs, Utilities, Insurance, Property Tax, Management Fees, Landscaping, Cleaning, Legal, Advertising, and Other. These categories help you organize expenses for reporting and tax purposes.",
      },
      {
        question: "Can I attach receipts to expenses?",
        answer:
          "Yes. When creating or editing an expense you can upload an image or PDF of the receipt. Attachments are stored alongside the expense record and can be viewed or downloaded at any time for your records.",
      },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    items: [
      {
        question: "What reports are available?",
        answer:
          "DoorStax offers Payment Summary, Property Income, and Delinquency reports. Each can be generated for custom date ranges and downloaded in CSV or PDF format.",
      },
      {
        question: "How do I download a report?",
        answer:
          "Go to Reports, select your desired date range using the date pickers or quick presets (This Month, Last Month, Last 3 Months), choose the report type, then click the CSV or PDF button to download.",
      },
      {
        question: "What date ranges can I use?",
        answer:
          "You can use preset ranges such as This Month, Last Month, Last 3 Months, Last 6 Months, and Year to Date. You can also set a custom date range using the start and end date pickers for full flexibility.",
      },
      {
        question: "How do I track delinquent tenants?",
        answer:
          "Use the Delinquency report under Reports. It shows all tenants with outstanding balances, the amount owed, and how many days past due. You can filter by property and export the data for follow-up.",
      },
    ],
  },
  {
    title: "Team Members",
    icon: Users,
    items: [
      {
        question: "How do I add a team member?",
        answer:
          "Go to Settings > Team Members > Add Member. Enter their email, assign a role (Manager, Accounting, Caretaker, or Service Tech), and select which properties they should have access to.",
      },
      {
        question: "What can each role access?",
        answer:
          "Manager: full access to all features. Accounting: financial data including payments, expenses, and reports. Caretaker: properties and maintenance tickets. Service Tech: maintenance tickets only.",
      },
      {
        question: "Can I restrict team members to specific properties?",
        answer:
          "Yes. When adding or editing a team member you can select which properties they have access to. They will only see data (units, tenants, payments, tickets) related to their assigned properties.",
      },
    ],
  },
  {
    title: "Messages & Announcements",
    icon: MessageSquare,
    items: [
      {
        question: "How do I send an announcement?",
        answer:
          "Go to Messages > New Announcement. Select the recipients (all tenants, tenants of a specific property, or individual tenants), enter a subject and message body, then click Send. All selected tenants will receive an email notification and can view the announcement in their portal.",
      },
      {
        question: "Can I attach images to messages?",
        answer:
          "Yes. When composing an announcement or message you can attach images and files. This is useful for sharing photos of upcoming renovations, community notices, or important documents with your tenants.",
      },
      {
        question: "How do I know if tenants read my announcement?",
        answer:
          "Open the announcement from your Messages list to see read receipts. DoorStax tracks which tenants have viewed the announcement and displays a read/unread status next to each recipient.",
      },
    ],
  },
  {
    title: "Tickets",
    icon: Ticket,
    items: [
      {
        question: "How do I respond to a maintenance request?",
        answer:
          "Go to Tickets and click on the request. Add a comment with your response or update. You can also assign the ticket to a team member (such as a caretaker or service tech) and set a priority level.",
      },
      {
        question: "Can I attach images to ticket comments?",
        answer:
          "Yes. When adding a comment to a ticket you can attach photos. This is helpful for documenting the issue, sharing progress photos of repairs, or providing before-and-after evidence of completed work.",
      },
      {
        question: "How do I change ticket status?",
        answer:
          "Open the ticket and use the status dropdown to change it. Statuses include Open, In Progress, and Resolved. Tenants are notified when the status of their request changes so they stay informed throughout the process.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function HelpPage() {
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

      {/* ---------------------------------------------------------- */}
      {/*  Quick Start Guide                                          */}
      {/* ---------------------------------------------------------- */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Quick Start Guide</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step) => (
            <Link key={step.number} href={step.href}>
              <Card className="border-border hover:border-primary/30 cursor-pointer transition-all card-hover h-full">
                <CardContent className="p-5 text-center">
                  <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
                    {step.number}
                  </div>
                  <step.icon className="mx-auto mb-2 h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  Feature Overview                                           */}
      {/* ---------------------------------------------------------- */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Feature Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="border-border hover:border-primary/30 cursor-pointer transition-all card-hover h-full">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  FAQ Search                                                  */}
      {/* ---------------------------------------------------------- */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Frequently Asked Questions
        </h2>
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* FAQ Accordion */}
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

      {/* ---------------------------------------------------------- */}
      {/*  Contact Support                                             */}
      {/* ---------------------------------------------------------- */}
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
            <a
              href="tel:+18004649777"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone className="h-4 w-4" />
              (800) 464-9777
              <span className="text-xs text-muted-foreground">(Merchant Support)</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
