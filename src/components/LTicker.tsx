import { useLayoutEffect, useRef } from "react";
// 表示用 PC のフォントに左右されないよう、テロップ用の書体を同梱する
import "@fontsource/noto-sans-jp/700.css";
import type { TickerSpeed } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 帯の太さ。表示エリアはこの分だけ左・下が狭くなる */
export const BAND = "12vh";

/** 1 秒あたりに流れる距離（画面の高さに対する %） */
const SPEED_VH: Record<TickerSpeed, number> = { slow: 8, normal: 13, fast: 20 };

const FONT_SIZE = "6.4vh";
const FONT_FAMILY = "'Noto Sans JP', sans-serif";
// 左と下の帯が継ぎ目なくつながるよう、同じ単色にする
const BAND_BG = "#0a2c72";
const EDGE = "#5fa8ff";
const EDGE_WIDTH = "0.4vh";

/**
 * 災害情報の L 字放送のような帯。左列と下列はそれぞれ別の文言を流す。
 * 左列: 縦書きで下から上へ。下列: 右から左へ。空の列は帯ごと出さない。
 */
export function LTicker({ left, bottom, speed }: { left: string; bottom: string; speed: TickerSpeed }) {
  const showLeft = left.trim() !== "";
  const showBottom = bottom.trim() !== "";

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none" style={{ fontFamily: FONT_FAMILY }}>
      {showLeft && (
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{
            width: BAND,
            bottom: showBottom ? BAND : 0,
            background: BAND_BG,
            boxShadow: `inset -${EDGE_WIDTH} 0 0 ${EDGE}`,
          }}
        >
          <Marquee text={left} speed={speed} vertical />
        </div>
      )}
      {showBottom && (
        // 上端の線は全幅に引き、左列との境目にもする
        <div
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: BAND, background: BAND_BG, boxShadow: `inset 0 ${EDGE_WIDTH} 0 ${EDGE}` }}
        >
          <Marquee text={bottom} speed={speed} />
        </div>
      )}
    </div>
  );
}

function Marquee({ text, speed, vertical = false }: { text: string; speed: TickerSpeed; vertical?: boolean }) {
  // 改行は区切りの空白にして 1 行で流す
  const message = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("　　　");

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
      // 帯の外から入ってきて、全部が反対側へ抜けたら最初に戻る
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
    <div ref={boxRef} className="absolute inset-0">
      <span
        ref={textRef}
        className={cn(
          "absolute whitespace-nowrap font-bold leading-none text-white will-change-transform",
          vertical
            ? "left-1/2 top-0 -ml-[0.5em] [text-orientation:upright] [writing-mode:vertical-rl]"
            : "left-0 top-1/2 -mt-[0.45em]",
        )}
        style={{ fontSize: FONT_SIZE, textShadow: "0 0.25vh 0.4vh rgba(0,0,0,0.55)" }}
      >
        {message}
      </span>
    </div>
  );
}
