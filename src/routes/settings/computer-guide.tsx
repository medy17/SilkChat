import { SettingsLayout } from "@/components/settings/settings-layout"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@/components/ui/accordion"
import { Link, createFileRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"

export const Route = createFileRoute("/settings/computer-guide")({
    component: ComputerGuidePage
})

const QUESTIONS: Array<{ id: string; question: string; answer: ReactNode }> = [
    {
        id: "what",
        question: "What is a key?",
        answer: (
            <p>
                A key is a password made for apps. It lets Silky act for you on another service,
                such as pushing code to GitHub. You create it on that service, then paste it here.
            </p>
        )
    },
    {
        id: "add",
        question: "How do I add one?",
        answer: (
            <ol className="list-decimal space-y-1 pl-5">
                <li>
                    Open{" "}
                    <Link to="/settings/computer" className="underline underline-offset-4">
                        Computer
                    </Link>{" "}
                    and switch on the service you want. For anything not listed, choose Add key.
                </li>
                <li>Follow the link to get a key.</li>
                <li>Copy the key, paste it in, and choose Turn on.</li>
                <li>Ask Silky to do something with that service.</li>
            </ol>
        )
    },
    {
        id: "can-use",
        question: "What can Silky do with a key?",
        answer: (
            <p>
                Anything the key allows, without asking first, for as long as the key is on. That
                can include changing your data or spending your money on that service. Give each key
                only the access Silky needs.
            </p>
        )
    },
    {
        id: "see",
        question: "Can Silky see my key?",
        answer: (
            <p>
                Not normally. Keys are stored encrypted and never sit on Silky's computer. They're
                added to requests after they leave it, so Silky uses a key without being given it.
                The one exception is a service that repeats back what it receives, which could
                reveal the key to Silky. That's another reason to use limited keys, and only add
                keys for services you trust.
            </p>
        )
    },
    {
        id: "stop",
        question: "How do I stop Silky using a key?",
        answer: (
            <p>
                Turn it off in the list. Silky can't use it in any command after that. Remove it to
                delete it from SilkChat. If you think a key has leaked, also revoke it on the
                service that issued it.
            </p>
        )
    },
    {
        id: "safest",
        question: "Which kind of key is safest?",
        answer: (
            <p>
                Use the most limited key the service offers, and set an expiry date if you can. On
                GitHub, that's a fine-grained token limited to specific repositories. On Stripe, use
                a test or restricted key rather than your live secret key.
            </p>
        )
    },
    {
        id: "github",
        question: "How do I get a GitHub token?",
        answer: (
            <ol className="list-decimal space-y-1 pl-5">
                <li>
                    Open{" "}
                    <a
                        href="https://github.com/settings/personal-access-tokens/new"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                    >
                        GitHub's new token page
                    </a>
                    .
                </li>
                <li>Give it a name and an expiry date.</li>
                <li>Under Repository access, choose only the repositories Silky should use.</li>
                <li>Under Permissions, set Contents and Pull requests to read and write.</li>
                <li>Generate the token, copy it, and paste it into the GitHub card.</li>
            </ol>
        )
    },
    {
        id: "expiry",
        question: "What happens when a key expires?",
        answer: (
            <p>
                Add the expiry date when you save a key. In the last 7 days, the key is flagged in
                your list and Silky tells you if it uses it. SilkChat can't renew keys, so create a
                new one on the service and add it here. Expired keys stop working on the service,
                and leaving the date blank means no reminder.
            </p>
        )
    },
    {
        id: "files",
        question: "How do I get files off Silky's computer?",
        answer: (
            <p>
                Ask Silky. It can attach what you need to its reply, up to 25 MB at a time, and it
                can push code to a repository using a GitHub key.
            </p>
        )
    },
    {
        id: "storage",
        question: "What does storage cost?",
        answer: (
            <p>
                Files on Silky's computer use a little of your monthly usage each day, including
                while it's asleep or archived. The Details section on the Computer page shows how
                much it holds and what share of your usage that takes. Going over your usage limit
                doesn't delete anything.
            </p>
        )
    },
    {
        id: "storage-limit",
        question: "What happens if Silky's computer is over my storage limit?",
        answer: (
            <p>
                We'll email you, then again 7 days and 1 day before its files are deleted, 35 days
                after it went over. Ask Silky to clear out what you don't need, or upgrade your
                plan, to keep them. The limit checks each time the computer goes to sleep.
            </p>
        )
    },
    {
        id: "cost",
        question: "Do keys cost anything?",
        answer: (
            <p>
                Storing a key is free. If Silky uses a paid service with your key, that service
                bills you directly, on top of any SilkChat credits Silky's computer uses.
            </p>
        )
    },
    {
        id: "broken",
        question: "Why isn't my key working?",
        answer: (
            <ul className="list-disc space-y-1 pl-5">
                <li>Check that the key is on, and hasn't expired on the service.</li>
                <li>Check that the key has the permissions the task needs.</li>
                <li>
                    Keys work with web services. Database passwords and SSH keys aren't supported
                    yet.
                </li>
            </ul>
        )
    }
]

function ComputerGuidePage() {
    return (
        <SettingsLayout title="Keys guide" description="How Silky uses the keys you add.">
            <Accordion type="single" collapsible>
                {QUESTIONS.map(({ id, question, answer }) => (
                    <AccordionItem key={id} value={id}>
                        <AccordionTrigger>{question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                            {answer}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </SettingsLayout>
    )
}
