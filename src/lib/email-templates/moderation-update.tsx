import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text
} from "@react-email/components"
import { ModerationCaseDetails } from "./moderation-shared"
import {
    divider,
    emailBody,
    emailCard,
    emailFooter,
    emailHeading,
    emailOuter,
    emailText,
    inlineLink,
    logoImage,
    logoSection,
    signature,
    supportText
} from "./styles"

export type ModerationUpdateKind =
    | "appeal_denied"
    | "overturned"
    | "lifted"
    | "shortened"
    | "extended"
type ModerationActionName = "warning" | "strike" | "suspension" | "ban"

export interface ModerationUpdateContent {
    kind: ModerationUpdateKind
    action: ModerationActionName
    viaAppeal?: boolean
    restoresAccess?: boolean
    // Shortened or extended only, already formatted.
    newEnd?: string
}

type UpdateCopy = {
    subject: string
    heading: string
    paragraphs: string[]
    // Good news reads like the welcome email and doesn't restate the violation.
    warm: boolean
}

const neutral = (copy: Omit<UpdateCopy, "warm">): UpdateCopy => ({ ...copy, warm: false })
const warm = (copy: Omit<UpdateCopy, "warm">): UpdateCopy => ({ ...copy, warm: true })

// Shared by the HTML template and the plain-text body so the two can't drift.
export const getModerationUpdateCopy = ({
    kind,
    action,
    viaAppeal,
    restoresAccess,
    newEnd
}: ModerationUpdateContent): UpdateCopy => {
    const welcomeBack = restoresAccess
        ? [
              "You can sign in again now. Your chats, files, and images are right where you left them."
          ]
        : []

    switch (kind) {
        case "appeal_denied":
            return neutral({
                subject: "Your appeal was reviewed",
                heading: "We reviewed your appeal",
                paragraphs: [
                    `Thanks for taking the time to appeal. A person reviewed it, and the ${action} on your account stands.`
                ]
            })
        case "overturned":
            return viaAppeal
                ? warm({
                      subject: "Your appeal was accepted",
                      heading: "Your appeal was accepted",
                      paragraphs: [
                          `Thanks for taking the time to appeal. A person reviewed it and agreed with you, so we've withdrawn the ${action}. Sorry for the trouble.`,
                          "It no longer counts against your account.",
                          ...welcomeBack
                      ]
                  })
                : warm({
                      subject: `We've withdrawn a ${action} on your account`,
                      heading: "We got this one wrong",
                      paragraphs: [
                          `We took another look and withdrew the ${action} on your account. Sorry for the trouble.`,
                          "It no longer counts against your account.",
                          ...welcomeBack
                      ]
                  })
        case "lifted":
            return restoresAccess
                ? warm({
                      subject: "Your SilkChat access is back",
                      heading: "Welcome back",
                      paragraphs: [`We've ended your ${action} early.`, ...welcomeBack]
                  })
                : neutral({
                      subject: `Your ${action} has ended early`,
                      heading: `Your ${action} has ended early`,
                      paragraphs: [
                          `We've ended the ${action} on your account early. Another restriction on your account is still in effect.`
                      ]
                  })
        case "shortened":
            if (action === "strike") {
                return warm({
                    subject: "Your strike will expire sooner",
                    heading: "Your strike expires sooner",
                    paragraphs: [`We've shortened your strike. It now expires on ${newEnd}.`]
                })
            }
            return action === "ban"
                ? warm({
                      subject: "Your ban has been reduced",
                      heading: "Your ban has been reduced",
                      paragraphs: [
                          `We've reviewed your ban and it's no longer permanent. It now ends on ${newEnd}, and you'll be able to sign in again then.`
                      ]
                  })
                : warm({
                      subject: "Your suspension ends sooner",
                      heading: "Your suspension ends sooner",
                      paragraphs: [
                          `We've shortened your suspension. It now ends on ${newEnd}, and you'll be able to sign in again then.`
                      ]
                  })
        case "extended":
            return action === "strike"
                ? neutral({
                      subject: "Your strike has been extended",
                      heading: "Your strike has been extended",
                      paragraphs: [`Your strike now expires on ${newEnd}.`]
                  })
                : neutral({
                      subject: `Your ${action} has been extended`,
                      heading: `Your ${action} has been extended`,
                      paragraphs: [`Your ${action} now ends on ${newEnd}.`]
                  })
    }
}

export interface ModerationUpdateEmailTemplateProps extends ModerationUpdateContent {
    name?: string
    caseId: string
    violation: string
    note?: string
    logoUrl: string
    supportEmail: string
}

export const ModerationUpdateEmailTemplate = (props: ModerationUpdateEmailTemplateProps) => {
    const copy = getModerationUpdateCopy(props)
    return (
        <Html>
            <Head />
            <Preview>{copy.subject}</Preview>
            <Body style={emailBody}>
                <Container style={emailOuter}>
                    <Section style={emailCard}>
                        <Section style={logoSection}>
                            <Img
                                src={props.logoUrl}
                                alt="SilkChat"
                                width="120"
                                height="32"
                                style={logoImage}
                            />
                        </Section>
                        <Text style={emailHeading}>{copy.heading}</Text>
                        <Text style={emailText}>{props.name ? `Hi ${props.name},` : "Hi,"}</Text>
                        {copy.paragraphs.map((paragraph) => (
                            <Text key={paragraph} style={emailText}>
                                {paragraph}
                            </Text>
                        ))}
                        <ModerationCaseDetails
                            caseId={props.caseId}
                            violation={copy.warm ? undefined : props.violation}
                            extraRows={props.note ? [{ label: "Note", value: props.note }] : []}
                        />
                        <Hr style={divider} />
                        <Text style={supportText}>
                            Questions? Contact{" "}
                            <Link href={`mailto:${props.supportEmail}`} style={inlineLink}>
                                {props.supportEmail}
                            </Link>{" "}
                            with your case ID.
                        </Text>
                        <Text style={signature}>
                            {copy.warm ? "The SilkChat Team" : "SilkChat Trust & Safety"}
                        </Text>
                    </Section>
                    <Text style={emailFooter}>
                        © 2026 SilkChat. This is a service notice about your account. You can&apos;t
                        unsubscribe from it.
                    </Text>
                </Container>
            </Body>
        </Html>
    )
}
