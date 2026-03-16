"use client";

import { useEffect, useRef } from "react";
import { BellRing, CalendarCheck2, Sparkles } from "lucide-react";
import { animate, stagger } from "animejs";

import { LoginButton } from "@/components/auth/login-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AssistantMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <rect x="4" y="4" width="40" height="40" rx="14" className="fill-primary/20" />
        <path d="M15 31L24 14L33 31" className="stroke-primary" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="31" r="3.6" className="fill-primary" />
      </svg>
    </span>
  );
}

function SparkMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <path
          d="M24 8L27.8 20.2L40 24L27.8 27.8L24 40L20.2 27.8L8 24L20.2 20.2L24 8Z"
          className="fill-primary/20 stroke-primary"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const highlights = [
  {
    icon: CalendarCheck2,
    title: "Agenda Terkontrol",
    description: "Task, event, dan jadwal kuliah terpusat di dashboard.",
  },
  {
    icon: BellRing,
    title: "Reminder Tepat Waktu",
    description: "Notifikasi dikirim otomatis lewat bot Discord kamu.",
  },
  {
    icon: Sparkles,
    title: "Input Natural",
    description: "Ketik santai, sistem bantu ubah jadi data terstruktur.",
  },
];

const decorativeConfig = [
  { strength: 14, minDistance: 0.18 },
  { strength: 10, minDistance: 0.12 },
  { strength: 16, minDistance: 0.2 },
  { strength: 12, minDistance: 0.12 },
  { strength: 9, minDistance: 0.1 },
  { strength: 11, minDistance: 0.11 },
] as const;

function pickRandomPosition(used: Array<{ x: number; y: number }>, minDistance: number) {
  const SAFE_MIN_X = 0.03;
  const SAFE_MAX_X = 0.97;
  const SAFE_MIN_Y = 0.05;
  const SAFE_MAX_Y = 0.95;

  const BLOCK_MIN_X = 0.22;
  const BLOCK_MAX_X = 0.78;
  const BLOCK_MIN_Y = 0.2;
  const BLOCK_MAX_Y = 0.84;

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const x = SAFE_MIN_X + Math.random() * (SAFE_MAX_X - SAFE_MIN_X);
    const y = SAFE_MIN_Y + Math.random() * (SAFE_MAX_Y - SAFE_MIN_Y);

    const inBlockedZone =
      x >= BLOCK_MIN_X && x <= BLOCK_MAX_X && y >= BLOCK_MIN_Y && y <= BLOCK_MAX_Y;

    if (inBlockedZone) {
      continue;
    }

    const tooClose = used.some((point) => Math.hypot(point.x - x, point.y - y) < minDistance);
    if (tooClose) {
      continue;
    }

    return { x, y };
  }

  return {
    x: Math.random() * 0.15 + 0.02,
    y: Math.random() * 0.2 + 0.05,
  };
}

