import { defineStore } from "pinia";

/** 右键菜单项;separator = true 时渲染分隔线(忽略其余字段) */
export interface MenuItem {
  id: string;
  label?: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  run?: () => void;
}

interface State {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
}

export const useContextMenuStore = defineStore("contextMenu", {
  state: (): State => ({
    open: false,
    x: 0,
    y: 0,
    items: [],
  }),

  actions: {
    show(x: number, y: number, items: MenuItem[]) {
      if (!items.length) return;
      this.x = x;
      this.y = y;
      this.items = items;
      this.open = true;
    },

    close() {
      this.open = false;
      this.items = [];
    },
  },
});
