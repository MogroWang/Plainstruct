<script setup lang="ts">
/** 主题可视化配置面板 -- 由 theme.json 的 config schema 自动生成表单 */
import { useI18n } from "vue-i18n";
import type { ThemeField } from "@/ipc/types";
import { useThemeStore } from "@/stores/theme";

const { t } = useI18n();
const theme = useThemeStore();

function onField(field: ThemeField, value: string | number | boolean) {
  void theme.setConfigValue(field.key, value);
}

function fieldValue(field: ThemeField): string | number | boolean {
  return theme.configValues[field.key] ?? field.default ?? "";
}

/** visibleIf:仅当依赖字段(含默认值兜底)等于指定值时渲染该字段 */
function isVisible(field: ThemeField): boolean {
  const cond = field.visibleIf;
  if (!cond) return true;
  const dep = theme.activeMeta?.config.find((f) => f.key === cond.key);
  if (!dep) return true;
  return String(fieldValue(dep)) === String(cond.equals);
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-for="field in theme.activeMeta?.config ?? []" :key="field.key" v-show="isVisible(field)" class="flex flex-col">
      <!-- 开关自带行内标签,不再重复渲染标题 -->
      <label v-if="field.type !== 'boolean'" class="field-label">{{ field.label }}</label>

      <!-- 颜色 -->
      <div v-if="field.type === 'color'" class="flex items-center gap-2">
        <input
          type="color"
          class="color-input"
          :value="String(fieldValue(field))"
          @input="onField(field, ($event.target as HTMLInputElement).value)"
        />
        <span class="mono text-[12px] text-ink-2">{{ fieldValue(field) }}</span>
      </div>

      <!-- 数值 -->
      <div v-else-if="field.type === 'number'" class="flex items-center gap-3">
        <input
          type="range"
          class="range-input"
          :min="field.min ?? 0"
          :max="field.max ?? 100"
          :step="field.step ?? 1"
          :value="Number(fieldValue(field))"
          @input="onField(field, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="mono w-12 text-right text-[12px] text-ink-2">{{ fieldValue(field) }}</span>
      </div>

      <!-- 选项 -->
      <select
        v-else-if="field.type === 'select'"
        class="select !w-48"
        :value="String(fieldValue(field))"
        @change="onField(field, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in field.options ?? []" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <!-- 开关 -->
      <label v-else-if="field.type === 'boolean'" class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          class="checkbox-input"
          :checked="Boolean(fieldValue(field))"
          @change="onField(field, ($event.target as HTMLInputElement).checked)"
        />
        <span class="text-[13px] text-ink-2">{{ field.label }}</span>
      </label>

      <!-- 文本 -->
      <input
        v-else
        class="input !w-64"
        type="text"
        :value="String(fieldValue(field))"
        @change="onField(field, ($event.target as HTMLInputElement).value)"
      />
    </div>

    <p v-if="!(theme.activeMeta?.config ?? []).length" class="text-[13px] text-ink-3">
      {{ t("common.empty") }}
    </p>
  </div>
</template>

<style scoped>
.color-input {
  width: 32px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-surface);
  cursor: pointer;
}
.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.color-input::-webkit-color-swatch {
  border: none;
  border-radius: 5px;
}

.range-input {
  width: 192px;
  accent-color: var(--color-accent);
}

.checkbox-input {
  width: 15px;
  height: 15px;
  accent-color: var(--color-accent);
}
</style>
