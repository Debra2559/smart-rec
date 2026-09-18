import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Mic,
  MessageCircle,
  User,
  LogOut,
  Radio,
  Languages,
  CalendarDays,
  Plus,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";

const NAV = [
  { to: "/", label: "今天", icon: LayoutGrid },
  { to: "/meetings", label: "记录", icon: Mic },
  { to: "/ask", label: "问答", icon: MessageCircle },
  { to: "/settings", label: "我的", icon: User },
] as const;

const SECONDARY = [
  { to: "/translate", label: "实时翻译", icon: Languages },
  { to: "/review", label: "月度回顾", icon: CalendarDays },
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

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 侧边导航（桌面） */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
          <img src={logo} alt="回响" className="h-8 w-8" />
          <div>
            <div className="font-display text-lg font-bold leading-none tracking-tight">回响</div>
            <div className="mt-1 text-[10px] tracking-widest text-muted-foreground">
              职场第二大脑
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive(item.to)
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <div className="px-3 pt-5 pb-1 text-[10px] font-medium tracking-widest text-muted-foreground">
            工具
          </div>
          {SECONDARY.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive(item.to)
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">陪伴模式 · 运行中</span>
            <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-secondary hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 底部导航（移动端）· 4 个标签 + 中央录音键 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="relative flex items-stretch">
          {NAV.slice(0, 2).map((item) => (
            <TabLink key={item.to} {...item} active={isActive(item.to)} />
          ))}
          <div className="w-16 shrink-0" />
          {NAV.slice(2).map((item) => (
            <TabLink key={item.to} {...item} active={isActive(item.to)} />
          ))}
          <Link
            to="/meetings"
            search={{ rec: "1" }}
            aria-label="开始深度录音"
            className="absolute -top-6 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>
      </nav>

      <main className="pb-24 md:pb-0 md:pl-60">{children}</main>
    </div>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Mic;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
      {label}
    </Link>
  );
}
