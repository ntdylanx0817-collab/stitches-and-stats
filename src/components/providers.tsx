"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { SocketProvider } from "@/components/socket-provider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {/*
        The globals.css `prefers-reduced-motion` block only reaches CSS
        keyframes. Framer drives its animations in JavaScript, so every
        motion.* in the app — score reveals, row cascades, the pitch plot,
        modal transitions — ran at full motion regardless of the OS setting.

        "user" defers to that setting and, when it's on, drops transform and
        layout animation while still allowing opacity. That matches how the
        CSS block was already written: looping decoration goes, and the fades
        that report something changed stay.
      */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={client}>
          <SocketProvider>{children}</SocketProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
