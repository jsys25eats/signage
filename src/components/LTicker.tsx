import { useLayoutEffect, useRef } from "react";
import type { TickerSpeed } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 帯の太さ。表示エリアはこの分だけ左と下が狭くなる */
export const BAND = "9vh";

/** 1 秒あたりに流れる距離（画面の高さに対する %） */
const SPEED_VH: Record<TickerSpeed, number> = { slow: 8, normal: 13, fast: 20 };

/** 左端（縦書き・下から上へ）と下端（右から左へ）にテロップを流す */
export function LTicker({ text, speed }: { text: string; speed: TickerSpeed }) {
  // 改行は区切りの空白にして 1 行で流す
  const message = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("　　　");

  return (
    <>
      <div
        className="absolute left-0 top-0 z-[5] overflow-hidden border-r border-white/10 bg-[#0b1a3a]"
        style={{ width: BAND, bottom: BAND }}
      >
        <Marquee message={message} speed={speed} vertical />
      </div>
      <div
        className="absolute inset-x-0 bottom-0 z-[5] overflow-hidden border-t border-white/10 bg-[#0b1a3a]"
        style={{ height: BAND }}
      >
        <Marquee message={message} speed={speed} />
      </div>
    </>
  );
}

function Marquee({ message, speed, vertical = false }: { message: string; speed: TickerSpeed; vertical?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;
    let anim: Animation | undefined;

    const start = () => {
      anim?.cancel();
      const boxLen = vertical ? box.clientHeight : box.clientWidth;
      const textLen = vertical ? el.offsetHeight : el.offsetWidth;
      const pxPerSec = (SPEED_VH[speed] * window.innerHeight) / 100;
      if (!boxLen || !textLen || !pxPerSec) return;
      // 画面外から入ってきて、全部が反対側へ抜けたら最初に戻る
      const axis = vertical ? "translateY" : "translateX";
      anim = el.animate(
        [{ transform: `${axis}(${boxLen}px)` }, { transform: `${axis}(${-textLen}px)` }],
        { duration: ((boxLen + textLen) / pxPerSec) * 1000, iterations: Infinity, easing: "linear" },
      );
    };

    start();
    const ro = new ResizeObserver(start);
    ro.observe(box);
    return () => {
      ro.disconnect();
      anim?.cancel();
    };
  }, [message, speed, vertical]);

  return (
    <div ref={boxRef} className="relative h-full w-full">
      <span
        ref={textRef}
        className={cn(
          "absolute whitespace-nowrap font-bold leading-none text-white will-change-transform",
          vertical ? "left-1/2 top-0 -ml-[0.5em] [text-orientation:upright] [writing-mode:vertical-rl]" : "left-0 top-1/2 -mt-[0.5em]",
        )}
        style={{ fontSize: "5vh" }}
      >
        {message}
      </span>
    </div>
  );
}
