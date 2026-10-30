import { useLayoutEffect, useRef } from "react";
// 表示用 PC のフォントに左右されないよう、テロップ用の書体を同梱する
import "@fontsource/noto-sans-jp/700.css";
import type { TickerSpeed } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 帯の太さ。表示エリアはこの分だけ左と下が狭くなる */
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
 * 災害情報の L 字放送のような帯。
 * 文言は 1 本につながっていて、下端を右から左へ流れ、左下の角で曲がって左端を上へ抜ける。
 * 読む順は「左端を上→下、続けて下端を左→右」。
 */
export function LTicker({ text, speed }: { text: string; speed: TickerSpeed }) {
  // 改行は区切りの空白にして 1 本で流す
  const message = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("　　　");
  // 縦と横で長さを揃えるため、1 文字ずつ 1em の枠に入れる
  const chars = Array.from(message);

  const leftTrack = useRef<HTMLDivElement>(null);
  const bottomTrack = useRef<HTMLDivElement>(null);
  const vText = useRef<HTMLDivElement>(null);
  const hText = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const lt = leftTrack.current;
    const bt = bottomTrack.current;
    const v = vText.current;
    const h = hText.current;
    if (!lt || !bt || !v || !h) return;
    let anims: Animation[] = [];

    const start = () => {
      anims.forEach((a) => a.cancel());
      anims = [];
      const trackW = bt.clientWidth;
      const trackH = lt.clientHeight;
      const textLen = h.offsetWidth;
      const pxPerSec = (SPEED_VH[speed] * window.innerHeight) / 100;
      if (!trackW || !trackH || !textLen || !pxPerSec) return;

      // 先頭が右端から入り、末尾が左端の上から抜けるまでの道のり
      const distance = trackW + trackH + textLen;
      const timing: KeyframeAnimationOptions = {
        duration: (distance / pxPerSec) * 1000,
        iterations: Infinity,
        easing: "linear",
      };
      // 横: 下端の帯の左端を 0 とした位置。縦: 左端の帯の上端を 0 とした位置。
      // 横で左端を越えた分だけ、縦では下端から上に出てくる
      anims = [
        h.animate([{ transform: `translateX(${trackW}px)` }, { transform: `translateX(${trackW - distance}px)` }], timing),
        v.animate(
          [{ transform: `translateY(${trackH + trackW}px)` }, { transform: `translateY(${trackH + trackW - distance}px)` }],
          timing,
        ),
      ];
      const t = document.timeline.currentTime;
      anims.forEach((a) => (a.startTime = t));
    };

    start();
    const ro = new ResizeObserver(start);
    ro.observe(lt);
    ro.observe(bt);
    return () => {
      ro.disconnect();
      anims.forEach((a) => a.cancel());
    };
  }, [message, speed]);

  const cells = chars.map((c, i) => (
    <span key={i} className="inline-block text-center" style={{ inlineSize: "1em" }}>
      {c}
    </span>
  ));
  const textStyle = { fontSize: FONT_SIZE, textShadow: "0 0.25vh 0.4vh rgba(0,0,0,0.55)" };

  return (
    <>
      {/* 表示エリアとの境目の線。角がきれいにつながるよう 1 つの要素の左と下の枠線で描く */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-[6]"
        style={{
          left: `calc(${BAND} - ${EDGE_WIDTH})`,
          bottom: `calc(${BAND} - ${EDGE_WIDTH})`,
          borderLeft: `${EDGE_WIDTH} solid ${EDGE}`,
          borderBottom: `${EDGE_WIDTH} solid ${EDGE}`,
        }}
      />
      <div
        className="absolute left-0 top-0 z-[5] overflow-hidden"
        style={{
          width: BAND,
          bottom: BAND,
          background: BAND_BG,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div ref={leftTrack} className="absolute inset-0 overflow-hidden">
          <div
            ref={vText}
            className={cn(
              "absolute left-1/2 top-0 -ml-[0.5em] whitespace-nowrap font-bold leading-none text-white will-change-transform",
              "[text-orientation:upright] [writing-mode:vertical-rl]",
            )}
            style={textStyle}
          >
            {cells}
          </div>
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 z-[5]"
        style={{ height: BAND, background: BAND_BG, fontFamily: FONT_FAMILY }}
      >
        <div ref={bottomTrack} className="absolute inset-y-0 right-0 overflow-hidden" style={{ left: BAND }}>
          <div
            ref={hText}
            className="absolute left-0 top-1/2 -mt-[0.45em] whitespace-nowrap font-bold leading-none text-white will-change-transform"
            style={textStyle}
          >
            {cells}
          </div>
        </div>
      </div>
    </>
  );
}
