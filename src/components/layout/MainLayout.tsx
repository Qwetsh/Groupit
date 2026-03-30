import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { KeyboardShortcutsHelp } from '../ui/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import './MainLayout.css';

const MOBILE_BREAKPOINT = 768;

export const MainLayout: React.FC = () => {
  useKeyboardShortcuts();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Détecter le changement de taille d'écran
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fermer la sidebar quand on navigue (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="main-layout">
      {/* Hamburger button (mobile only) */}
      <button
        className={`mobile-menu-btn ${sidebarOpen ? 'hidden' : ''}`}
        onClick={() => setSidebarOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={closeSidebar}
      />

      <Sidebar isMobile={isMobile} mobileOpen={sidebarOpen} />

      <div className="main-content">
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          © {new Date().getFullYear()} Locanda — Tous droits réservés. Usage soumis à autorisation.
        </footer>
      </div>

      <KeyboardShortcutsHelp />
    </div>
  );
};
