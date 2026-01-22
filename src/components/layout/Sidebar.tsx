import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Settings,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Database,
  HelpCircle,
  Shuffle,
  Keyboard
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
  { path: '/board', label: 'Affectations', icon: <Shuffle size={20} /> },
  { path: '/eleves', label: 'Élèves', icon: <Users size={20} /> },
  { path: '/enseignants', label: 'Enseignants', icon: <GraduationCap size={20} /> },
  { path: '/scenarios', label: 'Scénarios', icon: <FileSpreadsheet size={20} /> },
];

const secondaryItems: NavItem[] = [
  { path: '/donnees', label: 'Données', icon: <Database size={20} /> },
  { path: '/parametres', label: 'Paramètres', icon: <Settings size={20} /> },
  { path: '/aide', label: 'Aide', icon: <HelpCircle size={20} /> },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleShortcutsHelp = useUIStore(state => state.toggleShortcutsHelp);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="logo">
            <span className="logo-icon">G</span>
            <span className="logo-text">Groupit</span>
          </div>
        )}
        <button 
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Développer' : 'Réduire'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink 
                to={item.path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="nav-divider" />

        <ul className="nav-list secondary">
          {secondaryItems.map(item => (
            <li key={item.path}>
              <NavLink 
                to={item.path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button
          className="shortcuts-btn"
          onClick={toggleShortcutsHelp}
          title="Raccourcis clavier (Maj + ?)"
        >
          <Keyboard size={16} />
          {!collapsed && <span>Raccourcis</span>}
        </button>
        {!collapsed && (
          <div className="version-info">
            <span>v1.0.0</span>
            <span className="local-badge">100% Local</span>
          </div>
        )}
      </div>
    </aside>
  );
};
