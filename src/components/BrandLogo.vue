<script setup lang="ts">
/** 左上角品牌 logo -- 与 public/logo.svg 同一图形(展平为最终坐标)。
 *  动画:隔几秒眨眼(JS 调度一次性动画,避免中途改 duration 引起相位跳变闪烁)、
 *  小幅度跟随鼠标、鼠标点按时整体下压回弹 + 眼睛眯起。 */
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{ size?: number }>(), { size: 20 });

const svgEl = ref<SVGSVGElement | null>(null);

let raf = 0;
let targetX = 0;
let targetY = 0;
let curX = 0;
let curY = 0;
let blinkTimer = 0;
let pressResetTimer = 0;
let reduceMotion = false;

function onMove(e: MouseEvent) {
  const svg = svgEl.value;
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  // 目标位移以「屏幕像素」表达,再换算成 viewBox 单位(CSS transform 的 px 在 SVG 里等于用户单位)
  const unit = 251 / Math.max(r.width, 1);
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  targetX = Math.max(-1, Math.min(1, dx / 180)) * 1.3 * unit;
  targetY = Math.max(-1, Math.min(1, dy / 140)) * 1.0 * unit;
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick() {
  curX += (targetX - curX) * 0.12;
  curY += (targetY - curY) * 0.12;
  if (Math.abs(targetX - curX) < 0.02 && Math.abs(targetY - curY) < 0.02) {
    curX = targetX;
    curY = targetY;
    raf = 0;
  } else {
    raf = requestAnimationFrame(tick);
  }
  svgEl.value?.style.setProperty("--eye-x", curX.toFixed(2) + "px");
  svgEl.value?.style.setProperty("--eye-y", curY.toFixed(2) + "px");
}

/** 眨眼:一次性 class 动画,结束后移除,下一次由定时器重新触发 */
function blink() {
  const svg = svgEl.value;
  if (!svg) return;
  svg.classList.remove("blinking");
  void svg.getBoundingClientRect(); // 强制重排,确保 class 重新加回时动画能再次播放
  svg.classList.add("blinking");
}

function scheduleBlink() {
  blinkTimer = window.setTimeout(() => {
    blink();
    scheduleBlink();
  }, 2600 + Math.random() * 3600);
}

/** 鼠标点按反馈:整体轻压 + 眯眼;动画播放中忽略连点,避免抖动 */
function onPress() {
  const svg = svgEl.value;
  if (!svg || svg.classList.contains("pressed")) return;
  svg.classList.add("pressed");
  pressResetTimer = window.setTimeout(() => svg.classList.remove("pressed"), 360);
}

onMounted(() => {
  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  scheduleBlink();
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("pointerdown", onPress, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onMove);
  window.removeEventListener("pointerdown", onPress);
  clearTimeout(blinkTimer);
  clearTimeout(pressResetTimer);
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <!-- 形状与 public/logo.svg 等价:嘴(底横条)、左侧括号、15% 斜杠、双眼 -->
  <svg
    ref="svgEl"
    class="brand-logo"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 251 243"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="0" y="173.13" width="250.4" height="69.01" />
    <polygon
      points="69.01,173.13 69.01,242.14 0,242.14 0,21.7 69.01,21.7 69.01,90.71 34.5,90.71 34.5,173.13"
    />
    <polygon
      points="104.06,97.24 201.31,0 235.98,34.67 138.74,131.92"
      fill-opacity="0.15"
    />
    <g class="eye-follow">
      <g class="eye-blink">
        <rect x="89.71" y="0" width="49.04" height="131.92" />
      </g>
    </g>
    <g class="eye-follow">
      <g class="eye-blink">
        <rect x="201.37" y="0" width="49.03" height="131.92" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.brand-logo {
  transform-origin: center;
}
.brand-logo.pressed {
  animation: logo-press 340ms cubic-bezier(0.34, 1.4, 0.64, 1);
}

.eye-follow {
  transform: translate(var(--eye-x, 0px), var(--eye-y, 0px));
  will-change: transform;
}
.eye-blink {
  transform-box: fill-box;
  transform-origin: center;
}
.brand-logo.blinking .eye-blink {
  animation: eye-blink 300ms cubic-bezier(0.3, 0.6, 0.4, 1) both;
}
/* 点按反馈优先于眨眼:眯眼幅度略小,像开心地眯起来 */
.brand-logo.pressed .eye-blink {
  animation: eye-squint 340ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
}

@keyframes eye-blink {
  0% {
    transform: scaleY(1);
  }
  45% {
    transform: scaleY(0.06);
  }
  100% {
    transform: scaleY(1);
  }
}
@keyframes eye-squint {
  0% {
    transform: scaleY(1);
  }
  35% {
    transform: scaleY(0.3);
  }
  70% {
    transform: scaleY(0.45);
  }
  100% {
    transform: scaleY(1);
  }
}
@keyframes logo-press {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(0.9, 0.94);
  }
  100% {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .brand-logo.pressed,
  .brand-logo.blinking .eye-blink {
    animation: none;
  }
  .eye-follow {
    transform: none;
  }
}
</style>
