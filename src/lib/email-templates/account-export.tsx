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
