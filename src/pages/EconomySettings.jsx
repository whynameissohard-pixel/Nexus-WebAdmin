import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Coins, Percent, ScanFace, XCircle, CheckCircle2 } from 'lucide-react';
import { listenToCollection, updateAllActiveQuestsDropRate } from '../services/firestore';
import './EconomySettings.css';

const EconomySettings = () => {
  const [economyData, setEconomyData] = useState([]);
  const [qaLogs, setQaLogs] = useState([]);
  
  // Real-time Economy Calculations
  const [activeQuests, setActiveQuests] = useState([]);
  const [avgDropRate, setAvgDropRate] = useState(0);
  const [avgPoints, setAvgPoints] = useState(0);
  
  // ML Recommendation State
  const [recommendation, setRecommendation] = useState({ text: 'Analyzing economy data...', targetRate: null });
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    // 1. Listen to Quests for real-time economy calculations
    const unsubQuests = listenToCollection('quests', (data) => {
      const active = data.filter(q => q.status === 'active');
      setActiveQuests(active);
      
      if (active.length > 0) {
        let totalDropRate = 0;
        let totalPoints = 0;
        
        active.forEach(q => {
          totalDropRate += (q.bonusDropRate || 0);
          // Calculate an average of points distributed
          if (q.rewardType === 'fixed') {
            totalPoints += (q.points || 0);
          } else {
            totalPoints += ((q.minPoints || 0) + (q.maxPoints || 0)) / 2;
          }
        });
        
        const avgDR = totalDropRate / active.length;
        const avgPts = totalPoints / active.length;
        setAvgDropRate(avgDR);
        setAvgPoints(avgPts);
        
        // Calculate ML Recommendation dynamically
        let targetDR = 10.0;
        let recText = "";
        
        if (avgDR > 15) {
          targetDR = 8.0;
          recText = `Current average Drop Rate is too high (${avgDR.toFixed(1)}%). Suggest lowering to ${targetDR}% to prevent hyperinflation.`;
        } else if (avgDR < 5) {
          targetDR = 14.0;
          recText = `Drop Rates are very low (${avgDR.toFixed(1)}%). Suggest increasing to ${targetDR}% to boost player engagement.`;
        } else {
          // It's somewhat balanced, let's nudge it for fun
          targetDR = 12.0;
          recText = `Economy is stabilizing with ${avgDR.toFixed(1)}% avg Drop Rate. Suggest optimizing to ${targetDR}% for the weekend event.`;
        }
        
        setRecommendation({ text: recText, targetRate: targetDR });
      } else {
        setRecommendation({ text: 'No active quests to analyze.', targetRate: null });
      }
    });

    // 2. Listen to economyLogs collection for chart data
    const unsubEconomy = listenToCollection('economyLogs', (data) => {
      // Map real Firestore logs to Recharts format
      const chartData = data.map(log => {
        const timeStr = log.timestamp?.toDate()?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'Now';
        // Simulate inflation inverse to the new drop rate to show correlation
        const simulatedInflation = log.newRate ? (25 - log.newRate) : 10; 
        
        return {
          time: timeStr,
          inflation: simulatedInflation,
          dropRate: log.newRate || 0,
          action: log.action
        };
      }).reverse(); // chronological order

      setEconomyData(chartData);
    }, 'timestamp', 'desc', 15);

    // 3. Listen to qa_logs collection for automated face scan rejections
    const unsubQa = listenToCollection('qa_logs', (data) => {
      setQaLogs(data);
    }, 'timestamp', 'desc', 10);

    return () => {
      unsubQuests();
      unsubEconomy();
      unsubQa();
    };
  }, []);

  const handleApplyAdjustment = async () => {
    if (recommendation.targetRate === null) return;
    
    setApplying(true);
    try {
      const questsUpdated = await updateAllActiveQuestsDropRate(recommendation.targetRate);
      alert(`Successfully balanced economy! Applied new Drop Rate to ${questsUpdated} active quests.`);
    } catch (error) {
      alert("Failed to apply adjustment: " + error.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="economy-container">
      <header className="page-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 className="glitch-text text-cyan" data-text="ECONOMY & SYS">ECONOMY & SYS</h1>
      </header>

      <div className="economy-grid">
        {/* Drop Rate Balancing */}
        <div className="glass-panel balancing-panel">
          <div className="panel-header">
            <h3><Coins size={20} className="text-neon" /> DYNAMIC DROP RATE BALANCING</h3>
          </div>
          <div className="chart-container-large">
            {economyData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Waiting for real-time economy adjustments...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={economyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#888899" />
                  <YAxis yAxisId="left" stroke="#ff2a2a" />
                  <YAxis yAxisId="right" orientation="right" stroke="#00f3ff" />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0f', borderColor: '#b026ff' }} />
                  <Line yAxisId="left" type="monotone" dataKey="inflation" stroke="#ff2a2a" name="Inflation % (Est)" strokeWidth={2} />
                  <Line yAxisId="right" type="step" dataKey="dropRate" stroke="#00f3ff" name="Drop Rate %" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="ml-recommendation">
            <div className="rec-icon">
              <Percent size={24} className="text-neon" />
            </div>
            <div className="rec-text">
              <h4>ML RECOMMENDATION</h4>
              <p>{recommendation.text}</p>
            </div>
            {recommendation.targetRate !== null && (
              <button 
                className="btn-neon" 
                onClick={handleApplyAdjustment}
                disabled={applying}
              >
                {applying ? "APPLYING..." : "APPLY ADJUSTMENT"}
              </button>
            )}
          </div>
        </div>

        {/* Face Data QA */}
        <div className="glass-panel qa-panel">
          <div className="panel-header">
            <h3><ScanFace size={20} className="text-cyan" /> AUTOMATED FACE DATA QA</h3>
          </div>
          <p className="qa-desc">ML Engine simulates Computer Vision to reject invalid verification photos.</p>
          
          <div className="qa-logs">
            {qaLogs.length === 0 ? (
              <div style={{ color: 'var(--success)', textAlign: 'center', marginTop: '20px' }}>No rejected photos.</div>
            ) : (
              qaLogs.map(log => (
                <div key={log.id} className="qa-log-item">
                  <div className="log-icon">
                    {log.status === 'Rejected' || log.status === 'rejected' ? <XCircle size={20} className="text-danger" /> : <CheckCircle2 size={20} className="text-success" />}
                  </div>
                  <div className="log-details">
                    <span className="log-id">Scan: {log.imgId || log.id} | User: {log.userId || 'Unknown'}</span>
                    <span className="log-reason">{log.reason}</span>
                  </div>
                  <div className="log-action">
                    <span className="status-rejected">AUTO-REJECTED</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EconomySettings;
