import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Settings, ShieldAlert, LogOut, Gift, Megaphone, Users, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { logout, currentUser } = useAuth();

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <ShieldAlert className="logo-icon text-neon" size={32} />
        <h2 className="glitch-text text-cyan" data-text="NEXUS">NEXUS</h2>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink 
          to="/" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>Command Center</span>
        </NavLink>
        
        <NavLink 
          to="/quest-management" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Map size={20} />
          <span>Live Map Control</span>
        </NavLink>
        
        <NavLink 
          to="/quest-list" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Database size={20} />
          <span>Quest Database</span>
        </NavLink>

        <NavLink 
          to="/reward-management" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Gift size={20} />
          <span>Reward System</span>
        </NavLink>

        <NavLink 
          to="/user-management" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Users size={20} />
          <span>User Management</span>
        </NavLink>

        <NavLink 
          to="/economy-settings" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={20} />
          <span>Economy & Sys</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className="dot pulse-dot"></span>
          <span className="status-text">{currentUser?.email || 'System Online'}</span>
        </div>
        <button onClick={logout} className="logout-btn">
          <LogOut size={16} /> LOGOUT
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
