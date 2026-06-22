import { create } from 'zustand';

interface RecordNavigatorConfig {
  currentIndex: number;
  total: number;
  label?: string;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
}

interface RecordNavigatorState {
  currentIndex: number;
  total: number;
  label: string;
  onFirst: (() => void) | null;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onLast: (() => void) | null;
  visible: boolean;

  register: (config: RecordNavigatorConfig) => void;
  updateIndex: (index: number) => void;
  updateTotal: (total: number) => void;
  unregister: () => void;
}

export const useRecordNavigatorStore = create<RecordNavigatorState>((set) => ({
  currentIndex: 0,
  total: 0,
  label: 'السجل',
  onFirst: null,
  onPrevious: null,
  onNext: null,
  onLast: null,
  visible: false,

  register: (config) => set({
    currentIndex: config.currentIndex,
    total: config.total,
    label: config.label ?? 'السجل',
    onFirst: config.onFirst,
    onPrevious: config.onPrevious,
    onNext: config.onNext,
    onLast: config.onLast,
    visible: true,
  }),

  updateIndex: (index) => set({ currentIndex: index }),
  updateTotal: (total) => set({ total }),
  
  unregister: () => set({
    currentIndex: 0,
    total: 0,
    label: 'السجل',
    onFirst: null,
    onPrevious: null,
    onNext: null,
    onLast: null,
    visible: false,
  })
}));
export type { RecordNavigatorConfig };
