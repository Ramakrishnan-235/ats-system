import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80",
        secondary: "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80",
        destructive: "border-transparent bg-red-500 text-zinc-50 hover:bg-red-500/80",
        outline: "text-zinc-950 border border-zinc-200",
        score: "bg-zinc-100 text-zinc-900 font-bold border border-zinc-200 px-2 py-0.5",
        statusOpen: "bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold tracking-wider uppercase",
        statusPaused: "bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold tracking-wider uppercase",
        tag: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 border border-zinc-200/60 rounded-lg px-3 py-1 font-medium",
        dark: "bg-black text-white px-2.5 py-1 text-xs font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
