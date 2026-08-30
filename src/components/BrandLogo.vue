<script setup lang="ts">
/** 左上角品牌 logo -- 与 public/logo.svg 同一图形(展平为最终坐标),眼睛隔几秒眨一次,并小幅度跟随鼠标 */
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{ size?: number }>(), { size: 20 });

const svgEl = ref<SVGSVGElement | null>(null);

let raf = 0;
let targetX = 0;
let targetY = 0;
let curX = 0;
let curY = 0;

function onMove(e: MouseEvent) {
  const svg = svgEl.value;
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  // 目标位移以「屏幕像素」表达,再换算成 viewBox 单位(CSS transform 的 px 在 SVG 里等于用户单位)
  const unit = 251 / Math.max(r.width, 1);
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  targetX = (Math.max(-1, Math.min(1, dx / 180)) * 1.3 * unit);
  targetY = (Math.max(-1, Math.min(1, dy / 140)) * 1.0 * unit);
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

/** 每次眨眼后随机化下一次间隔(3-6.5s),避免机械感 */
function onBlinkIteration() {
  svgEl.value?.style.setProperty("--blink-dur", (3 + Math.random() * 3.5).toFixed(2) + "s");
}

onMounted(() => {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener("mousemove", onMove, { passive: true });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onMove);
  if (raf) cancelAnimationFrame(raf);
});

defineExpose({ props });
void props;
</script>

<template>
  <!-- 形状与 public/logo.svg 等价:嘴(底横条)、左侧括号、15% 斜杠、双眼 -->
  <svg
    ref="svgEl"
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
      <g class="eye-blink" @animationiteration="onBlinkIteration">
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
.eye-follow {
  transform: translate(var(--eye-x, 0), var(--eye-y, 0));
  will-change: transform;
}
.eye-blink {
  animation: eye-blink var(--blink-dur, 4.6s) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes eye-blink {
  0%,
  92% {
    transform: scaleY(1);
  }
  94.5% {
    transform: scaleY(0.08);
  }
  97%,
  100% {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .eye-blink {
    animation: none;
  }
  .eye-follow {
    transform: none;
  }
}
</style>
