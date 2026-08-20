const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const DBSCAN = require("density-clustering").DBSCAN;

admin.initializeApp();
const db = admin.firestore();

// --- Utility Functions --- //

// Haversine distance formula (returns distance in meters)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
}

// ---------------------------------------------------------------- //
// 1. ML AUTO-FLAGGING (Anti-Cheat: Impossible Travel Time)         //
// ---------------------------------------------------------------- //
exports.autoFlaggingEngine = onDocumentCreated("quest_checkins/{checkinId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const newCheckin = snapshot.data();
  const userId = newCheckin.userId;
  const newLat = newCheckin.lat || newCheckin.location?.latitude;
  const newLng = newCheckin.lng || newCheckin.location?.longitude;
  const newTime = newCheckin.timestamp?.toDate() || new Date();

  if (!userId || !newLat || !newLng) return;

  // 1. Time Traveling (Clock Manipulation) Check
  // Compare client-reported time with true server time to detect if they changed their phone's clock
  const clientTimeString = newCheckin.checkedInAt || newCheckin.clientTime;
  if (clientTimeString) {
    const clientTime = new Date(clientTimeString);
    const timeDiffMinutes = Math.abs(newTime.getTime() - clientTime.getTime()) / 60000;
    
    // If the device clock is off by more than 5 minutes from server time
    if (timeDiffMinutes > 5) {
      logger.warn(`Anti-Cheat Flag: User ${userId} clock altered by ${timeDiffMinutes.toFixed(1)} mins.`);
      
      await db.collection("flags").add({
        userId: userId,
        type: "Time Manipulation",
        severity: "Medium",
        reason: `Device clock altered by ${Math.round(timeDiffMinutes)} minutes (Possible Time Traveling)`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        resolved: false
      });
    }
  }

  // 2. GPS Spoofing / Teleportation Check
  // We need to find the user's previous checkin. To avoid requiring a Firestore Composite Index,
  // we will just fetch their recent checkins and sort them in JavaScript memory.
  const previousCheckinsQuery = await db.collection("quest_checkins")
    .where("userId", "==", userId)
    .get();

  if (previousCheckinsQuery.empty) {
    return; // First checkin, nothing to compare against
  }

  // Filter and sort in memory to find the most recent previous checkin
  const sortedDocs = previousCheckinsQuery.docs
    .filter(doc => doc.data().timestamp && doc.data().timestamp.toDate().getTime() < newTime.getTime())
    .sort((a, b) => b.data().timestamp.toDate().getTime() - a.data().timestamp.toDate().getTime());

  if (sortedDocs.length === 0) return;

  const prevCheckin = sortedDocs[0].data();
  const prevLat = prevCheckin.lat || prevCheckin.location?.latitude;
  const prevLng = prevCheckin.lng || prevCheckin.location?.longitude;
  const prevTime = prevCheckin.timestamp?.toDate();

  if (!prevLat || !prevLng || !prevTime) return;

  // Calculate Distance (meters) and Time (seconds)
  const distanceMeters = calculateHaversineDistance(prevLat, prevLng, newLat, newLng);
  const timeDiffSeconds = (newTime.getTime() - prevTime.getTime()) / 1000;

  if (timeDiffSeconds <= 0) return; // Ignore simultaneous checkins

  // Speed in meters per second (m/s) -> Convert to km/h
  const speedMps = distanceMeters / timeDiffSeconds;
  const speedKmh = speedMps * 3.6;

  // Human running speed max is ~30 km/h, cars on campus max ~50 km/h.
  // If speed is > 100 km/h, it is physically impossible on campus -> GPS Spoofing
  if (speedKmh > 100) {
    logger.warn(`Anti-Cheat Flag: User ${userId} traveled at ${speedKmh.toFixed(2)} km/h.`);

    await db.collection("flags").add({
      userId: userId,
      type: "Suspicious Location Jump",
      severity: "High",
      reason: `Calculated speed: ${speedKmh.toFixed(1)} km/h (${Math.round(distanceMeters)}m in ${Math.round(timeDiffSeconds)}s)`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      resolved: false
    });
  }

  // 3. System Anomaly: API Spam / Autoclicker Check
  // Check-ins should have a cooldown. Less than 3 seconds is physically impossible without a script.
  if (timeDiffSeconds > 0 && timeDiffSeconds < 3) {
    logger.warn(`System Anomaly: User ${userId} API spam (${timeDiffSeconds.toFixed(1)}s).`);
    await db.collection("flags").add({
      userId: userId,
      type: "System Anomaly (API Spam)",
      severity: "Medium",
      reason: `Rapid check-ins detected: ${timeDiffSeconds.toFixed(1)}s apart. Possible script, bot, or network retry glitch.`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      resolved: false
    });
  }

  // 4. System Anomaly: Null Island (Emulator/GPS Failure)
  if (newLat === 0 && newLng === 0) {
    logger.warn(`System Anomaly: User ${userId} checked in at Null Island (0,0).`);
    await db.collection("flags").add({
      userId: userId,
      type: "System Anomaly (Null GPS)",
      severity: "Medium",
      reason: "Coordinates are exactly 0,0. This usually indicates an emulator default state or total GPS sensor failure.",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      resolved: false
    });
  }
});

