import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, getDocs, writeBatch, where } from 'firebase/firestore';
import { db } from '../firebase';

// Helper to handle real-time listening
export const listenToCollection = (collectionName, callback, sortField = null, sortOrder = 'desc', limitCount = 50) => {
  let q = collection(db, collectionName);
  
  if (sortField) {
    q = query(q, orderBy(sortField, sortOrder), limit(limitCount));
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(data);
  }, (error) => {
    console.error(`Error listening to ${collectionName}:`, error);
  });

  return unsubscribe;
};

// Add a new quest pin
export const addQuest = async (questData) => {
  try {
    const docRef = await addDoc(collection(db, 'quests'), {
      ...questData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding quest: ", error);
    throw error;
  }
};

// Batch Update: Adjust all active quests drop rate
export const updateAllActiveQuestsDropRate = async (newDropRate) => {
  try {
    const q = query(collection(db, 'quests'), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    
    // Initialize batch
    const batch = writeBatch(db);

    let count = 0;
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { bonusDropRate: newDropRate });
      count++;
    });

    if (count > 0) {
      await batch.commit();
      
      // Also write an economy log
      await addDoc(collection(db, 'economyLogs'), {
        timestamp: serverTimestamp(),
        action: "Global Auto-Balance",
        reason: "Admin ML Batch Application",
        oldRate: "Mixed",
        newRate: newDropRate,
        questsAffected: count
      });
    }
    
    return count;
  } catch (error) {
    console.error("Batch update failed:", error);
    throw error;
  }
};
