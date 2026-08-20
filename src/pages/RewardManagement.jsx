import React, { useState, useEffect } from 'react';
import { Gift, Plus, Package, Truck, Check } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './RewardManagement.css';

const RewardManagement = () => {
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [type, setType] = useState('physical');

  useEffect(() => {
    const unsubRewards = onSnapshot(query(collection(db, 'shopItems')), (snapshot) => {
      setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRedemptions = onSnapshot(query(collection(db, 'redemptions')), (snapshot) => {
      setRedemptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubRewards();
      unsubRedemptions();
    };
  }, []);

  const handleAddReward = async (e) => {
    e.preventDefault();
    if (!name || !cost) return;

    try {
      await addDoc(collection(db, 'shopItems'), {
        name,
        description,
        cost: Number(cost),
        icon: type === 'physical' ? '🎁' : '💎', // default icons based on type, can be customized
        rarity: 'common',
        type,
        active: true,
        createdAt: serverTimestamp()
      });
      setName('');
      setDescription('');
      setCost('');
      setStock('');
      alert("Shop Item added successfully!");
    } catch (err) {
      console.error("Error adding shop item:", err);
      alert("Failed to add shop item. Ensure your Firestore rules allow admins to write to /shopItems");
    }
  };

  const handleUpdateStatus = async (redemptionId, newStatus) => {
    try {
      await updateDoc(doc(db, 'redemptions', redemptionId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleToggleRewardStatus = async (rewardId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'shopItems', rewardId), {
        active: !currentStatus
      });
    } catch (err) {
      console.error("Error toggling reward status:", err);
    }
  };

  // Calculate popular rewards from redemptions
  const popularRewards = React.useMemo(() => {
    const counts = {};
    redemptions.forEach(r => {
      counts[r.rewardName] = (counts[r.rewardName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [redemptions]);

  return (
    <div className="reward-management-container fade-in">
      <div className="rm-header">
        <h1><Gift size={28} /> Reward Management</h1>
      </div>

      <div className="rm-grid">
        {/* LEFT COLUMN: ADD REWARD & STORE INVENTORY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="rm-panel">
            <h2><Plus size={20} /> Add New Reward</h2>
            <form onSubmit={handleAddReward}>
              <div className="rm-form-group">
                <label>Reward Name</label>
                <input type="text" className="rm-input" value={name} onChange={(e)=>setName(e.target.value)} required />
              </div>
              <div className="rm-form-group">
                <label>Description</label>
                <textarea className="rm-input" rows="2" value={description} onChange={(e)=>setDescription(e.target.value)} />
              </div>
              <div className="rm-form-group">
                <label>Type</label>
                <select className="rm-input" value={type} onChange={(e)=>setType(e.target.value)}>
                  <option value="physical">Physical Item (e.g., T-Shirt)</option>
                  <option value="digital">Digital Code (e.g., Promo Code)</option>
                </select>
              </div>
              <div className="rm-form-group" style={{display: 'flex', gap: '1rem'}}>
                <div style={{flex: 1}}>
                  <label>Cost (Diamonds/Points)</label>
                  <input type="number" className="rm-input" value={cost} onChange={(e)=>setCost(e.target.value)} required />
                </div>
                <div style={{flex: 1}}>
                  <label>Initial Stock (Optional)</label>
                  <input type="number" className="rm-input" value={stock} onChange={(e)=>setStock(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="rm-btn"><Gift size={16}/> Add to Store</button>
            </form>
          </div>

          <div className="rm-panel">
            <h2><Package size={20} /> Active Store Inventory</h2>
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {rewards.length === 0 ? (
                <div className="text-secondary text-center p-4">No rewards in store yet.</div>
              ) : (
                rewards.map(r => (
                  <div key={r.id} style={{
                    background: 'rgba(0,0,0,0.3)', 
                    border: `1px solid ${r.active !== false ? 'rgba(0,243,255,0.2)' : 'rgba(255,42,85,0.2)'}`, 
                    borderRadius: '4px', 
                    padding: '10px', 
                    marginBottom: '10px',
                    opacity: r.active !== false ? 1 : 0.6
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <div style={{display: 'flex', gap: '10px'}}>
                        <div style={{fontSize: '2rem', minWidth: '40px', textAlign: 'center'}}>{r.icon || '🎁'}</div>
                        <div>
                          <div style={{fontWeight: 'bold', color: r.active !== false ? 'var(--primary-cyan)' : 'var(--text-secondary)'}}>{r.name}</div>
                          <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
                            {r.cost} 💎 | {r.rarity || 'common'} {r.stock !== undefined ? `| Stock: ${r.stock}` : ''}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleToggleRewardStatus(r.id, r.active !== false)}
                        style={{
                          background: r.active !== false ? 'rgba(255, 42, 85, 0.1)' : 'rgba(0, 255, 157, 0.1)',
                          border: `1px solid ${r.active !== false ? '#ff2a55' : '#00ff9d'}`,
                          color: r.active !== false ? '#ff2a55' : '#00ff9d',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {r.active !== false ? 'DEACTIVATE' : 'ACTIVATE'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ANALYTICS & REDEMPTION LOGS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Popular Rewards Analytics */}
          <div className="rm-panel" style={{background: 'linear-gradient(45deg, rgba(188,19,254,0.1), rgba(0,243,255,0.05))'}}>
            <h2 style={{color: 'white', marginBottom: '1rem'}}>🔥 Trending Rewards</h2>
            <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
              {popularRewards.length === 0 ? (
                <div className="text-secondary text-center w-full">Not enough data to calculate trends.</div>
              ) : (
                popularRewards.map((pr, idx) => (
                  <div key={idx} style={{
                    flex: '1 1 30%', 
                    background: 'rgba(0,0,0,0.4)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    border: '1px solid rgba(188,19,254,0.3)',
                    textAlign: 'center'
                  }}>
                    <div style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</div>
                    <div style={{fontWeight: 'bold', fontSize: '0.9rem'}}>{pr.name}</div>
                    <div style={{color: 'var(--primary-cyan)', fontSize: '0.8rem', marginTop: '0.5rem'}}>Redeemed {pr.count}x</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rm-panel">
            <h2><Package size={20} /> Redemption Logs</h2>
            <div className="rm-table-container">
              {loading ? (
                <div className="text-center text-purple">Loading logs...</div>
              ) : (
                <table className="rm-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Reward</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-secondary">No redemptions yet.</td>
                      </tr>
                    ) : (
                      redemptions.map(r => (
                        <tr key={r.id}>
                          <td style={{fontFamily: 'monospace', fontSize: '0.8rem'}}>{r.userId}</td>
                          <td style={{fontWeight: 'bold'}}>{r.rewardName}</td>
                          <td>
                            <span className={`rm-status ${r.status || 'pending'}`}>
                              {r.status || 'Pending'}
                            </span>
                          </td>
                          <td>
                            {(r.status === 'pending' || !r.status) && (
                              <button className="action-btn shipped" onClick={() => handleUpdateStatus(r.id, 'shipped')}>
                                <Truck size={14} /> Mark Shipped
                              </button>
                            )}
                            {r.status === 'shipped' && (
                              <button className="action-btn unban" onClick={() => handleUpdateStatus(r.id, 'completed')}>
                                <Check size={14} /> Complete
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
        </div>
      </div>
    </div>
  );
};

export default RewardManagement;
