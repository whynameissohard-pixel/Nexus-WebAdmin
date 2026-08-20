import React, { useState, useEffect } from 'react';
import { MapPin, Target, Send, Users, Layers, BrainCircuit, Clock, Dices, Coins, Percent, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat'; 
import 'leaflet.heat'; 
import { listenToCollection, addQuest } from '../services/firestore';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './QuestManagement.css';

// SUT Coordinates
const SUT_CENTER = [14.8781, 102.0156];
// 10km radius bounding box approximately
const SUT_MAX_BOUNDS = [
  [14.7881, 101.9256],
  [14.9681, 102.1056]
];

// Custom Icons
const orangeIcon = new L.DivIcon({
  className: 'custom-leaflet-icon',
  html: `<div class="marker-pin orange-pin"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -42]
});

const purpleIcon = new L.DivIcon({
  className: 'custom-leaflet-icon',
  html: `<div class="marker-pin purple-pin"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42]
});

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
};

// Heatmap Sub-component
const HeatmapLayer = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.4: 'blue', 0.6: 'cyan', 0.8: 'yellow', 1: 'red' }
    }).addTo(map);

    return () => { map.removeLayer(heat); };
  }, [map, points]);
  return null;
};

const CAMPUS_ZONES = [
  { id: 'zone_cafeteria', name: 'Cafeteria', lat: 14.8818, lng: 102.0170 },
  { id: 'zone_library', name: 'Main Library', lat: 14.8765, lng: 102.0150 },
  { id: 'zone_stadium', name: 'Stadium', lat: 14.8830, lng: 102.0190 },
  { id: 'zone_dorm', name: 'Dormitories', lat: 14.8710, lng: 102.0080 },
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const QuestManagement = () => {
  const [existingQuests, setExistingQuests] = useState([]);
  const [draftPin, setDraftPin] = useState(null);
  
  // Base Form States
  const [questTitle, setQuestTitle] = useState('');
  const [questDesc, setQuestDesc] = useState('');
  const [questType, setQuestType] = useState('daily'); // 'daily', 'main', 'event'
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [questIcon, setQuestIcon] = useState('📍');
  const [activityHours, setActivityHours] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [distance, setDistance] = useState('');
  
  // Advanced Rewards State
  const [rewardType, setRewardType] = useState('fixed'); // 'fixed' or 'random'
  const [points, setPoints] = useState('');
  const [minPoints, setMinPoints] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [xp, setXp] = useState('');
  const [minXp, setMinXp] = useState('');
  const [maxXp, setMaxXp] = useState('');
  const [bonusDropRate, setBonusDropRate] = useState('');

  const [publishing, setPublishing] = useState(false);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);

  // AI Analytics State
  const [analysisPeriod, setAnalysisPeriod] = useState(1);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // AI Analysis Effect
  useEffect(() => {
    const fetchAndAnalyze = async () => {
      setAnalyzing(true);
      setAnalysisError('');
      try {
        const timeThreshold = new Date(Date.now() - analysisPeriod * 24 * 60 * 60 * 1000);
        const q = query(collection(db, 'quest_checkins'), where('timestamp', '>=', timeThreshold));
        const snapshot = await getDocs(q);

        if (snapshot.empty || snapshot.size < 5) {
          setAnalysisError(`Insufficient activity in the last ${analysisPeriod} day(s) for accurate predictions.`);
          setAiSuggestions([]);
          setAnalyzing(false);
          return;
        }

        // Aggregate by Zone
        const zoneStats = {};
        CAMPUS_ZONES.forEach(z => {
          zoneStats[z.id] = { ...z, count: 0, hourCounts: Array(24).fill(0) };
        });

        snapshot.forEach(doc => {
          const data = doc.data();
          const lat = data.lat || data.location?.latitude;
          const lng = data.lng || data.location?.longitude;
          const ts = data.timestamp?.toDate();

          if (lat && lng && ts) {
            let closestZone = null;
            let minDistance = 800; // Match within 800m
            CAMPUS_ZONES.forEach(zone => {
              const dist = calculateDistance(lat, lng, zone.lat, zone.lng);
              if (dist < minDistance) {
                minDistance = dist;
                closestZone = zone;
              }
            });

            if (closestZone) {
              zoneStats[closestZone.id].count++;
              zoneStats[closestZone.id].hourCounts[ts.getHours()]++;
            }
          }
        });

        const validZones = Object.values(zoneStats)
          .filter(z => z.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        if (validZones.length === 0) {
          setAnalysisError("Activity found, but not concentrated near major campus zones.");
          setAiSuggestions([]);
          setAnalyzing(false);
          return;
        }

        const suggestions = validZones.map(z => {
          const maxHourCount = Math.max(...z.hourCounts);
          const peakHour = z.hourCounts.indexOf(maxHourCount);
          const ampm = peakHour >= 12 ? 'PM' : 'AM';
          const displayHour = peakHour % 12 || 12;
          
          let density = 'Low';
          if (z.count > 20) density = 'High';
          else if (z.count > 5) density = 'Medium';

          return {
            id: z.id,
            name: z.name,
            expectedDensity: density,
            recommendedTime: `${displayHour}:00 ${ampm}`
          };
        });

        setAiSuggestions(suggestions);
      } catch (err) {
        console.error("AI Analysis failed", err);
        setAnalysisError("Failed to fetch historical data. (Check Firestore Indexes)");
      }
      setAnalyzing(false);
    };

    fetchAndAnalyze();
  }, [analysisPeriod]);

  useEffect(() => {
    const unsubQuests = listenToCollection('quests', (data) => {
      const validQuests = data.filter(q => q.location?.latitude || q.lat);
      setExistingQuests(validQuests);
    });

    const unsubCheckins = listenToCollection('quest_checkins', (data) => {
      const points = data.filter(d => d.lat && d.lng).map(d => [d.lat, d.lng, 1]);
      setHeatmapData(points);
    });

    return () => {
      unsubQuests();
      unsubCheckins();
    };
  }, []);

  const handleMapClick = (latlng) => {
    setDraftPin({ lat: latlng.lat, lng: latlng.lng });
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!draftPin || !questTitle) return;

    if (rewardType === 'fixed' && (!points || !xp)) return;
    if (rewardType === 'random' && (!minPoints || !maxPoints || !minXp || !maxXp)) return;

    setPublishing(true);
    
    // Construct payload strictly matching the DB Schema
    const questPayload = {
      title: questTitle,
      description: questDesc,
      type: questType,
      difficulty: difficulty,
      icon: questIcon,
      status: 'active',
      activityHours: Number(activityHours) || 0,
      timeLimit: timeLimit || '',
      distance: distance || '',
      location: {
        latitude: draftPin.lat,
        longitude: draftPin.lng
      },
      // Keep advanced reward data
      rewardType: rewardType,
      bonusDropRate: Number(bonusDropRate) || 0
    };

    if (rewardType === 'fixed') {
      questPayload.points = Number(points);
      questPayload.xp = Number(xp);
    } else {
      questPayload.minPoints = Number(minPoints);
      questPayload.maxPoints = Number(maxPoints);
      questPayload.minXp = Number(minXp);
      questPayload.maxXp = Number(maxXp);
    }

    try {
      await addQuest(questPayload);
      // Reset after publish
      setDraftPin(null);
      setQuestTitle('');
      setQuestDesc('');
      setQuestIcon('📍');
      setActivityHours('');
      setTimeLimit('');
      setDistance('');
      setPoints('');
      setMinPoints('');
      setMaxPoints('');
      setXp('');
      setMinXp('');
      setMaxXp('');
      setBonusDropRate('');
    } catch (err) {
      alert("Failed to publish quest. Error: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  const applyMLRecommendation = async () => {
    setRewardType('random');
    
    try {
      // 1. Fetch real active quests from Database
      const q = query(collection(db, 'quests'), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      
      let totalDropRate = 0;
      let activeCount = snapshot.size;
      
      snapshot.forEach(doc => {
        totalDropRate += (doc.data().bonusDropRate || 0);
      });
      
      const avgDR = activeCount > 0 ? (totalDropRate / activeCount) : 10.0;
      
      // 2. Base Rewards Calculation
      let baseMinPts = 500;
      let baseMaxPts = 1000;
      let baseMinXp = 1000;
      let baseMaxXp = 2000;
      let recommendedDropRate = 12.0;

      // 3. Economy Balancing Logic
      if (avgDR > 15) {
        // Hyperinflation: Reduce drop rate, increase XP instead of Points
        recommendedDropRate = 8.0;
        baseMinPts = 300; baseMaxPts = 600;
        baseMinXp = 1500; baseMaxXp = 2500;
      } else if (avgDR < 5) {
        // Deflation: Boost drop rate and Points
        recommendedDropRate = 16.0;
        baseMinPts = 800; baseMaxPts = 1500;
      }

      // 4. Quest Difficulty Multiplier
      if (difficulty === 'HARD' || difficulty === 'LEGENDARY') {
        baseMinPts = Math.floor(baseMinPts * 2.5);
        baseMaxPts = Math.floor(baseMaxPts * 2.5);
        baseMinXp *= 2;
        baseMaxXp *= 2;
        recommendedDropRate = Math.min(100, recommendedDropRate + 5.5); 
      }

      setMinPoints(baseMinPts.toString());
      setMaxPoints(baseMaxPts.toString());
      setMinXp(baseMinXp.toString());
      setMaxXp(baseMaxXp.toString());
      setBonusDropRate(recommendedDropRate.toFixed(1));

    } catch (err) {
      console.error("Failed to fetch Economy Data:", err);
      // Fallback
      setMinPoints("500");
      setMaxPoints("1000");
      setMinXp("1000");
      setMaxXp("2000");
      setBonusDropRate("12.0");
    }
  };

  const handleDeactivateQuest = async (questId) => {
    if (window.confirm("Are you sure you want to deactivate this quest?")) {
      try {
        await updateDoc(doc(db, 'quests', questId), {
          status: 'inactive'
        });
        alert("Quest deactivated.");
      } catch (err) {
        console.error("Failed to deactivate quest:", err);
      }
    }
  };

  return (
    <div className="quest-container">
      <header className="page-header">
        <h1 className="glitch-text text-neon" data-text="LIVE MAP CONTROL">LIVE MAP CONTROL</h1>
        
        <button 
          className={`btn-cyan toggle-btn ${showHeatmap ? 'active' : ''}`}
          onClick={() => setShowHeatmap(!showHeatmap)}
        >
          <Layers size={16} />
          {showHeatmap ? 'HIDE HEATMAP' : 'SHOW HEATMAP'}
        </button>
      </header>

      <div className="quest-grid">
        <div className="glass-panel map-panel">
          <div className="panel-header">
            <h3><Target size={20} className="text-cyan" /> SUT SECTOR MAP (CLICK TO DROP PIN)</h3>
          </div>
          <div className="map-wrapper">
            <MapContainer 
              center={SUT_CENTER} 
              zoom={15}
              minZoom={12}
              maxBounds={SUT_MAX_BOUNDS}
              maxBoundsViscosity={1.0}
              className="leaflet-map-container"
              zoomControl={false}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
              />
              
              <MapEvents onMapClick={handleMapClick} />

              {showHeatmap && heatmapData.length > 0 && (
                <HeatmapLayer points={heatmapData} />
              )}

              {existingQuests.map(quest => {
                const lat = quest.location?.latitude || quest.lat;
                const lng = quest.location?.longitude || quest.lng;
                
                return (
                  <Marker 
                    key={quest.id} 
                    position={[lat, lng]} 
                    icon={orangeIcon}
                  >
                    <Popup className="cyber-popup">
                      <div className="popup-content">
                        <h4 className="text-cyan">{quest.icon} {quest.title || quest.name}</h4>
                        <p>{quest.description}</p>
                        <div style={{display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'10px'}}>
                          <span className="badge-small">{quest.difficulty}</span>
                          <span className="badge-small">{quest.type}</span>
                          <span className="badge-small">{quest.xp} XP</span>
                        </div>
                        <div className="reward-badge">
                          {quest.rewardType === 'random' 
                            ? `Reward: ${quest.minPoints} - ${quest.maxPoints} PTS` 
                            : `Reward: ${quest.points || quest.reward || 0} PTS`}
                        </div>
                        {quest.bonusDropRate > 0 && (
                          <div className="bonus-badge mt-2">
                            Special Bonus Rate: {quest.bonusDropRate}%
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {draftPin && (
                <Marker 
                  position={[draftPin.lat, draftPin.lng]} 
                  icon={purpleIcon}
                />
              )}
            </MapContainer>
            
            <div className="target-overlay-ui top-left"></div>
            <div className="target-overlay-ui top-right"></div>
            <div className="target-overlay-ui bottom-left"></div>
            <div className="target-overlay-ui bottom-right"></div>
          </div>
        </div>

        <div className="side-panels-scrollable">
          {/* AI Suggestions */}
          <div className="glass-panel smart-panel mb-20">
            <div className="panel-header neon-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3><BrainCircuit size={20} className="text-neon" /> AI SUGGESTIONS</h3>
              <select 
                className="cyber-input" 
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                value={analysisPeriod}
                onChange={(e) => setAnalysisPeriod(Number(e.target.value))}
              >
                <option value={1}>Last 24 Hours</option>
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
            <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '15px'}}>
              Analyzing real historical data to predict peak density.
            </p>
            
            <div className="suggestions-list">
              {analyzing ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Analyzing historical traffic...</div>
              ) : analysisError ? (
                <div style={{ color: 'var(--warning)', textAlign: 'center', padding: '20px', border: '1px solid rgba(255, 170, 0, 0.2)', borderRadius: '4px', backgroundColor: 'rgba(255, 170, 0, 0.05)' }}>
                  <AlertTriangle size={24} style={{ margin: '0 auto 10px' }} />
                  {analysisError}
                </div>
              ) : (
                aiSuggestions.map(loc => (
                  <div key={loc.id} className="suggestion-card">
                    <h4>{loc.name}</h4>
                    <div className="suggestion-details">
                      <span><Users size={14}/> Density: <strong className={loc.expectedDensity === 'High' ? 'text-danger' : 'text-cyan'}>{loc.expectedDensity}</strong></span>
                      <span><Clock size={14}/> Peak Time: <strong>{loc.recommendedTime}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quest Deployment Form */}
          {draftPin && (
            <div className="glass-panel draft-panel">
              <div className="panel-header neon-header">
                <h3><MapPin size={20} className="text-neon" /> QUEST DEPLOYMENT</h3>
              </div>
              <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '15px'}}>
                Draft mode active. Configure details to publish.
              </p>
              
              <form onSubmit={handlePublish} className="prediction-form">
                
                {/* 1. Core Info */}
                <div className="input-group">
                  <label>Title</label>
                  <input 
                    type="text" 
                    className="cyber-input" 
                    required 
                    value={questTitle}
                    onChange={(e) => setQuestTitle(e.target.value)}
                    placeholder="e.g. NEXUS FESTIVAL 2026" 
                  />
                </div>
                
                <div className="input-row">
                  <div className="input-group w-half">
                    <label>Quest Type</label>
                    <select 
                      className="cyber-input"
                      value={questType}
                      onChange={(e) => setQuestType(e.target.value)}
                    >
                      <option value="daily">Daily</option>
                      <option value="main">Main</option>
                      <option value="event">Event</option>
                    </select>
                  </div>
                  <div className="input-group w-half">
                    <label>Difficulty</label>
                    <select 
                      className="cyber-input"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="EASY">EASY</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HARD">HARD</option>
                      <option value="LEGENDARY">LEGENDARY</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>Icon (Emoji)</label>
                  <input 
                    type="text" 
                    className="cyber-input" 
                    value={questIcon}
                    onChange={(e) => setQuestIcon(e.target.value)}
                    placeholder="e.g. 🎆" 
                  />
                </div>
                
                <div className="input-group">
                  <label>Description</label>
                  <textarea 
                    className="cyber-input" 
                    rows="2"
                    required
                    value={questDesc}
                    onChange={(e) => setQuestDesc(e.target.value)}
                    placeholder="Mission details..." 
                  ></textarea>
                </div>

                {/* 2. Mechanics */}
                <div className="input-row">
                  <div className="input-group w-third">
                    <label>Time Limit</label>
                    <input 
                      type="text" 
                      className="cyber-input" 
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      placeholder="e.g. 48h" 
                    />
                  </div>
                  <div className="input-group w-third">
                    <label>Distance</label>
                    <input 
                      type="text" 
                      className="cyber-input" 
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="e.g. 500m" 
                    />
                  </div>
                  <div className="input-group w-third">
                    <label>Hours</label>
                    <input 
                      type="number" 
                      className="cyber-input" 
                      value={activityHours}
                      onChange={(e) => setActivityHours(e.target.value)}
                      placeholder="e.g. 8" 
                    />
                  </div>
                </div>

                {/* 3. Rewards Config */}
                <div className="reward-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
                  <label style={{fontSize: '0.75rem', fontFamily: 'Orbitron, sans-serif', color: 'var(--secondary-cyan)'}}>REWARDS CONFIGURATION</label>
                </div>

                <div className="reward-type-toggle mt-2">
                  <button 
                    type="button" 
                    className={`toggle-btn ${rewardType === 'fixed' ? 'active' : ''}`}
                    onClick={() => setRewardType('fixed')}
                  >
                    <Coins size={14} /> Fixed Reward
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-btn ${rewardType === 'random' ? 'active' : ''}`}
                    onClick={applyMLRecommendation}
                  >
                    <Dices size={14} /> ✨ Random (ML Auto-Balance)
                  </button>
                </div>

                {rewardType === 'fixed' ? (
                  <div className="input-row">
                    <div className="input-group w-half">
                      <label>Reward Points</label>
                      <input 
                        type="number" 
                        className="cyber-input" 
                        required 
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                        placeholder="e.g. 1000" 
                      />
                    </div>
                    <div className="input-group w-half">
                      <label>Reward XP</label>
                      <input 
                        type="number" 
                        className="cyber-input" 
                        required 
                        value={xp}
                        onChange={(e) => setXp(e.target.value)}
                        placeholder="e.g. 2000" 
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="input-row">
                      <div className="input-group w-half">
                        <label>Min Points</label>
                        <input 
                          type="number" 
                          className="cyber-input" 
                          required 
                          value={minPoints}
                          onChange={(e) => setMinPoints(e.target.value)}
                          placeholder="e.g. 500" 
                        />
                      </div>
                      <div className="input-group w-half">
                        <label>Max Points</label>
                        <input 
                          type="number" 
                          className="cyber-input" 
                          required 
                          value={maxPoints}
                          onChange={(e) => setMaxPoints(e.target.value)}
                          placeholder="e.g. 1500" 
                        />
                      </div>
                    </div>
                    <div className="input-row">
                      <div className="input-group w-half">
                        <label>Min XP</label>
                        <input 
                          type="number" 
                          className="cyber-input" 
                          required 
                          value={minXp}
                          onChange={(e) => setMinXp(e.target.value)}
                          placeholder="e.g. 1000" 
                        />
                      </div>
                      <div className="input-group w-half">
                        <label>Max XP</label>
                        <input 
                          type="number" 
                          className="cyber-input" 
                          required 
                          value={maxXp}
                          onChange={(e) => setMaxXp(e.target.value)}
                          placeholder="e.g. 3000" 
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="input-group">
                  <label>Special Bonus Drop Rate (%)</label>
                  <div className="input-with-icon">
                    <Percent size={14} className="input-icon" />
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="100"
                      className="cyber-input w-full" 
                      value={bonusDropRate}
                      onChange={(e) => setBonusDropRate(e.target.value)}
                      placeholder="0.0" 
                    />
                  </div>
                </div>

                <div className="form-actions" style={{display:'flex', gap:'10px', marginTop: '10px'}}>
                  <button type="button" className="btn-cyan w-full" onClick={() => setDraftPin(null)}>
                    CANCEL
                  </button>
                  <button type="submit" className="btn-neon w-full" disabled={publishing}>
                    {publishing ? 'PUBLISHING...' : <><Send size={16} /> PUBLIC</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* EXISTING QUESTS LIST */}
          <div className="glass-panel" style={{marginTop: '20px'}}>
            <div className="panel-header">
              <h3><MapPin size={20} className="text-cyan" /> ACTIVE QUESTS ({existingQuests.length})</h3>
            </div>
            <div className="quests-list" style={{maxHeight: '300px', overflowY: 'auto', padding: '10px'}}>
              {existingQuests.length === 0 ? (
                <div style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem'}}>
                  No active quests found.
                </div>
              ) : (
                existingQuests.map(q => (
                  <div key={q.id} style={{
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid rgba(0,243,255,0.2)', 
                    borderRadius: '4px', 
                    padding: '10px', 
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h4 style={{margin: '0 0 5px 0', color: 'var(--primary-cyan)', fontSize: '0.9rem'}}>{q.icon} {q.title || q.name}</h4>
                      <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>{q.difficulty} | {q.type}</div>
                    </div>
                    <button 
                      onClick={() => handleDeactivateQuest(q.id)}
                      style={{
                        background: 'rgba(255, 42, 85, 0.1)',
                        border: '1px solid #ff2a55',
                        color: '#ff2a55',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.7rem'
                      }}
                    >
                      DEACTIVATE
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestManagement;
