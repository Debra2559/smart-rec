import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldCheck,
  Radio,
  Mic,
  Watch,
  Trash2,
  LogOut,
  CalendarDays,
  Languages,
  Sprout,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "设置与隐私 · 回响" },
      { name: "description", content: "隐私承诺、设备状态与数据管理。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  async function deleteAllMyData() {
    if (!user) return;
    const tables = ["todos", "events", "emotion_points", "health_metrics", "chat_messages", "day_summaries", "recordings"] as const;
    for (const t of tables) {
      await supabase.from(t).delete().eq("user_id", user.id);
    }
    queryClient.clear();
    setConfirming(false);
    toast.success("你的数据已全部删除");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <h1 className="mb-1 font-display text-[28px] font-semibold">我的</h1>
        <p className="mb-5 text-sm text-muted-foreground">{user?.email}</p>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link
            to="/growth"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Sprout className="h-4 w-4 text-primary" />
            成长
          </Link>
          <Link
            to="/review"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            月度回顾
          </Link>
          <Link
            to="/translate"
            className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Languages className="h-4 w-4 text-primary" />
            实时翻译
          </Link>
        </div>

        {/* 隐私契约 */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            两种模式的隐私契约
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-secondary/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Radio className="h-4 w-4 text-primary" /> 陪伴模式
              </div>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>· 不保存任何音频文件</li>
                <li>· 不保留对话原文与逐字稿</li>
                <li>· 不做声纹识别</li>
                <li>· 只保留摘要、待办与情绪标签</li>
              </ul>
            </div>
            <div className="rounded-lg bg-secondary/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mic className="h-4 w-4 text-primary" /> 深度录音
              </div>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>· 由你手动开启，有明确提示</li>
                <li>· 音频与逐字稿完整保存</li>
                <li>· 仅你本人可见（行级加密隔离）</li>
                <li>· 请遵守当地录音知情同意法规</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 设备 */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Watch className="h-4 w-4 text-primary" /> 设备与健康数据
          </h2>
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
            <div>
              <p className="text-sm">回响录音设备</p>
              <p className="mt-0.5 text-xs text-muted-foreground">未连接 · 配对后自动同步</p>
            </div>
            <button className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent" disabled>
              配对
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
            <div>
              <p className="text-sm">健康数据来源</p>
              <p className="mt-0.5 text-xs text-muted-foreground">支持心率、睡眠、步数等指标，只读展示，不做医疗结论</p>
            </div>
            <button className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent" disabled>
              授权
            </button>
          </div>
        </section>

        {/* 数据管理 */}
        <section className="mb-6 rounded-xl border border-destructive/30 bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-destructive">
            <Trash2 className="h-4 w-4" /> 数据管理
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            删除后将清空你的全部事件、待办、情绪、健康数据、录音与问答记录，且无法恢复。
          </p>
          {confirming ? (
            <div className="flex gap-2">
              <button
                onClick={deleteAllMyData}
                className="rounded-lg bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground"
              >
                确认删除全部数据
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-accent"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg border border-destructive/50 px-4 py-2 text-xs text-destructive hover:bg-destructive/10"
            >
              删除我的全部数据
            </button>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">{user?.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">当前登录账号</p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> 退出登录
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
