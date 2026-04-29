import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Keyboard,
  ClipboardCheck,
  Briefcase
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

interface SidebarProps {
  isMobile?: boolean;
  mobileOpen?: boolean;
}

// Section 1: Actions principales
const actionItems: NavItem[] = [
  { path: '/', label: 'Accueil', icon: <Home size={20} /> },
];

// URL du dashboard principal (même base que l'app, sous-dossier)
const DASHBOARD_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:5176/Groupit/groupit-dashboard/`
  : `${window.location.origin}${import.meta.env.BASE_URL}groupit-dashboard/`;

// Section 2: Gestion des données
const dataItems: NavItem[] = [
  { path: '/eleves', label: 'Élèves', icon: <Users size={20} /> },
  { path: '/enseignants', label: 'Enseignants', icon: <GraduationCap size={20} /> },
];

// Section 3: Aide et paramètres
const helpItems: NavItem[] = [
  { path: '/aide', label: 'Aide', icon: <HelpCircle size={20} /> },
  { path: '/parametres', label: 'Paramètres', icon: <Settings size={20} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({ isMobile = false, mobileOpen = false }) => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleShortcutsHelp = useUIStore(state => state.toggleShortcutsHelp);

  // En mobile, la sidebar est toujours étendue (pas de mode collapsed)
  const isCollapsed = isMobile ? false : collapsed;

  // Helper pour wrapper avec tooltip si collapsed
  const NavItemLink = ({ item, highlight = false }: { item: NavItem; highlight?: boolean }) => {
    const link = (
      <NavLink
        to={item.path}
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${highlight ? 'highlight' : ''}`}
        end={item.path === '/'}
      >
        <span className="nav-icon">{item.icon}</span>
        {!isCollapsed && <span className="nav-label">{item.label}</span>}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip content={item.label} position="right" delay={200}>
          {link}
        </Tooltip>
      );
    }
    return link;
  };

  const ExternalLink = ({ icon, label, href, tooltip }: { icon: React.ReactNode; label: string; href: string; tooltip?: string }) => {
    const link = (
      <a href={href} target="_blank" rel="noopener noreferrer" className="nav-link">
        <span className="nav-icon">{icon}</span>
        {!isCollapsed && <span className="nav-label">{label}</span>}
      </a>
    );

    if (isCollapsed) {
      return (
        <Tooltip content={tooltip || label} position="right" delay={200}>
          {link}
        </Tooltip>
      );
    }
    return link;
  };

  const sidebarClass = [
    'sidebar',
    isCollapsed ? 'collapsed' : '',
    isMobile && mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="logo">
            <span className="logo-icon">L</span>
            <span className="logo-text">Locanda</span>
          </div>
        )}
        <Tooltip content={isCollapsed ? 'Développer' : 'Réduire'} position="right" delay={200}>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </Tooltip>
      </div>

      <nav className="sidebar-nav">
        {/* Section 1: Actions principales */}
        {!isCollapsed && <div className="nav-section-label">Actions</div>}
        <ul className="nav-list">
          {actionItems.map(item => (
            <li key={item.path}>
              <NavItemLink item={item} highlight={item.highlight} />
            </li>
          ))}
          <li>
            <ExternalLink
              icon={<ClipboardCheck size={20} />}
              label="Suivi oral DNB"
              href={DASHBOARD_URL}
              tooltip="Suivi oral DNB"
            />
          </li>
          <li>
            <NavItemLink item={{ path: '/suivi-stages', label: 'Suivi stages', icon: <Briefcase size={20} /> }} />
          </li>
        </ul>

        <div className="nav-divider" />

        {/* Section 2: Données */}
        {!isCollapsed && <div className="nav-section-label">Données</div>}
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
            {!isCollapsed && <span>Raccourcis</span>}
          </button>
        </Tooltip>
        {!isCollapsed && (
          <div className="version-info">
            <span>v1.0.0</span>
            <span className="local-badge">100% Local</span>
          </div>
        )}
      </div>
    </aside>
  );
};
