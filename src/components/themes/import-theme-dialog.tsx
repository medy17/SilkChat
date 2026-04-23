import { useIsMobile } from "@/hooks/use-mobile"
import { type ThemePreset, fetchThemeFromUrl } from "@/lib/theme-utils"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangleIcon, LoaderIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "../ui/drawer"
import { Form, FormControl, FormField, FormItem, FormMessage } from "../ui/form"
import { Input } from "../ui/input"

const formSchema = z.object({
    url: z
        .string()
        .min(1, { message: "Theme URL is required" })
        .url({ message: "Please enter a valid URL" })
})

type ThemeImportForm = z.infer<typeof formSchema>

interface ImportThemeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onThemeImported: (preset: ThemePreset, url: string) => void
    nested?: boolean
    className?: string
}

export function ImportThemeDialog({
    open,
    onOpenChange,
    onThemeImported,
    nested = false,
    className
}: ImportThemeDialogProps) {
    const isMobile = useIsMobile()
    const queryClient = useQueryClient()

    const form = useForm<ThemeImportForm>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            url: ""
        }
    })

    // Mutation for fetching and applying user-provided theme URLs
    const fetchAndApplyThemeMutation = useMutation({
        mutationFn: async (url: string) => {
            new URL(url)
            const fetchedTheme = await fetchThemeFromUrl(url)

            if (fetchedTheme.error) {
                throw new Error(fetchedTheme.error)
            }

            return fetchedTheme
        },
        onSuccess: (fetchedTheme) => {
            onThemeImported(fetchedTheme.preset, fetchedTheme.url)
            form.reset() // Clear form on success
            onOpenChange(false) // Close modal

            // Optionally cache the successfully fetched theme
            queryClient.setQueryData(["theme", "custom", fetchedTheme.url], fetchedTheme)
        }
    })

    const onSubmit = (data: ThemeImportForm) => {
        if (data.url.trim()) {
            fetchAndApplyThemeMutation.mutate(data.url.trim())
        }
    }

    const description = (
        <>
            Enter a theme URL from{" "}
            <a
                href="https://tweakcn.com"
                // biome-ignore lint/a11y/noBlankTarget: tweakcn.com is trusted
                target="_blank"
                rel="noopener"
                className="inline-flex items-baseline gap-1 text-primary underline"
            >
                tweakcn.com
            </a>{" "}
            to apply a custom theme.
        </>
    )

    const formFields = (
        <>
            <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input
                                type="url"
                                placeholder="https://tweakcn.com/themes/themeId"
                                disabled={fetchAndApplyThemeMutation.isPending}
                                autoFocus
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {fetchAndApplyThemeMutation.error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3">
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p className="text-destructive text-sm leading-relaxed">
                        {fetchAndApplyThemeMutation.error.message}
                    </p>
                </div>
            )}
        </>
    )

    const importButton = (
        <Button
            type="submit"
            form="theme-import-form"
            disabled={fetchAndApplyThemeMutation.isPending}
        >
            {fetchAndApplyThemeMutation.isPending ? (
                <>
                    <LoaderIcon className="size-4 animate-spin" />
                    Importing...
                </>
            ) : (
                "Import Theme"
            )}
        </Button>
    )

    const cancelButton = (
        <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={fetchAndApplyThemeMutation.isPending}
        >
            Cancel
        </Button>
    )

    const formContent = (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {formFields}
                <div className="flex justify-end gap-2">
                    {cancelButton}
                    <Button type="submit" disabled={fetchAndApplyThemeMutation.isPending}>
                        {fetchAndApplyThemeMutation.isPending ? (
                            <>
                                <LoaderIcon className="size-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            "Import Theme"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    )

    const mobileFormContent = (
        <Form {...form}>
            <form
                id="theme-import-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
            >
                {formFields}
            </form>
        </Form>
    )

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange} nested={nested}>
                <DrawerContent
                    className={cn("z-[90] max-h-[80dvh] bg-popover", className)}
                    overlayClassName="z-[80]"
                >
                    <DrawerHeader>
                        <DrawerTitle>Import Theme</DrawerTitle>
                        <DrawerDescription>{description}</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4">{mobileFormContent}</div>
                    <DrawerFooter>
                        {importButton}
                        {cancelButton}
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("sm:max-w-md", className)}>
                <DialogHeader>
                    <DialogTitle>Import Theme</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {formContent}
            </DialogContent>
        </Dialog>
    )
}
