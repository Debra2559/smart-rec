import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Sun,
  Mic,
  MessageCircle,
  CalendarDays,
  Settings,
  LogOut,
  Radio,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/", label: "今天", icon: Sun },
  { to: "/meetings", label: "会议", icon: Mic },
  { to: "/ask", label: "问答", icon: MessageCircle },
  { to: "/review", label: "回顾", icon: CalendarDays },
  { to: "/settings", label: "设置", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src={logo} alt="回响" className="h-12 w-12 animate-pulse" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 侧边导航（桌面） */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
          <img src={logo} alt="回响" className="h-8 w-8" />
          <div>
            <div className="font-display text-lg font-bold leading-none">回响</div>
            <div className="mt-1 text-[10px] tracking-widest text-muted-foreground">
              职场第二大脑
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">陪伴模式 · 运行中</span>
            <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 底部导航（移动端） */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="pb-20 md:pb-0 md:pl-56">{children}</main>
    </div>
  );
}
