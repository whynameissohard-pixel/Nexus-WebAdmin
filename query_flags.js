const admin = require("firebase-admin");
const serviceAccount = require("./functions/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
admin.firestore().collection("flags").get().then(snap => {
  console.log("Found", snap.size, "flags");
  snap.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
});
