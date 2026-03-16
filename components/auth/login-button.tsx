"use client";

import { signIn } from "next-auth/react";
import { ArrowRight, MessageCircleMore } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LoginButton() {
  return (
    <Button
      onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
      className="group w-full justify-between gap-3 rounded-xl text-sm font-semibold"
    >
      <span className="inline-flex items-center gap-2">
        <MessageCircleMore className="h-4 w-4" />
        Login dengan Discord
      </span>
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Button>
  );
}
