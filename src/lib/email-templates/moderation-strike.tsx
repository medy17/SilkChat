import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components"
import { getRemainingStrikesCopy } from "../../../convex/lib/moderation"
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
    emailFooter,
    emailTextStrong,
    listSection,
    listItem
} from "./styles"

export interface ModerationStrikeEmailTemplateProps extends ModerationEmailBaseProps {
    strikeNumber: number
    strikeLimit: number
    expiresAt?: string
    restrictions?: string[]
}

export const ModerationStrikeEmailTemplate = ({
    name,
    caseId,
    violation,
    policyReference,
    contentAction,
    strikeNumber,
    strikeLimit,
    expiresAt,
    restrictions = [],
    termsUrl,
    logoUrl,
    supportEmail,
    appealUrl
}: ModerationStrikeEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>{`Strike ${strikeNumber} of ${strikeLimit} on your SilkChat account`}</Preview>
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
                    <Text style={emailHeading}>Your account received a strike</Text>
                    <Text style={emailText}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={emailText}>
                        We reviewed activity on your SilkChat account and confirmed a violation of
                        our Terms of Service. We&apos;ve added a strike to your account.
                    </Text>
                    <ModerationCaseDetails
                        caseId={caseId}
                        violation={violation}
                        policyReference={policyReference}
                        contentAction={contentAction}
                        extraRows={[
                            { label: "Strikes", value: `${strikeNumber} of ${strikeLimit}` },
                            ...(expiresAt ? [{ label: "Strike expires", value: expiresAt }] : [])
                        ]}
                    />
                    {restrictions.length > 0 ? (
                        <>
                            <Text style={emailText}>
                                While this strike is active, the following limits apply:
                            </Text>
                            <Section style={listSection}>
                                {restrictions.map((restriction) => (
                                    <Text key={restriction} style={listItem}>
                                        • {restriction}
                                    </Text>
                                ))}
                            </Section>
                        </>
                    ) : null}
                    <Text style={emailTextStrong}>
                        {getRemainingStrikesCopy(strikeNumber, strikeLimit)}
                    </Text>
                    <Text style={emailText}>
                        Your chats, files, and generated images are not affected.
                        {expiresAt
                            ? " This strike will be removed on the date shown above if there are no further violations."
                            : ""}
                    </Text>
                    <ModerationAppeal
                        caseId={caseId}
                        supportEmail={supportEmail}
                        termsUrl={termsUrl}
                        appealUrl={appealUrl}
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