export function LoginShowcase() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    const revealTargets = root.querySelectorAll<HTMLElement>("[data-login-reveal]");
    const featureTargets = root.querySelectorAll<HTMLElement>("[data-login-feature]");
    const floatTargets = root.querySelectorAll<HTMLElement>("[data-login-float]");
    const parallaxTargets = root.querySelectorAll<HTMLElement>("[data-login-parallax]");

    const placeDecorativeItems = () => {
      const usedPoints: Array<{ x: number; y: number }> = [];

      floatTargets.forEach((target, index) => {
        const config = decorativeConfig[index] ?? decorativeConfig[0];
        const point = pickRandomPosition(usedPoints, config.minDistance);

        target.style.left = `${(point.x * 100).toFixed(2)}%`;
        target.style.top = `${(point.y * 100).toFixed(2)}%`;

        usedPoints.push(point);
      });
    };

    placeDecorativeItems();

    const animations = [
      animate(revealTargets, {
        opacity: [0, 1],
        y: [18, 0],
        duration: 650,
        delay: stagger(90),
        ease: "out(3)",
      }),
      animate(featureTargets, {
        opacity: [0, 1],
        y: [10, 0],
        duration: 560,
        delay: stagger(70, { start: 260 }),
        ease: "out(2)",
      }),
    ];

    floatTargets.forEach((target, index) => {
      const direction = index % 2 === 0 ? 1 : -1;

      animations.push(
        animate(target, {
          y: [-6 * direction, 6 * direction],
          duration: 2300 + index * 280,
          alternate: true,
          loop: true,
          ease: "inOutSine",
        }),
      );

      animations.push(
        animate(target, {
          rotate: [0, direction * 360],
          duration: 17000 + index * 1700,
          loop: true,
          ease: "linear",
        }),
      );
    });

    const handleMouseMove = (event: PointerEvent) => {
      const mx = (event.clientX / window.innerWidth - 0.5) * 2;
      const my = (event.clientY / window.innerHeight - 0.5) * 2;

      parallaxTargets.forEach((target) => {
        const strength = Number(target.dataset.strength ?? "10");
        animate(target, {
          x: mx * strength,
          y: my * strength,
          duration: 420,
          ease: "out(3)",
        });
      });
    };

    const resetParallax = () => {
      parallaxTargets.forEach((target) => {
        animate(target, {
          x: 0,
          y: 0,
          duration: 520,
          ease: "out(3)",
        });
      });
    };

    window.addEventListener("pointermove", handleMouseMove);
    window.addEventListener("blur", resetParallax);
    window.addEventListener("resize", placeDecorativeItems);

    return () => {
      window.removeEventListener("pointermove", handleMouseMove);
      window.removeEventListener("blur", resetParallax);
      window.removeEventListener("resize", placeDecorativeItems);
      resetParallax();
      animations.forEach((instance) => instance.cancel());
    };
  }, []);

  return (
    <main ref={rootRef} className="relative flex min-h-[100svh] items-center overflow-hidden bg-background px-4 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,hsl(var(--muted)/0.24),transparent_28%)]" />

      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div
          data-login-float
          data-login-parallax
          data-strength={decorativeConfig[0].strength}
          className="absolute h-14 w-14 rounded-2xl border border-border/70 bg-card/70"
        >
          <AssistantMark className="block h-full w-full p-2" />
        </div>
        <div
          data-login-float
          data-login-parallax
          data-strength={decorativeConfig[1].strength}
          className="absolute h-3 w-3 rounded-full bg-primary/70"
        />
        <div
          data-login-float
          data-login-parallax
          data-strength={decorativeConfig[2].strength}
          className="absolute h-16 w-16 rounded-full border border-border/70 bg-card/75"
        >
          <SparkMark className="block h-full w-full p-3" />
        </div>
        <div
          data-login-float
          data-login-parallax
          data-strength={decorativeConfig[3].strength}
          className="absolute h-2.5 w-2.5 rounded-full bg-accent/75"
        />
        <div
          data-login-float
          data-login-parallax
          data-strength={decorativeConfig[4].strength}
          className="absolute h-4 w-4 rounded-md border border-primary/45 bg-primary/15"
        />
        <div
          data-login-float
          data-login-parallax
          data-strength={decorativeConfig[5].strength}
          className="absolute h-5 w-5 rounded-full border border-accent/45 bg-accent/15"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl py-8">
        <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <section className="space-y-6">
            <div
              data-login-reveal
              className="inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              AI Personal Student Assistant
            </div>

            <div className="space-y-3">
              <h1
                data-login-reveal
                className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
              >
                Kelola tugas dan jadwal kuliah langsung dari chat.
              </h1>
              <p
                data-login-reveal
                className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
              >
                Login dengan Discord untuk masuk ke dashboard, melihat agenda, dan menjaga reminder tetap konsisten.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    data-login-feature
                    className="rounded-xl border border-border/70 bg-card p-4"
                  >
                    <Icon className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <Card data-login-reveal className="border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Masuk ke Dashboard</CardTitle>
              <CardDescription>
                Satu klik login Discord untuk mulai chat, mencatat jadwal, dan menerima reminder otomatis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LoginButton />
              <div className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground">
                Mode saat ini: multi-user dashboard dengan bot Discord terhubung per akun.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
