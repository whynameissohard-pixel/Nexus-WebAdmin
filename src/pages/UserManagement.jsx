import React, { useState, useEffect } from 'react';
import { Users, Search, Ban, CheckCircle, ShieldAlert } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './UserManagement.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to users collection
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleBan = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
      await updateDoc(userRef, { status: newStatus });
    } catch (err) {
      console.error("Error updating user status:", err);
      alert("Failed to update user status.");
    }
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const idMatch = u.id.toLowerCase().includes(term);
    const facultyMatch = u.faculty ? u.faculty.toLowerCase().includes(term) : false;
    const emailMatch = u.email ? u.email.toLowerCase().includes(term) : false;
    const studentIdMatch = u.studentId ? u.studentId.toLowerCase().includes(term) : false;
    return idMatch || facultyMatch || emailMatch || studentIdMatch;
  });

  return (
    <div className="user-management-container fade-in">
      <div className="header-section">
        <h1><Users size={28} /> User Management</h1>
        <div className="search-bar">
          <Search size={18} color="var(--primary-cyan)" />
          <input 
            type="text" 
            placeholder="Search by ID, Email, or Student ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="users-table-container">
        {loading ? (
          <div className="p-4 text-center text-cyan">Loading users...</div>
        ) : (
          <table className="cyber-table">
            <thead>
              <tr>
                <th>User / Device ID</th>
                <th>Faculty</th>
                <th>Level & Streak</th>
                <th>Activity Points</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{padding: '2rem', color: 'var(--text-secondary)'}}>
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{fontSize: '1.2rem'}}>{user.avatar || '👤'}</span>
                        <span>{user.studentId || user.email || 'Unknown User'}</span>
                      </div>
                      <div style={{fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginLeft: '2rem'}}>
                        {user.email && <div>{user.email}</div>}
                        <div>UID: {user.id}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{color: 'var(--text-secondary)'}}>{user.faculty || 'Unknown Faculty'}</div>
                    </td>
                    <td>
                      <div>Level {user.level || 1}</div>
                      <div style={{fontSize: '0.75rem', color: 'var(--primary-cyan)'}}>Max Streak: {user.maxStreak || 0}</div>
                    </td>
                    <td style={{color: 'var(--accent-purple)', fontWeight: 'bold'}}>
                      {user.activityPoints || 0} Pts
                    </td>
                    <td>
                      <span className={`user-status ${user.status === 'banned' ? 'banned' : 'active'}`}>
                        {user.status === 'banned' ? <ShieldAlert size={12}/> : <CheckCircle size={12}/>}
                        {user.status === 'banned' ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td>
                      {user.status === 'banned' ? (
                        <button 
                          className="action-btn unban"
                          onClick={() => handleToggleBan(user.id, user.status)}
                        >
                          <CheckCircle size={14} /> Unban
                        </button>
                      ) : (
                        <button 
                          className="action-btn ban"
                          onClick={() => handleToggleBan(user.id, user.status)}
                        >
                          <Ban size={14} /> Ban
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
