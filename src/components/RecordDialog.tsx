import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { processRecording } from "@/lib/recording.functions";

export function RecordDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const runProcess = useServerFn(processRecording);
  const [phase, setPhase] = useState<"idle" | "recording" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start();
      recorderRef.current = rec;
      setPhase("recording");
    } catch {
      toast.error("需要麦克风权限才能录音");
    }
  }

  async function stop() {
    const rec = recorderRef.current;
    if (!rec) return;
    setPhase("uploading");
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });
    rec.stream.getTracks().forEach((t) => t.stop());
    if (blob.size < 2048 || !user) {
      toast.error("录音太短，请重试");
      setPhase("idle");
      return;
    }
    try {
      const title = `会议录音 ${new Date().toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const path = `${user.id}/${crypto.randomUUID()}.webm`;
      const { error: upErr } = await supabase.storage.from("recordings").upload(path, blob);
      if (upErr) throw upErr;
      const { data: row, error: insErr } = await supabase
        .from("recordings")
        .insert({ title, audio_path: path, duration_sec: seconds, status: "transcribing" })
        .select("id")
        .single();
      if (insErr) throw insErr;
      toast.success("录音已保存，正在转写");
      navigate({ to: "/meetings/$id", params: { id: row.id } });
      // 后台转写，不阻塞跳转
      runProcess({ data: { recordingId: row.id } }).catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
      setPhase("idle");
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${phase === "recording" ? "bg-destructive/20" : "bg-secondary"}`}>
          {phase === "uploading" ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : phase === "recording" ? (
            <span className="h-6 w-6 animate-pulse rounded-full bg-destructive" />
          ) : (
            <Mic className="h-8 w-8 text-primary" />
          )}
        </div>
        <div className="mt-4 font-mono text-3xl font-medium tabular-nums">{mm}:{ss}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {phase === "recording" ? "深度录音中 · 音频与逐字稿将被完整保存" : phase === "uploading" ? "正在保存与转写…" : "结束后自动转写并生成摘要"}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-accent">
            取消
          </button>
          {phase === "recording" ? (
            <button onClick={stop} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground">
              <Square className="h-4 w-4" /> 结束
            </button>
          ) : (
            <button
              onClick={start}
              disabled={phase === "uploading"}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              开始
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
