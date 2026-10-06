import {
    Body,
    Container,
    Head,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text
} from "@react-email/components"
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
    inlineLink,
    emailFooter
} from "./styles"

export interface ModerationBanEmailTemplateProps extends ModerationEmailBaseProps {
    endsAt?: string
}

export const ModerationBanEmailTemplate = ({
    name,
    caseId,
    violation,
    policyReference,
    contentAction,
    endsAt,
    termsUrl,
    logoUrl,
    supportEmail
}: ModerationBanEmailTemplateProps) => (
    <Html>
        <Head />
        <Preview>
            {endsAt
                ? `Your SilkChat account is suspended until ${endsAt}`
                : "Your SilkChat account has been banned"}
        </Preview>
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
                    <Text style={emailHeading}>
                        {endsAt
                            ? "Your account has been suspended"
                            : "Your account has been banned"}
                    </Text>
                    <Text style={emailText}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={emailText}>
                        {endsAt
                            ? "We reviewed activity on your SilkChat account and confirmed a serious or repeated violation of our Terms of Service. Your access is suspended until the date below. You won't be able to sign in or use SilkChat until then."
                            : "We reviewed activity on your SilkChat account and confirmed a serious or repeated violation of our Terms of Service. Your account has been permanently banned. You can no longer sign in or use SilkChat, and you may not create a new account."}
                    </Text>
                    <ModerationCaseDetails
                        caseId={caseId}
                        violation={violation}
                        policyReference={policyReference}
                        contentAction={contentAction}
                        extraRows={[
                            {
                                label: endsAt ? "Suspended until" : "Duration",
                                value: endsAt ?? "Permanent"
                            }
                        ]}
                    />
                    <Text style={emailText}>
                        Any active subscription has been cancelled. Under our Terms of Service,
                        unused time on a paid plan is not refunded when access ends because of a
                        violation.
                    </Text>
                    <Text style={emailText}>
                        If you need a copy of your data, email{" "}
                        <Link href={`mailto:${supportEmail}`} style={inlineLink}>
                            {supportEmail}
                        </Link>{" "}
                        from this address and include your case ID.
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
