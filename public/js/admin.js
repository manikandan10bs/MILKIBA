import {
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    ref,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import { auth, database } from "./firebase-config.js";


/*
    IMPORTANT:
    Replace this with your actual Admin Google email.
*/

const ADMIN_EMAIL = "akashchinnaswamy2712@gmail.com";


const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginMessage = document.getElementById("loginMessage");
const adminEmail = document.getElementById("adminEmail");

const requestsContainer =
    document.getElementById("requestsContainer");


/*
    Google Login
*/

googleLoginBtn.addEventListener("click", async () => {

    loginMessage.textContent = "Opening Google login...";
    loginMessage.style.color = "#555";

    try {

        const provider = new GoogleAuthProvider();

        await signInWithPopup(auth, provider);

    } catch (error) {

        console.error("Google login error:", error);

        loginMessage.textContent =
            "Google login failed: " + error.message;

        loginMessage.style.color = "#c62828";
    }
});


/*
    Authentication State
*/

onAuthStateChanged(auth, (user) => {

    if (!user) {

        loginSection.classList.remove("hidden");
        dashboardSection.classList.add("hidden");
        logoutBtn.classList.add("hidden");

        return;
    }


    const email = user.email || "";


    /*
        Check Admin email.
    */

    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {

        loginMessage.textContent =
            "This Google account is not authorized as Admin.";

        loginMessage.style.color = "#c62828";

        signOut(auth);

        return;
    }


    /*
        Authorized Admin
    */

    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");

    adminEmail.textContent = email;

    loadResetRequests();
});


/*
    Logout
*/

logoutBtn.addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        console.error("Logout error:", error);

    }
});


/*
    Load Password Reset Requests
*/

function loadResetRequests() {

    const requestsRef =
        ref(database, "passwordResetRequests");


    onValue(requestsRef, (snapshot) => {

        requestsContainer.innerHTML = "";


        if (!snapshot.exists()) {

            requestsContainer.innerHTML = `
                <p class="empty">
                    No password reset requests found.
                </p>
            `;

            return;
        }


        const requests = snapshot.val();

        const entries = Object.entries(requests);


        /*
            Newest requests first.
        */

        entries.sort((a, b) => {

            const dateA =
                new Date(a[1].createdAt || 0).getTime();

            const dateB =
                new Date(b[1].createdAt || 0).getTime();

            return dateB - dateA;
        });


        entries.forEach(([requestId, request]) => {

            const card =
                document.createElement("div");

            card.className = "request-card";


            const statusClass =
                request.status === "Completed"
                    ? "status completed"
                    : "status";


            card.innerHTML = `
                <h3>Password Reset Request</h3>

                <div class="request-row">
                    <strong>Email:</strong>
                    ${escapeHtml(request.email || "")}
                </div>

                <div class="request-row">
                    <strong>Account:</strong>
                    ${escapeHtml(request.role || "")}
                </div>

                <div class="request-row">
                    <strong>Reason:</strong>
                    ${escapeHtml(request.reason || "")}
                </div>

                <div class="request-row">
                    <strong>Created:</strong>
                    ${escapeHtml(request.createdAt || "")}
                </div>

                <div class="request-row">
                    <strong>Status:</strong>
                    <span class="${statusClass}">
                        ${escapeHtml(request.status || "")}
                    </span>
                </div>

                ${
                    request.status === "Pending"
                    ? `
                        <button
                            class="review-btn"
                            data-id="${requestId}"
                        >
                            Mark as Reviewed
                        </button>
                    `
                    : ""
                }
            `;


            requestsContainer.appendChild(card);


            const reviewButton =
                card.querySelector(".review-btn");


            if (reviewButton) {

                reviewButton.addEventListener(
                    "click",
                    () => markAsReviewed(requestId)
                );
            }

        });

    }, (error) => {

        console.error(
            "Unable to load reset requests:",
            error
        );

        requestsContainer.innerHTML = `
            <p class="empty">
                Unable to load password reset requests.
            </p>
        `;
    });
}


/*
    Mark Request as Reviewed
*/

async function markAsReviewed(requestId) {

    try {

        const requestRef =
            ref(
                database,
                "passwordResetRequests/" + requestId
            );


        await update(requestRef, {

            status: "Reviewed",

            reviewedAt:
                new Date().toISOString(),

            reviewedBy:
                auth.currentUser.email

        });

    } catch (error) {

        console.error(
            "Unable to update request:",
            error
        );

        alert(
            "Unable to update request: " +
            error.message
        );
    }
}


/*
    Prevent HTML injection
*/

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}