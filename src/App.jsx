import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import QuestManagement from './pages/QuestManagement';
import QuestList from './pages/QuestList';
import EconomySettings from './pages/EconomySettings';
import UserManagement from './pages/UserManagement';
import RewardManagement from './pages/RewardManagement';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
// AdminLayout includes the sidebar and main content area
const AdminLayout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Admin Routes */}
          <Route element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Dashboard />} />
            <Route path="/quest-management" element={<QuestManagement />} />
            <Route path="/quest-list" element={<QuestList />} />
            <Route path="/reward-management" element={<RewardManagement />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/economy-settings" element={<EconomySettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
