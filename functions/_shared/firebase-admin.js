const admin = require('firebase-admin');

let initialized = false;

function getAdmin() {
  if (!initialized) {
    admin.initializeApp();
    initialized = true;
  }
  return admin;
}

function getDb() {
  return getAdmin().firestore();
}

function getAuth() {
  return getAdmin().auth();
}

async function verifyToken(token) {
  return getAuth().verifyIdToken(token);
}

async function getUser(uid) {
  const db = getDb();
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function createUser(uid, data) {
  const db = getDb();
  await db.collection('users').doc(uid).set(data);
  return { id: uid, ...data };
}

async function updateUser(uid, data) {
  const db = getDb();
  await db.collection('users').doc(uid).set(data, { merge: true });
  const doc = await db.collection('users').doc(uid).get();
  return { id: doc.id, ...doc.data() };
}

module.exports = { getAdmin, getDb, verifyToken, getUser, createUser, updateUser };
