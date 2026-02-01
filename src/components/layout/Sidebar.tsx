import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  HelpCircle,
  Shuffle,
  Keyboard
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { Tooltip } from '../ui/Tooltip';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

// Section 1: Actions principales
const actionItems: NavItem[] = [
  { path: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={20} /> },
  { path: '/board', label: 'Répartir', icon: <Shuffle size={20} />, highlight: true },
];

// Section 2: Gestion des données
const dataItems: NavItem[] = [
  { path: '/eleves', label: 'Élèves', icon: <Users size={20} /> },
  { path: '/enseignants', label: 'Enseignants', icon: <GraduationCap size={20} /> },
  { path: '/donnees', label: 'Import / Export', icon: <FolderInput size={20} /> },
];

// Section 3: Aide et paramètres
const helpItems: NavItem[] = [
  { path: '/aide', label: 'Aide', icon: <HelpCircle size={20} /> },
  { path: '/parametres', label: 'Paramètres', icon: <Settings size={20} /> },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleShortcutsHelp = useUIStore(state => state.toggleShortcutsHelp);

  // Helper pour wrappé avec tooltip si collapsed
  const NavItemLink = ({ item, highlight = false }: { item: NavItem; highlight?: boolean }) => {
    const link = (
      <NavLink
        to={item.path}
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${highlight ? 'highlight' : ''}`}
      >
        <span className="nav-icon">{item.icon}</span>
        {!collapsed && <span className="nav-label">{item.label}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip content={item.label} position="right" delay={200}>
          {link}
        </Tooltip>
      );
    }
    return link;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="logo">
            <span className="logo-icon">G</span>
            <span className="logo-text">Groupit</span>
          </div>
        )}
        <Tooltip content={collapsed ? 'Développer' : 'Réduire'} position="right" delay={200}>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </Tooltip>
      </div>

      <nav className="sidebar-nav">
        {/* Section 1: Actions principales */}
        {!collapsed && <div className="nav-section-label">Actions</div>}
        <ul className="nav-list">
          {actionItems.map(item => (
            <li key={item.path}>
              <NavItemLink item={item} highlight={item.highlight} />
            </li>
          ))}
        </ul>

        <div className="nav-divider" />

        {/* Section 2: Données */}
        {!collapsed && <div className="nav-section-label">Données</div>}
        <ul className="nav-list">
          {dataItems.map(item => (
            <li key={item.path}>
              <NavItemLink item={item} />
            </li>
          ))}
        </ul>

        <div className="nav-divider" />

        {/* Section 3: Aide */}
        <ul className="nav-list secondary">
          {helpItems.map(item => (
            <li key={item.path}>
              <NavItemLink item={item} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <Tooltip content="Raccourcis clavier (Maj + ?)" position="right" delay={200}>
          <button
            className="shortcuts-btn"
            onClick={toggleShortcutsHelp}
          >
            <Keyboard size={16} />
            {!collapsed && <span>Raccourcis</span>}
          </button>
        </Tooltip>
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
