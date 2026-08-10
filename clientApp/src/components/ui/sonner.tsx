"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ theme = "light", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      position="top-right"
      mobileOffset={{ top: "4rem" }}
      closeButton
      containerAriaLabel="Notifications"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-brand-strong" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-destructive" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: "Fermer la notification",
        classNames: {
          success: "[--normal-bg:var(--brand-tint)] [--normal-border:var(--brand)] [--normal-text:var(--ink)]",
          error: "[--normal-bg:var(--destructive-tint)] [--normal-border:var(--destructive)] [--normal-text:var(--ink)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
