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

interface AccountExportEmailTemplateProps {
    downloadUrl: string
    logoUrl: string
    supportEmail: string
}

export const AccountExportEmailTemplate = ({
    downloadUrl,
    logoUrl,
    supportEmail
}: AccountExportEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>Your encrypted SilkChat account export is ready</Preview>
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
                    <Text style={emailHeading}>Your account export is ready</Text>
                    <Text style={emailText}>
                        Your SilkChat account archive has been encrypted and is ready to download.
                    </Text>
                    <Section style={buttonSection}>
                        <Link href={downloadUrl} style={primaryButton}>
                            Download encrypted ZIP
                        </Link>
                    </Section>
                    <Text style={emailText}>
                        Open the ZIP with the one-time password shown when you requested the export.
                        SilkChat does not retain that password and cannot recover it for you.
                    </Text>
                    <Text style={emailText}>
                        If you did not request this export, you can ignore this email. The stored
                        archive cannot be decrypted without your one-time key.
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
                    © 2026 SilkChat. You&apos;re receiving this email because an account export was
                    requested at silkchat.dev.
                </Text>
            </Container>
        </Body>
    </Html>
)

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

const emailBody = {
    backgroundColor: "#fcfcfc",
    color: "#000000",
    fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: "0",
    padding: "0"
}

const emailOuter = {
    margin: "0 auto",
    maxWidth: "600px",
    padding: "40px 20px"
}

const logoSection = {
    paddingBottom: "20px",
    textAlign: "center" as const
}

const logoImage = {
    display: "block",
    height: "auto",
    margin: "0 auto"
}

const buttonSection = {
    margin: "4px 0 24px",
    textAlign: "center" as const
}

const emailCard = {
    backgroundColor: "#ffffff",
    border: "1px solid #e4e4e4",
    borderRadius: "8px",
    padding: "32px"
}

const emailHeading = {
    color: "#000000",
    fontSize: "28px",
    fontWeight: "600",
    lineHeight: "1.25",
    margin: "0 0 16px"
}

const emailText = {
    color: "#171717",
    fontSize: "16px",
    lineHeight: "1.6",
    margin: "0 0 20px"
}

const primaryButton = {
    backgroundColor: "#000000",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "1",
    padding: "14px 22px",
    textDecoration: "none"
}

const divider = {
    borderColor: "#e4e4e4",
    margin: "28px 0"
}

const supportText = {
    color: "#525252",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 20px"
}

const inlineLink = {
    color: "#000000",
    textDecoration: "underline"
}

const signature = {
    color: "#000000",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0"
}

const emailFooter = {
    color: "#525252",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "20px 0 0",
    textAlign: "center" as const
}
