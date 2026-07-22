import { cn } from "@/lib/utils"
import { type SVGProps, useId } from "react"

type ChatMascotProps = SVGProps<SVGSVGElement> & {
    isCurious?: boolean
    variant?: "full" | "face"
}

const mascotColors = {
    hoodHighlight: "var(--secondary)",
    hoodMidtone: "var(--accent)",
    hoodShadow: "color-mix(in oklch, var(--muted-foreground) 76%, var(--primary))",
    cloakHighlight: "var(--primary)",
    cloakMidtone: "var(--muted-foreground)",
    cloakShadow: "color-mix(in oklch, var(--muted-foreground) 60%, var(--background))",
    faceHighlight: "color-mix(in oklch, var(--foreground) 88%, var(--muted-foreground))",
    faceShadow: "var(--foreground)",
    featureLight: "var(--background)",
    featureDark: "var(--foreground)",
    accentLight: "color-mix(in oklch, var(--background) 70%, var(--muted-foreground))",
    accentMidtone: "var(--accent)",
    runeHighlight: "var(--primary)",
    runeShadow: "var(--muted-foreground)",
    shadow: "var(--muted-foreground)"
} as const

export function ChatMascot({
    className,
    isCurious = false,
    variant = "full",
    ...props
}: ChatMascotProps) {
    const instanceId = useId().replaceAll(":", "")
    const id = (name: string) => `${name}-${instanceId}`

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={variant === "face" ? "285 150 585 610" : "0 0 1024 1024"}
            role="img"
            aria-labelledby={`${id("title")} ${id("description")}`}
            className={cn(
                isCurious && "chat-mascot-curious",
                variant === "face" ? "chat-mascot-face overflow-hidden" : "overflow-visible",
                className
            )}
            {...props}
        >
            <title id={id("title")}>SilkChat floating familiar mascot</title>
            <desc id={id("description")}>
                A lavender hooded floating spirit with a dark expressive face, a purple cloak, and
                an orbiting rune.
            </desc>

            <defs>
                <linearGradient id={id("hood-gradient")} x1="0.18" y1="0.05" x2="0.82" y2="0.96">
                    <stop offset="0" stopColor={mascotColors.hoodHighlight} />
                    <stop offset="0.52" stopColor={mascotColors.hoodMidtone} />
                    <stop offset="1" stopColor={mascotColors.hoodShadow} />
                </linearGradient>
                <linearGradient id={id("cloak-gradient")} x1="0.1" y1="0.1" x2="0.92" y2="0.92">
                    <stop offset="0" stopColor={mascotColors.cloakHighlight} />
                    <stop offset="0.58" stopColor={mascotColors.cloakMidtone} />
                    <stop offset="1" stopColor={mascotColors.cloakShadow} />
                </linearGradient>
                <linearGradient id={id("face-gradient")} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={mascotColors.faceHighlight} />
                    <stop offset="1" stopColor={mascotColors.faceShadow} />
                </linearGradient>
                <linearGradient id={id("rune-gradient")} x1="0.2" y1="0.1" x2="0.85" y2="0.95">
                    <stop offset="0" stopColor={mascotColors.runeHighlight} />
                    <stop offset="1" stopColor={mascotColors.runeShadow} />
                </linearGradient>
                <radialGradient id={id("shadow-gradient")} cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor={mascotColors.shadow} stopOpacity="0.22" />
                    <stop offset="1" stopColor={mascotColors.shadow} stopOpacity="0" />
                </radialGradient>
                <filter id={id("soft-shadow")} x="-20%" y="-30%" width="140%" height="160%">
                    <feGaussianBlur stdDeviation="10" />
                </filter>
                <style>{`
                    .chat-mascot-body, .chat-mascot-rune, .chat-mascot-cloak,
                    .chat-mascot-head, .chat-mascot-eye, .chat-mascot-pupil,
                    .chat-mascot-brow, .chat-mascot-brow-glint {
                        transform-box: fill-box;
                        transform-origin: center;
                    }

                    .chat-mascot-brow-glint {
                        opacity: 0;
                    }

                    .chat-mascot-face .chat-mascot-cloak,
                    .chat-mascot-face .chat-mascot-rune,
                    .chat-mascot-face .chat-mascot-shadow {
                        display: none;
                    }

                    .chat-mascot-curious .chat-mascot-head {
                        transform: translateY(14px) rotate(6deg);
                    }

                    .chat-mascot-curious .chat-mascot-pupil-left {
                        transform: translate(9px, 16px) scale(0.78);
                    }

                    .chat-mascot-curious .chat-mascot-pupil-right {
                        transform: translate(-9px, 16px) scale(0.78);
                    }

                    .chat-mascot-curious .chat-mascot-brow-right {
                        transform: translateY(-18px) rotate(-8deg);
                        stroke-width: 13px;
                    }

                    @media (prefers-reduced-motion: no-preference) {
                        .chat-mascot-body { animation: chat-mascot-float 4.2s ease-in-out infinite; }
                        .chat-mascot-rune { animation: chat-mascot-rune-bob 3.4s ease-in-out infinite; }
                        .chat-mascot-cloak { animation: chat-mascot-cloak-sway 4.2s ease-in-out infinite; }
                        .chat-mascot-eye { animation: chat-mascot-blink 6.8s ease-in-out infinite; }
                        .chat-mascot-head, .chat-mascot-pupil, .chat-mascot-brow {
                            transition:
                                transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
                                stroke-width 240ms cubic-bezier(0.16, 1, 0.3, 1);
                        }
                        .chat-mascot-curious .chat-mascot-brow-glint {
                            animation: chat-mascot-brow-glint 3.8s ease-in-out 600ms infinite;
                        }
                    }

                    @keyframes chat-mascot-float {
                        0%, 100% { transform: translateY(0) rotate(-1deg); }
                        50% { transform: translateY(-12px) rotate(1deg); }
                    }

                    @keyframes chat-mascot-rune-bob {
                        0%, 100% { transform: translate(0, 0) rotate(-4deg); }
                        50% { transform: translate(7px, -10px) rotate(7deg); }
                    }

                    @keyframes chat-mascot-cloak-sway {
                        0%, 100% { transform: rotate(-0.5deg); }
                        50% { transform: rotate(1.3deg); }
                    }

                    @keyframes chat-mascot-blink {
                        0%, 45%, 49%, 100% { transform: scaleY(1); }
                        47% { transform: scaleY(0.08); }
                    }

                    @keyframes chat-mascot-brow-glint {
                        0%, 68%, 78%, 100% {
                            opacity: 0;
                            transform: rotate(-12deg) scale(0.45);
                        }
                        72% {
                            opacity: 1;
                            transform: rotate(0) scale(1);
                        }
                    }
                `}</style>
            </defs>

            <ellipse
                className="chat-mascot-shadow"
                cx="575"
                cy="913"
                rx="183"
                ry="29"
                fill={`url(#${id("shadow-gradient")})`}
                filter={`url(#${id("soft-shadow")})`}
            />

            <g className="chat-mascot-body">
                <g className="chat-mascot-cloak">
                    <path
                        d="M452 644 C516 668 575 689 637 669 C700 648 755 661 795 704 C844 757 844 829 811 887 C798 910 781 932 761 950 C746 964 737 957 739 935 L743 901 C690 965 611 1005 529 1016 C506 1019 497 1008 510 991 C566 918 588 858 558 806 C540 776 506 744 457 715 C431 700 426 658 452 644Z"
                        fill={`url(#${id("cloak-gradient")})`}
                    />
                    <path
                        d="M474 676 C532 696 584 709 638 692 C683 678 721 679 753 700 C719 714 684 745 656 786 C618 842 607 917 542 983 C584 902 597 847 570 798 C550 763 519 731 474 706Z"
                        fill={mascotColors.accentMidtone}
                        opacity="0.24"
                    />
                    <path
                        d="M699 754 C704 771 714 781 733 786 C714 791 704 801 699 820 C694 801 684 791 665 786 C684 781 694 771 699 754Z"
                        fill={mascotColors.accentLight}
                    />
                </g>

                <g className="chat-mascot-head">
                    <path
                        d="M385 682 C320 642 296 579 308 501 C321 417 372 342 440 277 C496 224 555 172 613 124 C629 111 638 117 637 140 C640 214 622 270 610 322 C600 367 615 393 655 411 C723 441 784 482 810 542 C837 604 813 668 762 705 C706 745 632 756 556 741 C494 729 438 713 385 682Z"
                        fill={`url(#${id("hood-gradient")})`}
                    />
                    <path
                        d="M398 663 C449 719 536 744 621 723 C683 708 730 680 761 642 C748 695 704 728 650 743 C566 767 465 740 402 690Z"
                        fill={mascotColors.hoodShadow}
                        opacity="0.82"
                    />
                    <path
                        d="M365 511 C391 461 425 424 454 421 C480 418 494 438 484 462 C475 484 452 505 434 510 C421 514 412 505 415 494 C417 486 424 478 432 476 C443 473 450 479 446 487 C456 480 466 467 468 455 C470 442 460 436 447 440 C417 449 387 483 365 526Z"
                        fill={mascotColors.hoodHighlight}
                        opacity="0.9"
                    />
                    <path
                        d="M408 601 C463 526 548 477 648 466 C706 459 751 472 770 506 C794 549 777 615 733 657 C685 704 607 735 531 727 C468 721 421 695 402 660 C391 639 393 621 408 601Z"
                        fill={`url(#${id("face-gradient")})`}
                    />
                    <g className="chat-mascot-eye">
                        <path
                            d="M466 575 C489 558 527 559 553 579 C544 611 519 628 493 622 C476 618 466 601 466 575Z"
                            fill={mascotColors.featureLight}
                        />
                        <ellipse
                            className="chat-mascot-pupil chat-mascot-pupil-left"
                            cx="507"
                            cy="589"
                            rx="17"
                            ry="25"
                            fill={mascotColors.featureDark}
                        />
                        <circle
                            className="chat-mascot-pupil chat-mascot-pupil-left"
                            cx="500"
                            cy="579"
                            r="8"
                            fill={mascotColors.featureLight}
                        />
                    </g>
                    <path
                        d="M471 568 C493 552 523 552 545 566"
                        fill="none"
                        stroke={mascotColors.accentLight}
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    <g className="chat-mascot-eye">
                        <path
                            d="M626 554 C648 537 681 535 704 548 C704 584 686 610 661 614 C638 617 624 593 626 554Z"
                            fill={mascotColors.featureLight}
                        />
                        <ellipse
                            className="chat-mascot-pupil chat-mascot-pupil-right"
                            cx="669"
                            cy="568"
                            rx="16"
                            ry="25"
                            fill={mascotColors.featureDark}
                        />
                        <circle
                            className="chat-mascot-pupil chat-mascot-pupil-right"
                            cx="662"
                            cy="558"
                            r="8"
                            fill={mascotColors.featureLight}
                        />
                    </g>
                    <path
                        className="chat-mascot-brow chat-mascot-brow-right"
                        d="M631 544 C650 529 676 526 698 537"
                        fill="none"
                        stroke={mascotColors.accentLight}
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    <path
                        className="chat-mascot-brow-glint"
                        d="M714 500 C718 515 726 523 741 527 C726 531 718 539 714 554 C710 539 702 531 687 527 C702 523 710 515 714 500Z"
                        fill={mascotColors.featureLight}
                    />
                    <path
                        d="M558 646 C575 660 602 658 623 635"
                        fill="none"
                        stroke={mascotColors.featureLight}
                        strokeWidth="9"
                        strokeLinecap="round"
                    />
                </g>
            </g>

            <g className="chat-mascot-rune">
                <path
                    d="M842 466 C868 454 897 449 920 454 C949 483 961 522 952 558 C934 583 903 601 867 610 C850 614 840 606 837 587 C830 548 829 500 842 466Z"
                    fill={`url(#${id("rune-gradient")})`}
                />
                <path
                    d="M880 493 C899 506 910 526 906 545 C901 568 880 580 861 571 C848 564 845 551 851 541 C857 531 869 529 877 536 C884 542 883 551 877 556 C887 555 895 547 895 537 C896 523 887 511 873 504Z"
                    fill={mascotColors.accentLight}
                />
            </g>
        </svg>
    )
}
