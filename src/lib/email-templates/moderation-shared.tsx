import { Hr, Link, Section, Text } from "@react-email/components"
import {
    divider,
    supportText,
    inlineLink,
    signature,
    noticePanel,
    noticeRow,
    noticeLabel,
    noticeValue
} from "./styles"

interface ModerationCaseDetailsProps {
    caseId: string
    violation: string
    policyReference?: string
    contentAction?: string
    extraRows?: { label: string; value: string }[]
}

export const ModerationCaseDetails = ({
    caseId,
    violation,
    policyReference,
    contentAction,
    extraRows = []
}: ModerationCaseDetailsProps) => {
    const rows = [
        { label: "What we found", value: violation },
        ...(policyReference ? [{ label: "Policy", value: policyReference }] : []),
        ...(contentAction ? [{ label: "Action on content", value: contentAction }] : []),
        ...extraRows,
        { label: "Case ID", value: caseId }
    ]

    return (
        <Section style={noticePanel}>
            {rows.map((row) => (
                <Section key={row.label} style={noticeRow}>
                    <Text style={noticeLabel}>{row.label}</Text>
                    <Text style={noticeValue}>{row.value}</Text>
                </Section>
            ))}
        </Section>
    )
}

interface ModerationAppealProps {
    caseId: string
    supportEmail: string
    termsUrl: string
}

export const ModerationAppeal = ({ caseId, supportEmail, termsUrl }: ModerationAppealProps) => (
    <>
        <Hr style={divider} />
        <Text style={supportText}>
            If you think we got this wrong, email{" "}
            <Link
                href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Appeal: case ${caseId}`)}`}
                style={inlineLink}
            >
                {supportEmail}
            </Link>{" "}
            with your case ID and any context you&apos;d like us to consider. A person will review
            every appeal.
        </Text>
        <Text style={supportText}>
            You can read the rules that apply to every account in our{" "}
            <Link href={termsUrl} style={inlineLink}>
                Terms of Service
            </Link>
            .
        </Text>
        <Text style={signature}>SilkChat Trust &amp; Safety</Text>
    </>
)

export interface ModerationEmailBaseProps {
    name?: string
    caseId: string
    violation: string
    policyReference?: string
    contentAction?: string
    termsUrl: string
    logoUrl: string
    supportEmail: string
}

export type ModerationWarningEmailTemplateProps = ModerationEmailBaseProps