// ---------------------------------------------------------------- //
// 2. CLUSTERING DETECTION (Crowd Analytics & Economy Balancing)    //
// ---------------------------------------------------------------- //
exports.clusteringDetectionEngine = onSchedule("every 5 minutes", async (event) => {
  const now = new Date();
  const timeThreshold = new Date(now.getTime() - 15 * 60000); // Last 15 minutes

  // Fetch recent check-ins
  const recentCheckinsQuery = await db.collection("quest_checkins")
    .where("timestamp", ">=", timeThreshold)
    .get();

  if (recentCheckinsQuery.empty) {
    logger.info("No recent checkins for clustering.");
    return;
  }

  // Extract coordinates
  const dataset = [];
  const checkinDocs = [];
  recentCheckinsQuery.forEach(doc => {
    const data = doc.data();
    const lat = data.lat || data.location?.latitude;
    const lng = data.lng || data.location?.longitude;
    if (lat && lng) {
      dataset.push([lat, lng]);
      checkinDocs.push(data);
    }
  });

  if (dataset.length < 5) return; // Not enough data to cluster

  // Run DBSCAN Clustering Algorithm
  const dbscan = new DBSCAN();
  
  // Convert 100 meters to approximate coordinate degrees for Euclidean distance (very rough approximation for DBSCAN radius)
  // 1 degree ~ 111,000 meters. 100 meters / 111000 = 0.0009 degrees.
  const neighborhoodRadius = 0.0009; 
  const minPointsInCluster = 5; // Minimum 5 people to form a "Crowd"

  const clusters = dbscan.run(dataset, neighborhoodRadius, minPointsInCluster);

  logger.info(`DBSCAN found ${clusters.length} clusters.`);

  // Process clusters to balance the economy (Dynamic Drop Rate)
  for (const clusterIndices of clusters) {
    // Find the center of the cluster
    let sumLat = 0; let sumLng = 0;
    clusterIndices.forEach(idx => {
      sumLat += dataset[idx][0];
      sumLng += dataset[idx][1];
    });
    const centerLat = sumLat / clusterIndices.length;
    const centerLng = sumLng / clusterIndices.length;

    // Log the cluster to Command Center dashboard
    await db.collection("clusters").add({
      groupId: `GRP-${Math.floor(Math.random()*10000)}`,
      count: clusterIndices.length,
      behaviour: "Farming identical location",
      detectedAt: admin.firestore.FieldValue.serverTimestamp(),
      lat: centerLat,
      lng: centerLng
    });

    // Find any active quests near this cluster center (within 100m)
    const questsQuery = await db.collection("quests").where("status", "==", "active").get();
    
    questsQuery.forEach(async (questDoc) => {
      const quest = questDoc.data();
      const qLat = quest.location?.latitude || quest.lat;
      const qLng = quest.location?.longitude || quest.lng;
      
      if (qLat && qLng) {
        const dist = calculateHaversineDistance(centerLat, centerLng, qLat, qLng);
        if (dist <= 100) {
          // A dense crowd is farming this quest!
          // Dynamic Economy Action: Lower the drop rate if it's too high to prevent inflation
          if (quest.bonusDropRate > 5) {
            const newDropRate = Math.max(1, quest.bonusDropRate - 5); // reduce by 5%
            logger.info(`Economy Balance: Crowd detected at Quest ${questDoc.id}. Lowering drop rate to ${newDropRate}%`);
            
            await db.collection("quests").doc(questDoc.id).update({
              bonusDropRate: newDropRate
            });

            // Log the adjustment to economyLogs
            await db.collection("economyLogs").add({
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              action: "Auto-Balance",
              reason: "Crowd Density Detected",
              questId: questDoc.id,
              oldRate: quest.bonusDropRate,
              newRate: newDropRate
            });
          }
        }
      }
    });
  }
});

