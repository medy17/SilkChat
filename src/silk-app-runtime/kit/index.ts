// `@silk/ui`: the component kit model-written apps import. SilkChat primitives are
// re-exported unchanged so apps match the host; the rest is app-specific.

export { formatValue } from "@/components/renderers/chart-plot"
export {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@/components/ui/accordion"
export { Badge } from "@/components/ui/badge"
export { Button } from "@/components/ui/button"
export { Checkbox } from "@/components/ui/checkbox"
export { Input } from "@/components/ui/input"
export { Label } from "@/components/ui/label"
export { Progress } from "@/components/ui/progress"
export { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
export { Separator } from "@/components/ui/separator"
export { Switch } from "@/components/ui/switch"
export {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"
export { Textarea } from "@/components/ui/textarea"
export { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
export { cn } from "@/lib/utils"
export { Canvas, type CanvasFrame, type ThemeColors, useThemeColors } from "./canvas"
export { Chart, type ChartProps, type ChartSeries } from "./chart"
export { Control, Segmented, Slider } from "./controls"
export { AnimatedNumber, Stat, StatGrid, formatNumber } from "./metrics"
export {
    Alert,
    AlertDescription,
    AlertTitle,
    AppHeader,
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Tag,
    type Tone
} from "./surfaces"
