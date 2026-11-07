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
import {
    buttonSection,
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
    primaryButton,
    signature,
    supportText
} from "./styles"

interface ComputerDeletionNoticeEmailTemplateProps {
    name?: string
    when: string
    reason: "dormant" | "storage"
    computerUrl: string
    logoUrl: string
    supportEmail: string
}

export const ComputerDeletionNoticeEmailTemplate = ({
    name,
    when,
    reason,
    computerUrl,
    logoUrl,
    supportEmail
}: ComputerDeletionNoticeEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>{`The files on Silky's computer will be deleted ${when}`}</Preview>
        <Body style={emailBody}>
            <Container style={emailOuter}>
                <Section style={emailCard}>
                    <Section style={logoSection}>
                        <Img
                            src={logoUrl}
                            alt="SilkChat"
                            width="120"
                            height="32"
                            style={logoImage}
                        />
                    </Section>
                    <Text style={emailHeading}>Files on Silky's computer are expiring</Text>
                    <Text style={emailText}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={emailText}>
                        {reason === "storage"
                            ? `Silky's computer is over your plan's storage limit, so the files on it will be deleted ${when}. Ask Silky to clear out what you don't need, or upgrade your plan, to keep them.`
                            : `Silky's computer hasn't been used for a while, so the files on it will be deleted ${when}. Ask Silky to send you anything you want to keep, or to use its computer again, which keeps the files.`}
                    </Text>
                    <Section style={buttonSection}>
                        <Link href={computerUrl} style={primaryButton}>
                            Open Silky's computer
                        </Link>
                    </Section>
                    <Hr style={divider} />
                    <Text style={supportText}>
                        If you need help, contact us at{" "}
                        <Link href={`mailto:${supportEmail}`} style={inlineLink}>
                            {supportEmail}
                        </Link>
                        .
                    </Text>
                    <Text style={signature}>The SilkChat Team</Text>
                </Section>
                <Text style={emailFooter}>© 2026 SilkChat.</Text>
            </Container>
        </Body>
    </Html>
)