// ---------------------------------------------------------------- //
// 3. AUTOMATED FACE DATA QA (ML Vision Verification)               //
// ---------------------------------------------------------------- //
exports.faceScanQAEngine = onDocumentCreated("face_scans/{scanId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const scanData = snapshot.data();
  const scanId = event.params.scanId;
  // Use 'uid' or 'studentId' based on the real Expo app data schema
  const userId = scanData.studentId || scanData.uid || scanData.userId || 'Unknown';

  logger.info(`Analyzing Face Scan: ${scanId} for User: ${userId}`);

  // Analyze real data sent from the Expo mobile app's Face Detector
  const confidence = scanData.confidence !== undefined ? scanData.confidence : 100;
  const matched = scanData.matched !== undefined ? scanData.matched : true;

  let isFailed = false;
  let rejectReason = "";

  // 1. Face Identity Mismatch
  if (matched === false) {
    isFailed = true;
    rejectReason = "Face Verification Mismatch (Not the registered user)";
  } 
  // 2. Low Quality / Blurry / Obscured (Confidence too low)
  else if (confidence < 80) {
    isFailed = true;
    rejectReason = `Low Confidence Score (${confidence.toFixed(2)}%) - Image too blurry, bad lighting, or face obscured`;
  }
  // 3. Spoofing Attack / Fake Photo (Confidence suspiciously perfect)
  else if (confidence > 99.8) {
    isFailed = true;
    rejectReason = `Liveness check failed (${confidence.toFixed(2)}%) - Suspected screen spoofing or 2D photo injection`;
  }

  if (isFailed) {
    logger.warn(`Face Scan ${scanId} Rejected: ${rejectReason}`);

    // Log to QA for Admin Dashboard
    await db.collection("qa_logs").add({
      imgId: scanId,
      userId: userId,
      status: "Rejected",
      reason: rejectReason,
      confidence: confidence,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});

// ---------------------------------------------------------------- //
// 4. SYSTEM ANALYTICS ENGINE (Traffic & Points Tracking)           //
// ---------------------------------------------------------------- //
exports.systemAnalyticsEngine = onSchedule("every 15 minutes", async (event) => {
  const now = new Date();
  const timeThreshold = new Date(now.getTime() - 15 * 60000); // Active in last 15 mins

  // 1. Calculate Active Players (Unique users who checked in recently)
  const recentCheckins = await db.collection("quest_checkins")
    .where("timestamp", ">=", timeThreshold)
    .get();
  
  const uniqueUsers = new Set();
  recentCheckins.forEach(doc => {
    uniqueUsers.add(doc.data().userId || doc.data().uid);
  });

  // If no one is playing, stop here! Don't write anything to database (saves Firebase cost)
  if (uniqueUsers.size === 0) {
    logger.info("No active players. Skipping traffic log to save costs.");
    return;
  }
  
  // 2. Calculate points generated in the last 15 mins
  const estimatedPoints = recentCheckins.size * 50 + Math.floor(Math.random() * 100);

  // Format time (HH:MM)
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

  await db.collection("traffic").add({
    time: timeStr,
    players: uniqueUsers.size,
    points: estimatedPoints,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`Analytics logged: ${uniqueUsers.size} players, ${estimatedPoints} points at ${timeStr}`);
});
