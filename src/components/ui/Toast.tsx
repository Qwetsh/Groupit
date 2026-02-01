// ============================================================
// TOAST COMPONENT - Notifications temporaires
// ============================================================

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import './Toast.css';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const notifications = useUIStore(state => state.notifications);
  const removeNotification = useUIStore(state => state.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="toast-container">
      {notifications.map(notification => {
        const Icon = ICONS[notification.type];

        return (
          <div
            key={notification.id}
            className={`toast toast-${notification.type}`}
            role="alert"
          >
            <Icon size={18} className="toast-icon" />
            <span className="toast-message">{notification.message}</span>
            <button
              className="toast-close"
              onClick={() => removeNotification(notification.id)}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Hook utilitaire pour faciliter l'usage
export function useToast() {
  const addNotification = useUIStore(state => state.addNotification);

  return {
    success: (message: string, duration?: number) =>
      addNotification({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      addNotification({ type: 'error', message, duration: duration ?? 8000 }),
    warning: (message: string, duration?: number) =>
      addNotification({ type: 'warning', message, duration }),
    info: (message: string, duration?: number) =>
      addNotification({ type: 'info', message, duration }),
  };
}
