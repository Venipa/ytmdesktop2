import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

export type ScrollAreaHideOnBlur = "window" | "scroll-area"

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
	/** Hide the custom scrollbar while this target is blurred. */
	hideOnBlur?: ScrollAreaHideOnBlur
}

let windowFocused = true
const windowFocusListeners = new Set<() => void>()

function emitWindowFocus() {
	const next = document.hasFocus()
	if (next === windowFocused) return
	windowFocused = next
	windowFocusListeners.forEach((listener) => listener())
}

function subscribeWindowFocus(onStoreChange: () => void) {
	if (windowFocusListeners.size === 0) {
		windowFocused = document.hasFocus()
		window.addEventListener("focus", emitWindowFocus)
		window.addEventListener("blur", emitWindowFocus)
	}
	windowFocusListeners.add(onStoreChange)
	return () => {
		windowFocusListeners.delete(onStoreChange)
		if (windowFocusListeners.size === 0) {
			window.removeEventListener("focus", emitWindowFocus)
			window.removeEventListener("blur", emitWindowFocus)
		}
	}
}

function subscribeNoop() {
	return () => {}
}

function getWindowFocused() {
	return windowFocused
}

function getTrue() {
	return true
}

function useWindowFocused(enabled: boolean) {
	return useSyncExternalStore(enabled ? subscribeWindowFocus : subscribeNoop, enabled ? getWindowFocused : getTrue, getTrue)
}

function ScrollArea({
  className,
  children,
  hideOnBlur = "scroll-area",
  ...props
}: ScrollAreaProps) {
  const windowFocused = useWindowFocused(hideOnBlur === "window")

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      data-hide-on-blur={hideOnBlur}
      data-window-blurred={hideOnBlur === "window" && !windowFocused ? "" : undefined}
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none data-horizontal:w-full data-horizontal:flex-col data-vertical:h-full",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
