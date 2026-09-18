import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登录 · 回响" },
      { name: "description", content: "登录回响，开始你的全天候陪伴记录。" },
      { property: "og:title", content: "登录 · 回响" },
      { property: "og:description", content: "登录回响，开始你的全天候陪伴记录。" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/" });
        } else {
          toast.success("验证邮件已发送，请查收邮箱完成注册");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img src={logo} alt="回响" className="mx-auto h-16 w-16" />
          <h1 className="mt-4 font-display text-3xl font-bold">回响</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            听得见会议，记得住生活，读得懂身体。
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 6 位）"
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "没有账号？注册一个" : "已有账号？直接登录"}
        </button>

        <div className="mt-10 rounded-xl border border-border bg-card/50 p-4 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">隐私承诺：</span>
          陪伴模式只保留摘要，绝不保存音频与逐字稿；深度录音的音频与文字仅你本人可见。
        </div>
      </div>
    </div>
  );
}
