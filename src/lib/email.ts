import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { render } from "@react-email/render"
import { Resend } from "resend"
import { resolveEmailIdempotencyKey } from "./email-idempotency"
import {
    ACCOUNT_EXPORT_PASSWORD_COPY,
    AccountExportEmailTemplate,
    SUPPORT_ACCOUNT_EXPORT_PASSWORD_COPY
} from "./email-templates/account-export"
import { InactiveAccountNoticeEmailTemplate } from "./email-templates/inactive-account-notice"
import { ModerationBanEmailTemplate } from "./email-templates/moderation-ban"
import { getRemainingStrikesCopy } from "../../convex/lib/moderation"
import { ModerationStrikeEmailTemplate } from "./email-templates/moderation-strike"
import {
    type ModerationUpdateContent,
    ModerationUpdateEmailTemplate,
    getModerationUpdateCopy
} from "./email-templates/moderation-update"
import { ModerationWarningEmailTemplate } from "./email-templates/moderation-warning"
import { WelcomeEmailTemplate } from "./email-templates/welcome"
import { loadServerEnv } from "./load-server-env"

loadServerEnv()

// Email provider types
type EmailProvider = "resend" | "ses" | "local-only-mock"

interface EmailConfig {
    provider: EmailProvider
    from: string
    resend?: {
        apiKey: string
    }
    ses?: {
        region: string
        accessKeyId?: string
        secretAccessKey?: string
    }
}

interface SendEmailOptions {
    to: string
    subject: string
    html: string
    text?: string
    idempotencyKey?: string
}

interface ModerationEmailContent {
    name?: string
    caseId: string
    violation: string
    policyReference?: string
    contentAction?: string
}

interface ModerationEmailData extends ModerationEmailContent {
    email: string
    idempotencyKey?: string
}

interface ModerationStrikeDetails {
    strikeNumber: number
    strikeLimit: number
    expiresAt?: string
    restrictions?: string[]
}

export interface RenderedEmail {
    subject: string
    html: string
    text: string
}

const DEFAULT_APP_URL = "https://silkchat.dev"
const DEFAULT_SUPPORT_EMAIL = "support@silkchat.dev"

const normalizeUrl = (value?: string) => {
    if (!value) return undefined
    const trimmedValue = value.trim()
    if (!trimmedValue) return undefined
    return trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")
        ? trimmedValue
        : `https://${trimmedValue}`
}

class EmailService {
    private config?: EmailConfig
    private resend?: Resend
    private sesClient?: SESClient

    constructor() {
        this.initializeProvider()
    }

    private getEmailConfig(): EmailConfig {
        const provider = (process.env.EMAIL_PROVIDER || "resend") as EmailProvider

        return {
            provider,
            from: process.env.EMAIL_FROM || "noreply@silkchat.dev",
            resend:
                provider === "resend"
                    ? process.env.RESEND_API_KEY
                        ? {
                              apiKey: process.env.RESEND_API_KEY!
                          }
                        : undefined
                    : undefined,
            ses:
                provider === "ses"
                    ? process.env.AWS_REGION
                        ? {
                              region: process.env.AWS_REGION!,
                              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                          }
                        : undefined
                    : undefined
        }
    }

    private initializeProvider() {
        this.config = this.getEmailConfig()
        this.resend = undefined
        this.sesClient = undefined

        if (this.config.provider === "resend" && this.config.resend) {
            this.resend = new Resend(this.config.resend.apiKey)
        } else if (this.config.provider === "ses" && this.config.ses) {
            this.sesClient = new SESClient({
                region: this.config.ses.region,
                ...(this.config.ses.accessKeyId &&
                    this.config.ses.secretAccessKey && {
                        credentials: {
                            accessKeyId: this.config.ses.accessKeyId,
                            secretAccessKey: this.config.ses.secretAccessKey
                        }
                    })
            })
        }
    }

    private ensureConfigured() {
        this.initializeProvider()

        if (!this.config) {
            throw new Error("Email configuration is unavailable")
        }

        if (this.config.provider === "resend" && !this.config.resend?.apiKey) {
            throw new Error("RESEND_API_KEY is required when using Resend provider")
        }

        if (this.config.provider === "ses" && !this.config.ses?.region) {
            throw new Error("AWS_REGION is required when using SES provider")
        }

        return this.config
    }

    isConfigured() {
        const config = this.getEmailConfig()

        if (config.provider === "resend") {
            return Boolean(config.resend?.apiKey)
        }

        if (config.provider === "ses") {
            return Boolean(config.ses?.region)
        }

        return process.env.NODE_ENV === "development"
    }

    getAppUrl() {
        return normalizeUrl(process.env.VITE_BETTER_AUTH_URL) || DEFAULT_APP_URL
    }

