import * as React from "react"
import { cn } from "@/lib/utils"
import { SpellCheckedInput } from "./spell-checker"

const SPELL_CHECK_TYPES = new Set([undefined, 'text'])

// D8: el ref debe llegar al <input> real (autofocus de bodega y warnings de React).
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    const baseClass = cn(
      "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
      className
    )

    if (SPELL_CHECK_TYPES.has(type)) {
      return <SpellCheckedInput ref={ref} type={type} className={baseClass} {...props} />
    }

    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={baseClass}
        {...props}
      />
    )
  }
)

export { Input }
