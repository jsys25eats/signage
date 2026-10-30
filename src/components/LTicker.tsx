import { useLayoutEffect, useRef } from "react";
// 表示用 PC のフォントに左右されないよう、テロップ用の書体を同梱する
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/noto-sans-jp/900.css";
import type { TickerSpeed } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 帯の太さ。表示エリアはこの分だけ左と下が狭くなる */
export const BAND = "12vh";

/** 1 秒あたりに流れる距離（画面の高さに対する %） */
const SPEED_VH: Record<TickerSpeed, number> = { slow: 8, normal: 13, fast: 20 };

const FONT_SIZE = "6.4vh";
const FONT_FAMILY = "'Noto Sans JP', sans-serif";
const BAND_BG = "linear-gradient(180deg, #0d3a8c 0%, #082a6e 55%, #061f55 100%)";
const BAND_BG_VERTICAL = "linear-gradient(90deg, #0d3a8c 0%, #082a6e 55%, #061f55 100%)";
const EDGE = "#5fa8ff";

/**
 * 災害情報の L 字放送のような帯。
 * 左端: 上に見出し、その下を縦書きで下から上へ。下端: 右から左へ。
 */
export function LTicker({ label, text, speed }: { label: string; text: string; speed: TickerSpeed }) {
  // 改行は区切りの空白にして 1 行で流す
  const message = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("　　　");

  return (
    <>
      <div
        className="absolute left-0 top-0 z-[5] flex flex-col overflow-hidden"
        style={{
          width: BAND,
          bottom: BAND,
          background: BAND_BG_VERTICAL,
          boxShadow: `inset -0.4vh 0 0 ${EDGE}`,
          fontFamily: FONT_FAMILY,
        }}
      >
        {label && (
          <div
            className="flex shrink-0 justify-center bg-gradient-to-b from-[#e8202e] to-[#b10f1c] pb-[1.8vh] pt-[2.6vh] font-black tracking-[0.15em] text-white [text-orientation:upright] [writing-mode:vertical-rl]"
            style={{ fontSize: "5.2vh", boxShadow: `inset -0.4vh 0 0 ${EDGE}, 0 0.4vh 0 #ffd400` }}
          >
            {label}
          </div>
        )}
        <div className="relative min-h-0 flex-1">
          <Marquee message={message} speed={speed} vertical />
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 z-[5] overflow-hidden"
        style={{ height: BAND, background: BAND_BG, boxShadow: `inset 0 0.4vh 0 ${EDGE}`, fontFamily: FONT_FAMILY }}
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
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      <span
        ref={textRef}
        className={cn(
          "absolute whitespace-nowrap font-bold leading-none text-white will-change-transform",
          vertical
            ? "left-1/2 top-0 -ml-[0.55em] tracking-[0.05em] [text-orientation:upright] [writing-mode:vertical-rl]"
            : "left-0 top-1/2 -mt-[0.45em]",
        )}
        style={{ fontSize: FONT_SIZE, textShadow: "0 0.25vh 0.4vh rgba(0,0,0,0.55)" }}
      >
        {message}
      </span>
    </div>
  );
}
