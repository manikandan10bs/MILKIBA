import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    ref,
    push,
    set
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import { auth, database } from "./firebase-config.js";

const resetForm = document.getElementById("resetForm");
const message = document.getElementById("message");

resetForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const role = document.getElementById("role").value;
    const reason = document.getElementById("reason").value.trim();

    if (!email || !role || !reason) {
        message.textContent = "Please fill in all fields.";
        message.style.color = "#c62828";
        return;
    }

    message.textContent = "Sending password reset email...";
    message.style.color = "#555";

    try {

        await sendPasswordResetEmail(auth, email);

        const requestRef = push(ref(database, "passwordResetRequests"));

        await set(requestRef, {
            email: email,
            role: role,
            reason: reason,
            status: "Pending",
            createdAt: new Date().toISOString()
        });

        message.textContent =
            "Password reset email sent. Please check your email and follow the instructions.";

        message.style.color = "#2e7d32";

        resetForm.reset();

    } catch (error) {

        console.error("Password reset error:", error);

        if (error.code === "auth/user-not-found") {
            message.textContent =
                "No account was found with this email address.";
        } else if (error.code === "auth/invalid-email") {
            message.textContent =
                "Please enter a valid email address.";
        } else if (error.code === "auth/too-many-requests") {
            message.textContent =
                "Too many requests. Please try again later.";
        } else {
            message.textContent =
                "Unable to send reset email: " + error.message;
        }

        message.style.color = "#c62828";
    }
});