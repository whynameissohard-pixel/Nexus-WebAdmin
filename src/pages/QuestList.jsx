import React, { useState, useEffect } from 'react';
import { Database, Edit, Trash2, X, Save, Search, CheckCircle, XCircle } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './QuestList.css';

const QuestList = () => {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit State
  const [editingQuest, setEditingQuest] = useState(null);
  
  useEffect(() => {
    const q = query(collection(db, 'quests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by creation or just alphabetical, for now default
      setQuests(questsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (questId) => {
    if (window.confirm("Are you sure you want to permanently delete this quest? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'quests', questId));
      } catch (err) {
        console.error("Error deleting quest:", err);
        alert("Failed to delete quest.");
      }
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      const questRef = doc(db, 'quests', editingQuest.id);
      
      const payload = {
        title: editingQuest.title,
        description: editingQuest.description,
        type: editingQuest.type,
        difficulty: editingQuest.difficulty,
        status: editingQuest.status,
        activityHours: Number(editingQuest.activityHours) || 0,
        timeLimit: editingQuest.timeLimit || '',
        distance: editingQuest.distance || '',
        bonusDropRate: Number(editingQuest.bonusDropRate) || 0
      };

      if (editingQuest.rewardType === 'fixed') {
        payload.points = Number(editingQuest.points);
        payload.xp = Number(editingQuest.xp);
      } else {
        payload.minPoints = Number(editingQuest.minPoints);
        payload.maxPoints = Number(editingQuest.maxPoints);
        payload.minXp = Number(editingQuest.minXp);
        payload.maxXp = Number(editingQuest.maxXp);
      }

      await updateDoc(questRef, payload);
      setEditingQuest(null);
    } catch (err) {
      console.error("Error updating quest:", err);
      alert("Failed to update quest.");
    }
  };

  const filteredQuests = quests.filter(q => 
    (q.title || q.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.difficulty || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="quest-list-container fade-in">
      <div className="ql-header">
        <h1><Database size={28} /> Quest Database</h1>
        <div className="search-bar">
          <Search size={18} color="var(--primary-cyan)" />
          <input 
            type="text" 
            placeholder="Search quests..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel" style={{marginTop: '20px'}}>
        <div className="ql-table-container">
          {loading ? (
            <div className="text-center text-cyan p-4">Loading quest database...</div>
          ) : (
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Quest Title</th>
                  <th>Type & Diff</th>
                  <th>Rewards</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuests.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-secondary p-4">No quests found.</td>
                  </tr>
                ) : (
                  filteredQuests.map(q => (
                    <tr key={q.id}>
                      <td>
                        <div style={{fontWeight: 'bold', color: 'var(--primary-cyan)', fontSize: '1.1rem'}}>{q.icon || '📍'} {q.title || q.name}</div>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                          {q.description}
                        </div>
                      </td>
                      <td>
                        <div><span className="badge-small">{q.type}</span></div>
                        <div style={{marginTop: '5px'}}><span className="badge-small">{q.difficulty}</span></div>
                      </td>
                      <td>
                        {q.rewardType === 'random' ? (
                          <div style={{color: 'var(--accent-purple)', fontSize: '0.85rem'}}>
                            <div>{q.minPoints}-{q.maxPoints} PTS</div>
                            <div>{q.minXp}-{q.maxXp} XP</div>
                          </div>
                        ) : (
                          <div style={{color: 'var(--accent-purple)', fontSize: '0.85rem'}}>
                            <div>{q.points || q.reward || 0} PTS</div>
                            <div>{q.xp || 0} XP</div>
                          </div>
                        )}
                        {q.bonusDropRate > 0 && <div style={{color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px'}}>+{q.bonusDropRate}% Drop</div>}
                      </td>
                      <td>
                        <span className={`status-badge ${q.status === 'active' ? 'active' : 'inactive'}`}>
                          {q.status === 'active' ? <CheckCircle size={12}/> : <XCircle size={12}/>}
                          {q.status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </td>
                      <td>
                        <div style={{display: 'flex', gap: '8px'}}>
                          <button className="action-btn edit" onClick={() => setEditingQuest(q)} title="Edit Quest">
                            <Edit size={16} />
                          </button>
                          <button className="action-btn delete" onClick={() => handleDelete(q.id)} title="Delete Quest">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingQuest && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel fade-in">
            <div className="modal-header">
              <h2><Edit size={20} /> Edit Quest</h2>
              <button className="close-btn" onClick={() => setEditingQuest(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSave} className="edit-form">
              <div className="input-group">
                <label>Title</label>
                <input type="text" className="cyber-input" value={editingQuest.title || editingQuest.name || ''} onChange={(e) => setEditingQuest({...editingQuest, title: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="cyber-input" rows="3" value={editingQuest.description || ''} onChange={(e) => setEditingQuest({...editingQuest, description: e.target.value})} required />
              </div>
              
              <div className="input-row">
                <div className="input-group w-half">
                  <label>Type</label>
                  <select className="cyber-input" value={editingQuest.type || 'daily'} onChange={(e) => setEditingQuest({...editingQuest, type: e.target.value})}>
                    <option value="daily">Daily</option>
                    <option value="main">Main</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div className="input-group w-half">
                  <label>Difficulty</label>
                  <select className="cyber-input" value={editingQuest.difficulty || 'NORMAL'} onChange={(e) => setEditingQuest({...editingQuest, difficulty: e.target.value})}>
                    <option value="EASY">EASY</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HARD">HARD</option>
                    <option value="LEGENDARY">LEGENDARY</option>
                  </select>
                </div>
              </div>

              <div className="input-row">
                <div className="input-group w-half">
                  <label>Status</label>
                  <select className="cyber-input" value={editingQuest.status || 'active'} onChange={(e) => setEditingQuest({...editingQuest, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="input-group w-half">
                  <label>Bonus Drop Rate (%)</label>
                  <input type="number" step="0.1" className="cyber-input" value={editingQuest.bonusDropRate || 0} onChange={(e) => setEditingQuest({...editingQuest, bonusDropRate: e.target.value})} />
                </div>
              </div>

              {editingQuest.rewardType === 'fixed' ? (
                <div className="input-row">
                  <div className="input-group w-half">
                    <label>Points</label>
                    <input type="number" className="cyber-input" value={editingQuest.points || 0} onChange={(e) => setEditingQuest({...editingQuest, points: e.target.value})} required />
                  </div>
                  <div className="input-group w-half">
                    <label>XP</label>
                    <input type="number" className="cyber-input" value={editingQuest.xp || 0} onChange={(e) => setEditingQuest({...editingQuest, xp: e.target.value})} required />
                  </div>
                </div>
              ) : (
                <>
                  <div className="input-row">
                    <div className="input-group w-half">
                      <label>Min Points</label>
                      <input type="number" className="cyber-input" value={editingQuest.minPoints || 0} onChange={(e) => setEditingQuest({...editingQuest, minPoints: e.target.value})} required />
                    </div>
                    <div className="input-group w-half">
                      <label>Max Points</label>
                      <input type="number" className="cyber-input" value={editingQuest.maxPoints || 0} onChange={(e) => setEditingQuest({...editingQuest, maxPoints: e.target.value})} required />
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-cyan" onClick={() => setEditingQuest(null)}>Cancel</button>
                <button type="submit" className="btn-neon"><Save size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestList;
