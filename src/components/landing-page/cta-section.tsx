import { Link } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CtaSection() {
    return (
        <section id="start" className="landing-close">
            <div className="landing-wrap">
                <h2>Start a conversation.</h2>
                <Button asChild size="lg" className="landing-primary h-12 px-6">
                    <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                        Get started free <ArrowUpRight className="size-4" />
                    </Link>
                </Button>
            </div>
        </section>
    )
}
