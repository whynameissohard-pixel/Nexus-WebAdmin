import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { AlertTriangle, Users, Activity, TrendingUp } from 'lucide-react';
import { listenToCollection } from '../services/firestore';
import './Dashboard.css';

const Dashboard = () => {
  const [trafficData, setTrafficData] = useState([]);
  const [flags, setFlags] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [onlinePlayers, setOnlinePlayers] = useState(0);

  useEffect(() => {
    // Listen to traffic collection for charts
    const unsubTraffic = listenToCollection('traffic', (data) => {
      // Sort chronologically if needed, assuming data is already sorted by the query or here
      setTrafficData(data.reverse());
    }, 'timestamp', 'desc', 10);

    // Listen to flags collection
    const unsubFlags = listenToCollection('flags', (data) => {
      setFlags(data);
    }, 'timestamp', 'desc', 5);

    // Listen to clusters collection
    const unsubClusters = listenToCollection('clusters', (data) => {
      setClusters(data);
    }, 'detectedAt', 'desc', 5);

    // Listen to active_players collection for count
    const unsubPlayers = listenToCollection('active_players', (data) => {
      setOnlinePlayers(data.length);
    });

    return () => {
      unsubTraffic();
      unsubFlags();
      unsubClusters();
      unsubPlayers();
    };
  }, []);

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <h1 className="glitch-text text-cyan" data-text="COMMAND CENTER">COMMAND CENTER</h1>
        <div className="header-stats">
          <div className="stat-badge">
            <Users size={16} className="text-neon" />
            <span>{onlinePlayers.toLocaleString()} ONLINE</span>
          </div>
          <div className={`stat-badge ${flags.length > 0 ? 'border-danger' : ''}`}>
            <AlertTriangle size={16} className={flags.length > 0 ? 'text-danger' : 'text-neon'} />
            <span className={flags.length > 0 ? 'text-danger' : 'text-neon'}>{flags.length} FLAGS</span>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Real-Time Overview */}
        <div className="glass-panel main-chart-panel">
          <div className="panel-header">
            <h3><Activity size={20} className="text-cyan" /> REAL-TIME OVERVIEW</h3>
          </div>
          <div className="chart-container">
            {trafficData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Waiting for real-time data from 'traffic' collection...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" stroke="#888899" />
                  <YAxis stroke="#888899" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid #00f3ff' }}
                    itemStyle={{ color: '#00f3ff' }}
                  />
                  <Area type="monotone" dataKey="players" stroke="#00f3ff" fillOpacity={1} fill="url(#colorPlayers)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Auto-Flagging Panel */}
        <div className="glass-panel flags-panel">
          <div className="panel-header danger-header">
            <h3><AlertTriangle size={20} className="text-danger" /> ML AUTO-FLAGGING</h3>
          </div>
          <div className="list-container">
            {flags.length === 0 ? (
              <div style={{ color: 'var(--success)', textAlign: 'center', marginTop: '20px' }}>No active flags detected.</div>
            ) : (
              flags.map(flag => (
                <div key={flag.id} className="list-item flag-item">
                  <div className="item-main">
                    <span className="id-badge">{flag.userId || flag.id}</span>
                    <span className="reason">{flag.reason}</span>
                  </div>
                  <div className="item-actions">
                    <span className={`risk-badge ${(flag.severity || 'high').toLowerCase()}`}>{flag.severity || 'High'}</span>
                    <button className="btn-neon small">REVIEW</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clustering Detection */}
        <div className="glass-panel cluster-panel">
          <div className="panel-header neon-header">
            <h3><Users size={20} className="text-neon" /> CLUSTERING DETECTION</h3>
            <span className="subtitle">Bot/Paid Service Analysis</span>
          </div>
          <div className="list-container">
            {clusters.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No suspicious clusters detected.</div>
            ) : (
              clusters.map(cluster => (
                <div key={cluster.id} className="list-item cluster-item">
                  <div className="item-main">
                    <div className="group-info">
                      <span className="id-badge neon">{cluster.groupId || cluster.id}</span>
                      <span className="count-badge"><Users size={12}/> {cluster.count || 0}</span>
                    </div>
                    <span className="reason">{cluster.behaviour}</span>
                  </div>
                  <div className="item-actions">
                    <button className="btn-cyan small">ANALYZE</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Point Distribution Chart */}
        <div className="glass-panel points-panel">
          <div className="panel-header">
            <h3><TrendingUp size={20} className="text-cyan" /> POINT DISTRIBUTION</h3>
          </div>
          <div className="chart-container">
            {trafficData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Waiting for real-time data from 'traffic' collection...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#888899" />
                  <YAxis stroke="#888899" />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid #b026ff' }} />
                  <Line type="monotone" dataKey="points" stroke="#b026ff" strokeWidth={3} dot={{ fill: '#b026ff', r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
