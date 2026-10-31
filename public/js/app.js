import { auth, database } from "./firebase-config.js";

console.log("Milkiba JavaScript loaded successfully.");
console.log("Firebase Authentication connected.");
console.log("Firebase Realtime Database connected.");

console.log("Firebase App:", auth.app.name);
console.log("Database:", database.app.name);