import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Languages, Mic, Square, Loader2, Headphones, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { translateAudio } from "@/lib/recording.functions";

export const Route = createFileRoute("/translate")({
  head: () => ({
    meta: [
      { title: "实时翻译 · 回响" },
      { name: "description", content: "双人对话翻译与现场同传收听，说完即出译文。" },
      { property: "og:title", content: "实时翻译 · 回响" },
      { property: "og:description", content: "双人对话翻译与现场同传收听，说完即出译文。" },
    ],
  }),
  component: TranslatePage,
});

const LANGS = ["中文", "英语", "日语", "韩语", "法语", "德语", "西班牙语"];

type Line = { id: string; speaker: "我" | "对方" | "现场"; original: string; translated: string; lang: string };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function TranslatePage() {
  const translate = useServerFn(translateAudio);
  const [mode, setMode] = useState<"dialog" | "listen">("dialog");
  const [myLang, setMyLang] = useState("中文");
  const [otherLang, setOtherLang] = useState("英语");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<null | "me" | "other" | "listen">(null);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listenRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy]);

  useEffect(() => () => {
    listenRef.current = false;
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function recordOnce(ms?: number): Promise<Blob> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    recRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
    });
    rec.start();
    if (ms) setTimeout(() => rec.state !== "inactive" && rec.stop(), ms);
    return done;
  }

  async function handleSegment(blob: Blob, speaker: Line["speaker"], target: string) {
    if (blob.size < 2000) return;
    setBusy(true);
    try {
      const base64 = await blobToBase64(blob);
      const res = await translate({ data: { audioBase64: base64, mimeType: "audio/webm", targetLang: target } });
      setLines((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          speaker,
          original: res.original,
          translated: res.translated,
          lang: res.detectedLang,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "翻译失败");
    } finally {
      setBusy(false);
    }
  }

  async function startDialog(side: "me" | "other") {
    setError(null);
    setRecording(side);
    try {
      const blob = await recordOnce();
      setRecording(null);
      await handleSegment(blob, side === "me" ? "我" : "对方", side === "me" ? otherLang : myLang);
    } catch {
      setRecording(null);
      setError("无法使用麦克风");
    }
  }

  function stopDialog() {
    recRef.current?.state !== "inactive" && recRef.current?.stop();
  }

  async function toggleListen() {
    if (listenRef.current) {
      listenRef.current = false;
      setRecording(null);
      recRef.current?.state !== "inactive" && recRef.current?.stop();
      return;
    }
    setError(null);
    listenRef.current = true;
    setRecording("listen");
    try {
      while (listenRef.current) {
        const blob = await recordOnce(10000);
        if (!listenRef.current && blob.size < 2000) break;
        await handleSegment(blob, "现场", myLang);
      }
    } catch {
      setError("无法使用麦克风");
    } finally {
      listenRef.current = false;
      setRecording(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col px-4 py-6 md:h-screen md:px-8">
        <header className="mb-4">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Languages className="h-5 w-5 text-primary" />
            实时翻译
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            对话翻译轮流按住说话；同传收听每 10 秒滚动出一句译文。翻译内容不保存录音。
          </p>
        </header>

        <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
          {([
            ["dialog", "双人对话", MessagesSquare],
            ["listen", "同传收听", Headphones],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                mode === key ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2 text-xs">
          <LangSelect label="我说" value={myLang} onChange={setMyLang} />
          {mode === "dialog" && <LangSelect label="对方说" value={otherLang} onChange={setOtherLang} />}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
          {lines.length === 0 && !busy && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {mode === "dialog" ? "点下方按钮开始说话，松开即出译文。" : "点开始收听，现场语音会持续翻译成你的语言。"}
            </p>
          )}
          {lines.map((l) => (
            <div key={l.id} className={`rounded-lg p-3 ${l.speaker === "我" ? "bg-primary/10" : "bg-secondary"}`}>
              <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{l.speaker}</span>
                <span>{l.lang}</span>
              </div>
              <p className="text-sm font-medium leading-relaxed">{l.translated}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{l.original}</p>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> 正在翻译…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

        <div className="mt-4 flex gap-3 pb-2">
          {mode === "dialog" ? (
            recording ? (
              <button
                onClick={stopDialog}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground"
              >
                <Square className="h-4 w-4" /> 说完了（{recording === "me" ? "我" : "对方"}）
              </button>
            ) : (
              <>
                <button
                  onClick={() => startDialog("me")}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Mic className="h-4 w-4" /> 我说（{myLang}）
                </button>
                <button
                  onClick={() => startDialog("other")}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium disabled:opacity-50"
                >
                  <Mic className="h-4 w-4" /> 对方说（{otherLang}）
                </button>
              </>
            )
          ) : (
            <button
              onClick={toggleListen}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                recording === "listen"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {recording === "listen" ? <Square className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
              {recording === "listen" ? "停止收听" : "开始收听同传"}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function LangSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs font-medium outline-none"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
