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

interface WelcomeEmailTemplateProps {
    name?: string
    appUrl: string
    logoUrl: string
    supportEmail: string
}

export const WelcomeEmailTemplate = ({
    name,
    appUrl,
    logoUrl,
    supportEmail
}: WelcomeEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>Your SilkChat account is ready</Preview>
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
                    <Text style={emailHeading}>Welcome to SilkChat</Text>
                    <Text style={emailText}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={emailText}>
                        Your workspace is ready. Bring the models you use into one place, search the
                        web, generate images, and work with live code previews without breaking your
                        flow.
                    </Text>
                    <Section style={buttonSection}>
                        <Link href={appUrl} style={primaryButton}>
                            Start chatting
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
                <Text style={emailFooter}>
                    © 2026 SilkChat. You&apos;re receiving this email because an account was created
                    at silkchat.dev.
                </Text>
            </Container>
        </Body>
    </Html>
)
