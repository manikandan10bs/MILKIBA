import {
signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
ref,
get
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import {
auth,
database
} from "./firebase-config.js";

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {

event.preventDefault();

const email =
    document.getElementById("email").value.trim();

const password =
    document.getElementById("password").value;


message.textContent = "Logging in...";


try {

    const userCredential =
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );


    const user = userCredential.user;

    console.log("Logged in UID:", user.uid);


    const userRef =
        ref(database, "users/" + user.uid);

    const snapshot =
        await get(userRef);


    if (!snapshot.exists()) {

        message.textContent =
            "User profile not found.";

        return;
    }


    const userData = snapshot.val();

    const role = userData.role;


    console.log("User role:", role);


    if (role === "buyer") {

        window.location.href =
            "./buyer.html";

    } else if (role === "seller") {

        window.location.href =
            "./seller.html";

    } else if (role === "vendor") {

        window.location.href =
            "./vendor.html";

    } else {

        message.textContent =
            "Invalid user role.";

    }


} catch (error) {

    console.error(error);

    message.textContent =
        error.message;

}

});
