import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    ref,
    set
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import {
    auth,
    database
} from "./firebase-config.js";


const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");


registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    message.textContent = "";

    if (!role) {
        message.textContent = "Please select your role.";
        return;
    }

    try {

        message.textContent = "Creating account...";

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        await set(ref(database, "users/" + user.uid), {

            name: name,
            email: email,
            role: role,
            createdAt: new Date().toISOString()

        });

        message.textContent =
            "Account created successfully!";

        registerForm.reset();

        console.log("User UID:", user.uid);
        console.log("User role:", role);

    } catch (error) {

        console.error(error);

        message.textContent = error.message;

    }

});