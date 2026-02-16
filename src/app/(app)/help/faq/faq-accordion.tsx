"use client";

import type React from "react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

const FAQ_ITEMS = [
  {
    id: "reported-nothing-happened",
    question: "I reported an issue but nothing happened",
    answer: (
      <>
        When you report an issue, it starts with a &ldquo;new&rdquo; status.
        Operators review new issues and prioritize based on severity. Unplayable
        issues get attention first, while cosmetic issues may take longer. Check
        the issue page to see its current status.
      </>
    ),
  },
  {
    id: "change-password",
    question: "How do I change my password?",
    answer: (
      <>
        Go to Settings and use the password change option. If you have a
        username-only account (no email), you&rsquo;ll need to contact an admin
        to reset your password.
      </>
    ),
  },
  {
    id: "email-visibility",
    question: "Who can see my email address?",
    answer: (
      <>
        Only admins and you can see your email address. Other users see your
        display name. Your email is never shown publicly.
      </>
    ),
  },
  {
    id: "cant-edit-issue",
    question: "I can't edit an issue I reported",
    answer: (
      <>
        If you reported as a guest (without signing in), you can only edit your
        own issues. Members can edit any issue they reported. See the full
        permissions breakdown on the{" "}
        <Link href="/help/permissions" className="text-primary underline">
          Roles &amp; Permissions
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    id: "become-member",
    question: "How do I become a member?",
    answer: (
      <>
        Members are invited by an admin. If you&rsquo;re a regular at Austin
        Pinball Collective and want member access, talk to an organizer at the
        venue.
      </>
    ),
  },
  {
    id: "unplayable-meaning",
    question: 'What does "unplayable" mean?',
    answer: (
      <>
        Unplayable means the machine should be considered out of service — for
        example, a ball is stuck, flippers are dead, or the game won&rsquo;t
        start. See the full severity guide on the{" "}
        <Link href="/help/reporting" className="text-primary underline">
          Reporting Issues
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    id: "notifications",
    question: "How do I get notifications?",
    answer: (
      <>
        Go to Settings to configure your notification preferences. You can also
        &ldquo;watch&rdquo; specific machines or issues to get notified when
        their status changes.
      </>
    ),
  },
] as const;

export function FaqAccordion(): React.JSX.Element {
  return (
    <Accordion>
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.id}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground">{item.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
