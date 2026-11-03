"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { addYears, endOfYear, format, startOfYear, subYears } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useState } from "react"

const DEFAULT_YEAR_SPAN = 10

// shadcn's date picker: a Calendar in a Popover behind an outline button.
export function DatePicker({
    id,
    value,
    onChange,
    minDate,
    maxDate,
    placeholder = "Pick a date",
    className
}: {
    id?: string
    value: Date | undefined
    onChange: (date: Date | undefined) => void
    minDate?: Date
    maxDate?: Date
    placeholder?: string
    className?: string
}) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    data-empty={!value}
                    className={cn(
                        "w-full justify-between font-normal data-[empty=true]:text-muted-foreground",
                        className
                    )}
                >
                    {value ? format(value, "d MMM yyyy") : placeholder}
                    <CalendarIcon className="size-4 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                    mode="single"
                    // Month and year selects in the caption, for jumping far back.
                    captionLayout="dropdown"
                    selected={value}
                    defaultMonth={value}
                    disabled={[
                        ...(minDate ? [{ before: minDate }] : []),
                        ...(maxDate ? [{ after: maxDate }] : [])
                    ]}
                    // The year select lists every year in this range.
                    startMonth={minDate ?? startOfYear(subYears(new Date(), DEFAULT_YEAR_SPAN))}
                    endMonth={maxDate ?? endOfYear(addYears(new Date(), DEFAULT_YEAR_SPAN))}
                    onSelect={(date) => {
                        onChange(date)
                        setOpen(false)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
