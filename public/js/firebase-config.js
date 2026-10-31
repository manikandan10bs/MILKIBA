import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGTewbbfiq4O2pxIB0wY9qnQPSLdSyueg",
    authDomain: "milkiba-18.firebaseapp.com",
    databaseURL: "https://milkiba-18-default-rtdb.firebaseio.com/",
    projectId: "milkiba-18",
    storageBucket: "milkiba-18.firebasestorage.app",
    messagingSenderId: "786006705495",
    appId: "1:786006705495:web:d6efbb6464fa9983f32a12",
    measurementId: "G-JFB19NN212"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const database = getDatabase(app);

export { app, auth, database };