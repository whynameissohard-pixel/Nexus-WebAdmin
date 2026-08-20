import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();

  if (!currentUser || !isAdmin) {
    // If not logged in or not an admin, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // Authorized
  return children;
};

export default ProtectedRoute;
