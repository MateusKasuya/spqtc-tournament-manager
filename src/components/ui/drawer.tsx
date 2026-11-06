"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Mesmo corte do `md:` do Tailwind: abaixo dele a gaveta sobe de baixo e fecha
// arrastando para baixo; a partir dele abre na lateral e fecha arrastando para a direita.
const SIDE_QUERY = "(min-width: 768px)"

function Drawer({ swipeDirection, ...props }: DrawerPrimitive.Root.Props) {
  // A gaveta começa fechada, então a primeira renderização no servidor não importa.
  const side = useMediaQuery(SIDE_QUERY, { noSsr: true })
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      swipeDirection={swipeDirection ?? (side ? "right" : "down")}
      {...props}
    />
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DrawerPrimitive.Portal>
      {/* Fundo leve e sem desfoque: o topo da mesa (o Relógio) continua legível por trás. */}
      <DrawerPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black [--backdrop-opacity:0.2] dark:[--backdrop-opacity:0.5] opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:duration-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]"
      />
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "relative flex w-full flex-col bg-popover text-sm text-popover-foreground outline-none ring-1 ring-foreground/10",
            "transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform data-swiping:select-none data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            // Celular: sobe de baixo e para em 70% da altura, para o Relógio continuar visível por trás.
            "max-h-[70dvh] rounded-t-xl pb-[env(safe-area-inset-bottom,0px)] [transform:translateY(var(--drawer-swipe-movement-y))] data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
            // Desktop: abre na lateral direita, com a mesa visível ao lado.
            "md:h-full md:max-h-none md:max-w-md md:rounded-none md:pb-0 md:[transform:translateX(var(--drawer-swipe-movement-x))] md:data-starting-style:[transform:translateX(100%)] md:data-ending-style:[transform:translateX(100%)]",
            className
          )}
          {...props}
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted md:hidden" />
          {children}
          {showCloseButton && (
            <DrawerPrimitive.Close
              data-slot="drawer-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-2 right-2"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Fechar</span>
            </DrawerPrimitive.Close>
          )}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex shrink-0 flex-col gap-1 px-4 pt-3 pb-2 pr-12 md:pt-4", className)}
      {...props}
    />
  )
}

// Corpo da gaveta: rola por dentro quando o conteúdo é longo.
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
}
