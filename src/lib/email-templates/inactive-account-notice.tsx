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
    emailBody,
    emailOuter,
    logoSection,
    logoImage,
    buttonSection,
    emailCard,
    emailHeading,
    emailText,
    primaryButton,
    divider,
    supportText,
    inlineLink,
    signature,
    emailFooter
} from "./styles"

interface InactiveAccountNoticeEmailTemplateProps {
    name?: string
    appUrl: string
    accountUrl: string
    logoUrl: string
    supportEmail: string
}

export const InactiveAccountNoticeEmailTemplate = ({
    name,
    appUrl,
    accountUrl,
    logoUrl,
    supportEmail
}: InactiveAccountNoticeEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>Your chats, generated images, and files are still here</Preview>
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
                    <Text style={emailHeading}>Silky misses you</Text>
                    <Text style={emailText}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={emailText}>
                        It&apos;s been a while since you logged in. Your chats, generated images,
                        and files remain available whenever you&apos;re ready.
                    </Text>
                    <Section style={buttonSection}>
                        <Link href={appUrl} style={primaryButton}>
                            Return to SilkChat
                        </Link>
                    </Section>
                    <Text style={emailText}>
                        If you&apos;d like to export your SilkChat data or delete your account
                        instead, you can do that from your{" "}
                        <Link href={accountUrl} style={inlineLink}>
                            account settings
                        </Link>
                        .
                    </Text>
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
                <Text style={emailFooter}>
                    © 2026 SilkChat. This is the only inactivity reminder we will send for this
                    account.
                </Text>
            </Container>
        </Body>
    </Html>
)
