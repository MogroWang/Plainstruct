<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Modal from "./Modal.vue";

const props = defineProps<{
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  confirmText?: string;
}>();

const emit = defineEmits<{ confirm: [value: string]; cancel: [] }>();
const { t } = useI18n();
const value = ref("");

watch(
  () => props.open,
  (open) => {
    if (open) value.value = props.initial ?? "";
  },
);

function submit() {
  const v = value.value.trim();
  if (v) emit("confirm", v);
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
    <template #footer>
      <button class="btn btn-secondary" @click="emit('cancel')">{{ t("common.cancel") }}</button>
      <button class="btn btn-primary" :disabled="!value.trim()" @click="submit">
        {{ confirmText ?? t("common.confirm") }}
      </button>
    </template>
  </Modal>
</template>
