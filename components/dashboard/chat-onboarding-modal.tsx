"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHAT_ONBOARDING_SESSION_KEY } from "@/lib/dashboard/storage-keys";

interface ChatOnboardingModalProps {
  discordBotDmUrl: string | null;
}

const examplePrompts = [
  "besok jam 9 ada kelas AI",
  "ingetin aku tiap jumat jam 10 buat siap jumatan",
  "minggu ini deadline apa aja?",
];

export function ChatOnboardingModal({ discordBotDmUrl }: ChatOnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const totalSteps = 2;
  const isFirstStep = step === 0;

  useEffect(() => {
    if (!discordBotDmUrl || typeof window === "undefined") {
      return;
    }

    const seen = window.sessionStorage.getItem(CHAT_ONBOARDING_SESSION_KEY) === "1";
    if (!seen) {
      setOpen(true);
      setStep(0);
    }
  }, [discordBotDmUrl]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen && typeof window !== "undefined") {
      window.sessionStorage.setItem(CHAT_ONBOARDING_SESSION_KEY, "1");
      setStep(0);
    }
  };

  const subtitle = useMemo(() => {
    if (isFirstStep) {
      return "Ketik natural, bot ubah jadi jadwal/reminder terstruktur.";
    }

    return "Kalau sudah paham, lanjut DM bot untuk mulai input jadwal.";
  }, [isFirstStep]);

  if (!discordBotDmUrl) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden border-border/70 p-0 shadow-xl">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_48%),linear-gradient(to_bottom,hsl(var(--card)),hsl(var(--card)))]" />

          <div className="relative space-y-5 p-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <Badge
                  variant="secondary"
                  className="w-fit gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-3 py-1"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Onboarding
                </Badge>
                <span className="text-xs text-muted-foreground">Step {step + 1} / {totalSteps}</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary">
                  <Bot className="h-4.5 w-4.5" />
                </div>

                <div className="space-y-1.5">
                  <DialogTitle className="text-xl leading-none">
                    {isFirstStep ? "Cara Pakai Bot (Cepat)" : "Mulai Chat ke Bot"}
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    {subtitle}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {isFirstStep ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-1.5 text-foreground">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                    Contoh chat yang bisa kamu kirim
                  </div>
                  <div className="space-y-1.5">
                    {examplePrompts.map((prompt) => (
                      <p key={prompt} className="rounded-md border border-border/60 bg-card px-2 py-1.5 font-mono text-[11px]">
                        {prompt}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-1.5 text-foreground">
                    <CalendarClock className="h-3.5 w-3.5 text-primary" />
                    Tips biar akurat
                  </div>
                  Tulis tanggal dan jam sejelas mungkin. Kalau ambigu, bot akan tanya klarifikasi dulu.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  <p className="mb-2 text-sm font-medium text-foreground">Checklist sebelum mulai</p>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Sudah login dengan akun Discord yang benar
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Gunakan tanggal + jam yang jelas saat kirim pesan
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Kalau diminta klarifikasi, balas singkat untuk konfirmasi
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
                  Contoh pertama yang direkomendasikan: <span className="font-mono text-foreground">besok jam 9 ada kelas AI</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 w-6 rounded-full transition-all ${index === step ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {isFirstStep ? (
                  <>
                    <Button type="button" variant="outline" className="sm:min-w-24" onClick={() => handleOpenChange(false)}>
                      Nanti
                    </Button>
                    <Button type="button" className="gap-2 sm:min-w-24" onClick={() => setStep(1)}>
                      Lanjut
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" className="gap-2 sm:min-w-24" onClick={() => setStep(0)}>
                      <ChevronLeft className="h-4 w-4" />
                      Kembali
                    </Button>
                    <Button asChild className="gap-2 sm:min-w-56">
                      <a
                        href={discordBotDmUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.sessionStorage.setItem(CHAT_ONBOARDING_SESSION_KEY, "1");
                          }
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Chat ke Bot Discord
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


