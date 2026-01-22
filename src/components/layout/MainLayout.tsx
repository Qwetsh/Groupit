import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { KeyboardShortcutsHelp } from '../ui/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-content">
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {/* Keyboard shortcuts help panel */}
      <KeyboardShortcutsHelp />
    </div>
  );
};