    getLogoUrl() {
        return `${DEFAULT_APP_URL}/logo-highres.png`
    }

    getSupportEmail() {
        return process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL
    }

    private async sendWithResend(options: SendEmailOptions, idempotencyKey: string) {
        if (!this.resend) {
            throw new Error("Resend client not initialized")
        }

        const result = await this.resend.emails.send(
            {
                from: this.config?.from || "noreply@silkchat.dev",
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text
            },
            { idempotencyKey }
        )

        if (result.error) {
            throw new Error(`Resend error: ${result.error.message}`)
        }

        return result
    }

    private async sendWithSES(options: SendEmailOptions) {
        if (!this.sesClient) {
            throw new Error("SES client not initialized")
        }

        const command = new SendEmailCommand({
            Source: this.config?.from || "noreply@silkchat.dev",
            Destination: {
                ToAddresses: [options.to]
            },
            Message: {
                Subject: {
                    Data: options.subject,
                    Charset: "UTF-8"
                },
                Body: {
                    Html: {
                        Data: options.html,
                        Charset: "UTF-8"
                    },
                    ...(options.text && {
                        Text: {
                            Data: options.text,
                            Charset: "UTF-8"
                        }
                    })
                }
            }
        })

        return await this.sesClient.send(command)
    }

    async sendEmail(options: SendEmailOptions) {
        try {
            const config = this.ensureConfigured()
            const idempotencyKey = resolveEmailIdempotencyKey({
                ...options,
                from: config.from
            })

            if (config.provider === "resend") {
                return await this.sendWithResend(options, idempotencyKey)
            }

            if (config.provider === "ses") {
                return await this.sendWithSES(options)
            }

            if (config.provider === "local-only-mock") {
                if (process.env.NODE_ENV !== "development") {
                    throw new Error(
                        "Local mock email provider is only available in development mode"
                    )
                }
                console.log("Sending email with local mock:", options)
                return {}
            }

            throw new Error(`Unsupported email provider: ${config.provider}`)
        } catch (error) {
            console.error("Failed to send email:", error)
            throw error
        }
    }

    async sendWelcomeEmail(data: {
        user: { email: string; name?: string }
        appUrl?: string
        idempotencyKey?: string
    }) {
        const appUrl = data.appUrl || this.getAppUrl()
        const supportEmail = this.getSupportEmail()
        const html = await render(
            WelcomeEmailTemplate({
                name: data.user.name,
                appUrl,
                logoUrl: this.getLogoUrl(),
                supportEmail
            })
        )

        await this.sendEmail({
            to: data.user.email,
            subject: "Welcome to SilkChat",
            html,
            idempotencyKey: data.idempotencyKey,
            text: `${data.user.name ? `Hi ${data.user.name},` : "Hi,"}\n\nWelcome to SilkChat. Your workspace is ready.\n\nBring the models you use into one place, search the web, generate images, and work with live code previews without breaking your flow.\n\nStart chatting: ${appUrl}\n\nIf you need help, contact us at ${supportEmail}.\n\nThe SilkChat Team`
        })
    }

    async sendAccountExportEmail(data: {
        email: string
        downloadUrl: string
        idempotencyKey?: string
        requestedBySupport?: boolean
    }) {
        const supportEmail = this.getSupportEmail()
        const html = await render(
            AccountExportEmailTemplate({
                downloadUrl: data.downloadUrl,
                logoUrl: this.getLogoUrl(),
                supportEmail,
                requestedBySupport: data.requestedBySupport
            })
        )

        const acknowledgement = await this.sendEmail({
            to: data.email,
            subject: "Your SilkChat account export is ready",
            html,
            idempotencyKey: data.idempotencyKey,
            text: `Your AES-256 encrypted SilkChat account export is ready:\n\n${data.downloadUrl}\n\n${data.requestedBySupport ? SUPPORT_ACCOUNT_EXPORT_PASSWORD_COPY : ACCOUNT_EXPORT_PASSWORD_COPY}\n\nIf you did not request this export, you can ignore this email.`
        })

        const providerMessageId =
            acknowledgement &&
            typeof acknowledgement === "object" &&
            "data" in acknowledgement &&
            acknowledgement.data &&
            typeof acknowledgement.data === "object" &&
            "id" in acknowledgement.data &&
            typeof acknowledgement.data.id === "string"
                ? acknowledgement.data.id
                : undefined

        return { providerMessageId }
    }

