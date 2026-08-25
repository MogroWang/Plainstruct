<script setup lang="ts">
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { useSiteStore } from "@/stores/site";
import { useUiStore } from "@/stores/ui";
import { ipc } from "@/ipc/ipc";
import { formatTime } from "@/lib/format";
import AppIcon from "@/components/AppIcon.vue";

const { t } = useI18n();
const app = useAppStore();
const site = useSiteStore();
const ui = useUiStore();

const showWizard = ref(false);
const wizard = reactive({ name: "", description: "", folder: "" });
const wizardError = ref("");
const creating = ref(false);

async function chooseFolder() {
  const dir = await ipc.pickDirectory();
  if (dir) wizard.folder = dir;
}

async function createSite() {
  if (!wizard.name.trim()) {
    wizardError.value = t("wizard.invalidName");
    return;
  }
  if (!wizard.folder) {
    wizardError.value = t("wizard.invalidFolder");
    return;
  }
  creating.value = true;
  wizardError.value = "";
  try {
    await site.create(wizard.folder, wizard.name.trim(), wizard.description.trim() || undefined);
    showWizard.value = false;
  } catch (e) {
    const msg = ipc.errText(e);
    wizardError.value = msg.includes("occupied") ? t("wizard.occupied") : msg;
  } finally {
    creating.value = false;
  }
}

async function openSite() {
  const dir = await ipc.pickDirectory();
  if (!dir) return;
  try {
    await site.openDir(dir);
  } catch (e) {
    const msg = ipc.errText(e);
    ui.toast(msg.includes("not-a-site") ? t("start.notASite") : t("start.openFailed", { msg }), "error");
  }
}

async function openRecent(path: string) {
  try {
    await site.openDir(path);
  } catch {
    ui.toast(t("start.openFailed", { msg: t("start.notASite") }), "error");
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <div class="mx-auto flex min-h-full w-full max-w-[480px] flex-col items-center justify-center px-6 py-16">
      <img src="/logo-full.svg" alt="Plainstruct" class="h-11 select-none" draggable="false" />
      <p class="mt-6 text-center text-[14px] leading-relaxed text-ink-2">{{ t("app.tagline") }}</p>

      <div class="mt-10 flex w-full gap-3">
        <button class="btn btn-primary h-10 flex-1" @click="showWizard = true">
          <AppIcon name="plus" :size="16" />
          {{ t("start.createSite") }}
        </button>
        <button class="btn btn-secondary h-10 flex-1" @click="openSite">
          <AppIcon name="folder" :size="16" />
          {{ t("start.openSite") }}
        </button>
      </div>

      <div class="mt-12 w-full">
        <h2 class="field-label">{{ t("start.recent") }}</h2>
        <div v-if="!app.recentSites.length" class="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-3">
          {{ t("start.recentEmpty") }}
        </div>
        <TransitionGroup v-else name="list" tag="div" class="panel divide-y divide-line overflow-hidden">
          <button
            v-for="item in app.recentSites"
            :key="item.path"
            class="recent-item"
            @click="openRecent(item.path)"
          >
            <AppIcon name="folder" :size="16" class="text-ink-3" />
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate text-[13.5px] font-medium">{{ item.name }}</span>
              <span class="block truncate text-[11.5px] text-ink-3">{{ item.path }}</span>
            </span>
            <span class="shrink-0 text-[11.5px] text-ink-3">{{ formatTime(item.openedAt) }}</span>
          </button>
        </TransitionGroup>
      </div>

      <button class="btn btn-ghost mt-10 h-9 px-4 text-[12.5px] text-ink-3" @click="app.setView('about')">
        <AppIcon name="info" :size="15" />
        {{ t("nav.about") }}
      </button>
    </div>

    <!-- 新建站点向导 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showWizard" class="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div class="absolute inset-0 bg-[rgba(28,25,23,0.32)]" @click="showWizard = false" />
          <div class="modal-card panel relative w-full max-w-[440px] shadow-window">
            <header class="px-6 pb-2 pt-5">
              <h2 class="text-[16px] font-semibold">{{ t("wizard.title") }}</h2>
            </header>
            <div class="flex flex-col gap-4 px-6 pb-2">
              <div>
                <label class="field-label">{{ t("wizard.name") }}</label>
                <input
                  v-model="wizard.name"
                  class="input"
                  type="text"
                  :placeholder="t('wizard.namePlaceholder')"
                  autofocus
                  @keydown.enter="createSite"
                />
              </div>
              <div>
                <label class="field-label">{{ t("wizard.description") }}</label>
                <input
                  v-model="wizard.description"
                  class="input"
                  type="text"
                  :placeholder="t('wizard.descriptionPlaceholder')"
                  @keydown.enter="createSite"
                />
              </div>
              <div>
                <label class="field-label">{{ t("wizard.folder") }}</label>
                <div class="flex gap-2">
                  <input class="input !text-[12px]" type="text" readonly :value="wizard.folder" :placeholder="t('wizard.chooseFolder')" />
                  <button class="btn btn-secondary shrink-0" @click="chooseFolder">
                    {{ t("wizard.chooseFolder") }}
                  </button>
                </div>
                <p class="field-hint">{{ t("wizard.folderHint") }}</p>
              </div>
              <p v-if="wizardError" class="text-[12.5px] text-danger">{{ wizardError }}</p>
            </div>
            <footer class="mt-4 flex justify-end gap-2 border-t border-line px-6 py-4">
              <button class="btn btn-secondary" @click="showWizard = false">{{ t("common.cancel") }}</button>
              <button class="btn btn-primary" :disabled="creating" @click="createSite">
                {{ creating ? t("common.loading") : t("wizard.create") }}
              </button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color var(--duration-base) var(--ease-plain);
}
.recent-item:hover {
  background: var(--color-surface-2);
}
.recent-item:active {
  opacity: 0.8;
}
</style>
