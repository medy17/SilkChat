import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components"
import {
    ModerationAppeal,
    ModerationCaseDetails,
    type ModerationEmailBaseProps
} from "./moderation-shared"
import {
    emailBody,
    emailOuter,
    logoSection,
    logoImage,
    emailCard,
    emailHeading,
    emailText,
    emailFooter
} from "./styles"

export type ModerationWarningEmailTemplateProps = ModerationEmailBaseProps

export const ModerationWarningEmailTemplate = ({
    name,
    caseId,
    violation,
    policyReference,
    contentAction,
    termsUrl,
    logoUrl,
    supportEmail
}: ModerationWarningEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>We reviewed activity on your SilkChat account</Preview>
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
                    <Text style={emailHeading}>A warning about your account</Text>
                    <Text style={emailText}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={emailText}>
                        We reviewed activity on your SilkChat account and found something that goes
                        against our Terms of Service. This is a warning only. Your account is in
                        good standing and nothing about your access has changed.
                    </Text>
                    <ModerationCaseDetails
                        caseId={caseId}
                        violation={violation}
                        policyReference={policyReference}
                        contentAction={contentAction}
                    />
                    <Text style={emailText}>
                        Please don&apos;t repeat this. If it happens again, we may add a strike to
                        your account, and repeated strikes lead to a ban.
                    </Text>
                    <ModerationAppeal
                        caseId={caseId}
                        supportEmail={supportEmail}
                        termsUrl={termsUrl}
                    />
                </Section>
                <Text style={emailFooter}>
                    © 2026 SilkChat. This is a service notice about your account. You can&apos;t
                    unsubscribe from it.
                </Text>
            </Container>
        </Body>
    </Html>
)
