// ============================================================
// ZUSTAND STORE - UI STATE
// ============================================================

import { create } from 'zustand';
import type { ConstraintViolation } from '../domain/models';

type Tab = 'matching' | 'groupes';
type Modal = 'import' | 'importMatiereOral' | 'editEleve' | 'editEnseignant' | 'editAffectation' | 'editGroupe' | 'editScenario' | 'newScenario' | 'confirmDelete' | null;

// Dashboard card visibility preferences
export interface DashboardPreferences {
  showChecklist: boolean;
  showAlerts: boolean;
  showHistory: boolean;
  showStagesMap: boolean;
}

const DEFAULT_DASHBOARD_PREFS: DashboardPreferences = {
  showChecklist: true,
  showAlerts: true,
  showHistory: true,
  showStagesMap: true,
};

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  read?: boolean;
}

interface UIState {
  // Board
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  
  // Selection
  selectedEleveId: string | null;
  selectedEnseignantId: string | null;
  selectEleve: (id: string | null) => void;
  selectEnseignant: (id: string | null) => void;
  
  // Score breakdown
  scoreBreakdownTarget: string | null;
  setScoreBreakdownTarget: (id: string | null) => void;
  
  // Conflicts
  conflicts: ConstraintViolation[];
  setConflicts: (violations: ConstraintViolation[]) => void;
  
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Modal
  activeModal: Modal;
  modalData: unknown;
  openModal: (modal: Modal, data?: unknown) => void;
  setModalData: (data: unknown) => void;
  closeModal: () => void;
  
  // Drag & Drop
  draggedItemId: string | null;
  draggedItemType: 'eleve' | 'enseignant' | null;
  setDraggedItem: (id: string | null, type: 'eleve' | 'enseignant' | null) => void;
  
  // Settings
  expertMode: boolean;
  setExpertMode: (enabled: boolean) => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Dashboard preferences
  dashboardPrefs: DashboardPreferences;
  setDashboardPref: <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => void;
  toggleDashboardPref: (key: keyof DashboardPreferences) => void;
  resetDashboardPrefs: () => void;

  // Keyboard shortcuts help
  showShortcutsHelp: boolean;
  toggleShortcutsHelp: () => void;
  setShowShortcutsHelp: (show: boolean) => void;
}

let notificationId = 0;

export const useUIStore = create<UIState>((set, get) => ({
  // Board
  activeTab: 'matching',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Selection
  selectedEleveId: null,
  selectedEnseignantId: null,
  selectEleve: (id) => set({ selectedEleveId: id }),
  selectEnseignant: (id) => set({ selectedEnseignantId: id }),
  
  // Score breakdown
  scoreBreakdownTarget: null,
  setScoreBreakdownTarget: (id) => set({ scoreBreakdownTarget: id }),
  
  // Conflicts
  conflicts: [],
  setConflicts: (violations) => set({ conflicts: violations }),
  
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  // Modal
  activeModal: null,
  modalData: null,
  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  setModalData: (data) => set({ modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  
  // Drag & Drop
  draggedItemId: null,
  draggedItemType: null,
  setDraggedItem: (id, type) => set({ draggedItemId: id, draggedItemType: type }),
  
  // Settings
  expertMode: false,
  setExpertMode: (enabled) => {
    set({ expertMode: enabled });
    // Persister en localStorage
    localStorage.setItem('groupit_expertMode', String(enabled));
  },
  
  // Notifications
  notifications: [],
  addNotification: (notification) => {
    const id = String(++notificationId);
    set(state => ({
      notifications: [...state.notifications, { ...notification, id, read: false }],
    }));

    // Auto-remove après duration (défaut 5s)
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }
  },
  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },
  clearNotifications: () => set({ notifications: [] }),

  // Dashboard preferences
  dashboardPrefs: DEFAULT_DASHBOARD_PREFS,
  setDashboardPref: (key, value) => {
    set(state => {
      const newPrefs = { ...state.dashboardPrefs, [key]: value };
      localStorage.setItem('groupit_dashboardPrefs', JSON.stringify(newPrefs));
      return { dashboardPrefs: newPrefs };
    });
  },
  toggleDashboardPref: (key) => {
    set(state => {
      const newPrefs = { ...state.dashboardPrefs, [key]: !state.dashboardPrefs[key] };
      localStorage.setItem('groupit_dashboardPrefs', JSON.stringify(newPrefs));
      return { dashboardPrefs: newPrefs };
    });
  },
  resetDashboardPrefs: () => {
    localStorage.removeItem('groupit_dashboardPrefs');
    set({ dashboardPrefs: DEFAULT_DASHBOARD_PREFS });
  },

  // Keyboard shortcuts help
  showShortcutsHelp: false,
  toggleShortcutsHelp: () => set(state => ({ showShortcutsHelp: !state.showShortcutsHelp })),
  setShowShortcutsHelp: (show) => set({ showShortcutsHelp: show }),
}));

// Charger le mode expert depuis localStorage au démarrage
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('groupit_expertMode');
  if (stored === 'true') {
    useUIStore.setState({ expertMode: true });
  }

  // Charger les préférences du dashboard
  const dashboardPrefsStored = localStorage.getItem('groupit_dashboardPrefs');
  if (dashboardPrefsStored) {
    try {
      const prefs = JSON.parse(dashboardPrefsStored);
      useUIStore.setState({ dashboardPrefs: { ...DEFAULT_DASHBOARD_PREFS, ...prefs } });
    } catch {
      // Ignore parsing errors
    }
  }
}
