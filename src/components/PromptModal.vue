<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Modal from "./Modal.vue";

const props = defineProps<{
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  /** 可选第二输入框(如博客新文档的副标题);不传则不显示 */
  extraLabel?: string;
  extraPlaceholder?: string;
  confirmText?: string;
}>();

const emit = defineEmits<{ confirm: [value: string, extra: string]; cancel: [] }>();
const { t } = useI18n();
const value = ref("");
const extraValue = ref("");
const inputRef = ref<HTMLInputElement>();

watch(
  () => props.open,
  (open) => {
    if (open) {
      value.value = props.initial ?? "";
      extraValue.value = "";
      // autofocus 在 Teleport 弹层中不可靠,显式聚焦
      void nextTick(() => inputRef.value?.focus());
    }
  },
);

function submit() {
  const v = value.value.trim();
  if (v) emit("confirm", v, extraValue.value.trim());
}
</script>

<template>
  <Modal v-if="open" :title="title" :width="380" @cancel="emit('cancel')">
    <label v-if="label" class="field-label">{{ label }}</label>
    <input
      ref="inputRef"
      v-model="value"
      class="input"
      type="text"
      :placeholder="placeholder ?? ''"
      autofocus
      @keydown.enter="submit"
      @keydown.esc="emit('cancel')"
    />
    <template v-if="extraLabel">
      <label class="field-label mt-3">{{ extraLabel }}</label>
      <input
        v-model="extraValue"
        class="input"
        type="text"
        :placeholder="extraPlaceholder ?? ''"
        @keydown.enter="submit"
        @keydown.esc="emit('cancel')"
      />
    </template>
    <template #footer>
      <button class="btn btn-secondary" @click="emit('cancel')">{{ t("common.cancel") }}</button>
      <button class="btn btn-primary" :disabled="!value.trim()" @click="submit">
        {{ confirmText ?? t("common.confirm") }}
      </button>
    </template>
  </Modal>
</template>