    async sendInactiveAccountNoticeEmail(data: {
        email: string
        name?: string
        idempotencyKey?: string
    }) {
        const appUrl = this.getAppUrl()
        const accountUrl = `${appUrl.replace(/\/$/, "")}/settings/account`
        const supportEmail = this.getSupportEmail()
        const html = await render(
            InactiveAccountNoticeEmailTemplate({
                name: data.name,
                appUrl,
                accountUrl,
                logoUrl: this.getLogoUrl(),
                supportEmail
            })
        )

        await this.sendEmail({
            to: data.email,
            subject: "Silky misses you",
            html,
            idempotencyKey: data.idempotencyKey,
            text: `Silky misses you\n\n${data.name ? `Hi ${data.name},` : "Hi,"}\n\nIt's been a while since you logged in. Your chats, generated images, and files remain available whenever you're ready.\n\nReturn to SilkChat: ${appUrl}\n\nIf you'd like to export your SilkChat data or delete your account instead, you can do that from your account settings: ${accountUrl}\n\nIf you need help, contact us at ${supportEmail}.\n\nThis is the only inactivity reminder we will send for this account.\n\nThe SilkChat Team`
        })
    }

    private getTermsUrl() {
        return `${this.getAppUrl().replace(/\/$/, "")}/terms-of-service`
    }

    private formatModerationTextDetails(data: ModerationEmailContent, extraLines: string[] = []) {
        return [
            `What we found: ${data.violation}`,
            ...(data.policyReference ? [`Policy: ${data.policyReference}`] : []),
            ...(data.contentAction ? [`Action on content: ${data.contentAction}`] : []),
            ...extraLines,
            `Case ID: ${data.caseId}`
        ].join("\n")
    }

    private getAppealUrl() {
        return `${this.getAppUrl().replace(/\/$/, "")}/settings/safety`
    }

    private formatModerationTextAppeal(caseId: string, { inApp }: { inApp: boolean }) {
        const route = inApp
            ? `you can appeal from Settings > Safety (${this.getAppealUrl()}), or email ${this.getSupportEmail()}`
            : `email ${this.getSupportEmail()}`
        return `If you think we got this wrong, ${route} with the subject "Appeal: case ${caseId}" and any context you'd like us to consider. A person will review every appeal.\n\nTerms of Service: ${this.getTermsUrl()}\n\nSilkChat Trust & Safety`
    }

    async buildModerationWarningEmail(data: ModerationEmailContent): Promise<RenderedEmail> {
        const html = await render(
            ModerationWarningEmailTemplate({
                ...data,
                termsUrl: this.getTermsUrl(),
                logoUrl: this.getLogoUrl(),
                supportEmail: this.getSupportEmail(),
                appealUrl: this.getAppealUrl()
            })
        )

        return {
            subject: "A warning about your SilkChat account",
            html,
            text: `A warning about your account\n\n${data.name ? `Hi ${data.name},` : "Hi,"}\n\nWe reviewed activity on your SilkChat account and found something that goes against our Terms of Service. This is a warning only. Your account is in good standing and nothing about your access has changed.\n\n${this.formatModerationTextDetails(data)}\n\nPlease don't repeat this. If it happens again, we may add a strike to your account, and repeated strikes lead to a ban.\n\n${this.formatModerationTextAppeal(data.caseId, { inApp: true })}`
        }
    }

    async buildModerationStrikeEmail(
        data: ModerationEmailContent & ModerationStrikeDetails
    ): Promise<RenderedEmail> {
        const html = await render(
            ModerationStrikeEmailTemplate({
                ...data,
                termsUrl: this.getTermsUrl(),
                logoUrl: this.getLogoUrl(),
                supportEmail: this.getSupportEmail(),
                appealUrl: this.getAppealUrl()
            })
        )
        const details = this.formatModerationTextDetails(data, [
            `Strikes: ${data.strikeNumber} of ${data.strikeLimit}`,
            ...(data.expiresAt ? [`Strike expires: ${data.expiresAt}`] : [])
        ])
        const restrictions = data.restrictions?.length
            ? `\n\nWhile this strike is active, the following limits apply:\n${data.restrictions.map((restriction) => `- ${restriction}`).join("\n")}`
            : ""
        const expiry = data.expiresAt
            ? " This strike will be removed on the date shown above if there are no further violations."
            : ""

        return {
            subject: `Strike ${data.strikeNumber} of ${data.strikeLimit} on your SilkChat account`,
            html,
            text: `Your account received a strike\n\n${data.name ? `Hi ${data.name},` : "Hi,"}\n\nWe reviewed activity on your SilkChat account and confirmed a violation of our Terms of Service. We've added a strike to your account.\n\n${details}${restrictions}\n\n${getRemainingStrikesCopy(data.strikeNumber, data.strikeLimit)}\n\nYour chats, files, and generated images are not affected.${expiry}\n\n${this.formatModerationTextAppeal(data.caseId, { inApp: true })}`
        }
    }

    async buildModerationBanEmail(
        data: ModerationEmailContent & { endsAt?: string }
    ): Promise<RenderedEmail> {
        const supportEmail = this.getSupportEmail()
        const html = await render(
            ModerationBanEmailTemplate({
                ...data,
                termsUrl: this.getTermsUrl(),
                logoUrl: this.getLogoUrl(),
                supportEmail
            })
        )
        const heading = data.endsAt
            ? "Your account has been suspended"
            : "Your account has been banned"
        const summary = data.endsAt
            ? "Your access is suspended until the date below. You won't be able to sign in or use SilkChat until then."
            : "Your account has been permanently banned. You can no longer sign in or use SilkChat, and you may not create a new account."
        const details = this.formatModerationTextDetails(data, [
            data.endsAt ? `Suspended until: ${data.endsAt}` : "Duration: Permanent"
        ])

        return {
            subject: data.endsAt
                ? "Your SilkChat account has been suspended"
                : "Your SilkChat account has been banned",
            html,
            text: `${heading}\n\n${data.name ? `Hi ${data.name},` : "Hi,"}\n\nWe reviewed activity on your SilkChat account and confirmed a serious or repeated violation of our Terms of Service. ${summary}\n\n${details}\n\nAny active subscription has been cancelled. Under our Terms of Service, unused time on a paid plan is not refunded when access ends because of a violation.\n\nIf you need a copy of your data, email ${supportEmail} from this address and include your case ID.\n\n${this.formatModerationTextAppeal(data.caseId, { inApp: false })}`
        }
    }

    async buildModerationUpdateEmail(
        data: ModerationUpdateContent & {
            name?: string
            caseId: string
            violation: string
            note?: string
        }
    ): Promise<RenderedEmail> {
        const supportEmail = this.getSupportEmail()
        const copy = getModerationUpdateCopy(data)
        const html = await render(
            ModerationUpdateEmailTemplate({ ...data, logoUrl: this.getLogoUrl(), supportEmail })
        )
        const details = [
            ...(copy.warm ? [] : [`What we found: ${data.violation}`]),
            ...(data.note ? [`Note: ${data.note}`] : []),
            `Case ID: ${data.caseId}`
        ].join("\n")

        return {
            subject: copy.subject,
            html,
            text: `${copy.heading}\n\n${data.name ? `Hi ${data.name},` : "Hi,"}\n\n${copy.paragraphs.join("\n\n")}\n\n${details}\n\nQuestions? Contact ${supportEmail} with your case ID.\n\n${copy.warm ? "The SilkChat Team" : "SilkChat Trust & Safety"}`
        }
    }

    private async sendRenderedEmail(
        data: { email: string; idempotencyKey?: string },
        rendered: RenderedEmail
    ) {
        await this.sendEmail({
            to: data.email,
            ...rendered,
            idempotencyKey: data.idempotencyKey
        })
    }

    async sendModerationWarningEmail(data: ModerationEmailData) {
        await this.sendRenderedEmail(data, await this.buildModerationWarningEmail(data))
    }

    async sendModerationStrikeEmail(data: ModerationEmailData & ModerationStrikeDetails) {
        await this.sendRenderedEmail(data, await this.buildModerationStrikeEmail(data))
    }

    async sendModerationBanEmail(data: ModerationEmailData & { endsAt?: string }) {
        await this.sendRenderedEmail(data, await this.buildModerationBanEmail(data))
    }
}

// Export singleton instance
export const emailService = new EmailService()

// Export the provider-level sender and live product email helpers.
export const sendEmail = emailService.sendEmail.bind(emailService)
export const sendWelcomeEmail = emailService.sendWelcomeEmail.bind(emailService)
export const sendAccountExportEmail = emailService.sendAccountExportEmail.bind(emailService)
export const sendInactiveAccountNoticeEmail =
    emailService.sendInactiveAccountNoticeEmail.bind(emailService)
export const sendModerationWarningEmail = emailService.sendModerationWarningEmail.bind(emailService)
export const sendModerationStrikeEmail = emailService.sendModerationStrikeEmail.bind(emailService)
export const sendModerationBanEmail = emailService.sendModerationBanEmail.bind(emailService)
export const buildModerationWarningEmail =
    emailService.buildModerationWarningEmail.bind(emailService)
export const buildModerationStrikeEmail = emailService.buildModerationStrikeEmail.bind(emailService)
export const buildModerationBanEmail = emailService.buildModerationBanEmail.bind(emailService)
export const buildModerationUpdateEmail = emailService.buildModerationUpdateEmail.bind(emailService)
export const isEmailConfigured = emailService.isConfigured.bind(emailService)
