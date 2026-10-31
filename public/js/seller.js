import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    ref,
    get,
    set,
    update,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import {
    auth,
    database
} from "./firebase-config.js";


const userName =
    document.getElementById("userName");

const todayDate =
    document.getElementById("todayDate");

const quantityArea =
    document.getElementById("quantityArea");

const approxQuantity =
    document.getElementById("approxQuantity");

const statusMessage =
    document.getElementById("statusMessage");

const historyContainer =
    document.getElementById("historyContainer");

const requestContainer =
    document.getElementById("requestContainer");


let currentUser = null;
let currentSession = "morning";
let milkAvailable = null;


const today = new Date();

const dateString =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");


todayDate.textContent =
    formatDate(dateString);


function formatDate(date) {

    return new Date(date + "T00:00:00")
        .toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

}


function capitalize(value) {

    if (!value) {
        return "";
    }

    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================
   SESSION CHANGE
========================================= */

document
    .querySelectorAll(".session-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                document
                    .querySelectorAll(".session-btn")
                    .forEach(btn =>
                        btn.classList.remove("active")
                    );

                button.classList.add("active");

                currentSession =
                    button.dataset.session;

                milkAvailable = null;

                document
                    .querySelectorAll(".status-btn")
                    .forEach(btn =>
                        btn.classList.remove("selected")
                    );

                quantityArea.classList.add("hidden");

                approxQuantity.value = "";

                statusMessage.textContent = "";

                await loadTodayNotification();

            }
        );

    });


/* =========================================
   YES BUTTON
========================================= */

document
    .getElementById("milkYesBtn")
    .addEventListener(
        "click",
        () => {

            milkAvailable = true;

            document
                .getElementById("milkYesBtn")
                .classList.add("selected");

            document
                .getElementById("milkNoBtn")
                .classList.remove("selected");

            quantityArea.classList.remove("hidden");

        }
    );


/* =========================================
   NO BUTTON
========================================= */

document
    .getElementById("milkNoBtn")
    .addEventListener(
        "click",
        () => {

            milkAvailable = false;

            document
                .getElementById("milkNoBtn")
                .classList.add("selected");

            document
                .getElementById("milkYesBtn")
                .classList.remove("selected");

            quantityArea.classList.add("hidden");

            approxQuantity.value = "";

        }
    );


/* =========================================
   SAVE SELLER NOTIFICATION
========================================= */

document
    .getElementById("updateStatusBtn")
    .addEventListener(
        "click",
        async () => {

            if (milkAvailable === null) {

                statusMessage.textContent =
                    "Please select YES or NO.";

                return;
            }

            const quantity =
                milkAvailable
                    ? Number(approxQuantity.value) || 0
                    : 0;


            const notificationId =
                `${currentUser.uid}_${dateString}_${currentSession}`;


            try {

                await set(
                    ref(
                        database,
                        "sellerNotifications/" +
                        notificationId
                    ),
                    {

                        sellerId:
                            currentUser.uid,

                        sellerName:
                            userName.textContent,

                        date:
                            dateString,

                        session:
                            currentSession,

                        milkAvailable,

                        estimatedQuantity:
                            quantity,

                        updatedAt:
                            new Date().toISOString()

                    }
                );


                statusMessage.textContent =
                    "Milk status updated successfully.";

            } catch (error) {

                console.error(
                    "Error saving seller notification:",
                    error
                );

                statusMessage.textContent =
                    error.message;

            }

        }
    );


/* =========================================
   LOAD TODAY NOTIFICATION
========================================= */

async function loadTodayNotification() {

    if (!currentUser) {
        return;
    }


    const notificationId =
        `${currentUser.uid}_${dateString}_${currentSession}`;


    try {

        const snapshot =
            await get(
                ref(
                    database,
                    "sellerNotifications/" +
                    notificationId
                )
            );


        if (!snapshot.exists()) {
            return;
        }


        const data =
            snapshot.val();


        milkAvailable =
            data.milkAvailable;


        if (milkAvailable) {

            document
                .getElementById("milkYesBtn")
                .classList.add("selected");

            document
                .getElementById("milkNoBtn")
                .classList.remove("selected");

            quantityArea.classList.remove("hidden");

            approxQuantity.value =
                data.estimatedQuantity || "";

        } else {

            document
                .getElementById("milkNoBtn")
                .classList.add("selected");

            document
                .getElementById("milkYesBtn")
                .classList.remove("selected");

            quantityArea.classList.add("hidden");

            approxQuantity.value = "";

        }

    } catch (error) {

        console.error(
            "Error loading seller notification:",
            error
        );

    }

}


/* =========================================
   LOAD APPROVAL REQUESTS
========================================= */

async function loadRequests() {

    if (!currentUser) {
        return;
    }


    try {

        const requestsQuery =
            query(
                ref(
                    database,
                    "changeRequests"
                ),
                orderByChild("targetUserId"),
                equalTo(currentUser.uid)
            );


        const snapshot =
            await get(requestsQuery);


        if (!snapshot.exists()) {

            requestContainer.innerHTML =
                "<p class='loading'>No requests.</p>";

            return;
        }


        const requests =
            Object.entries(snapshot.val())
                .map(([id, request]) => ({
                    id,
                    ...request
                }))
                .filter(request =>
                    request.status === "Pending"
                );


        if (requests.length === 0) {

            requestContainer.innerHTML =
                "<p class='loading'>No pending requests.</p>";

            return;
        }


        let html = "";


        requests.forEach(request => {

            const oldData =
                request.oldData || {};

            const newData =
                request.newData || {};


            const oldQuantity =
                request.transactionType === "collection"
                    ? oldData.actualQuantity
                    : oldData.suppliedQuantity;


            const newQuantity =
                newData.quantity;


            html += `
                <div class="request-card">

                    <h3>
                        Vendor wants to
                        ${request.type === "delete"
                            ? "delete"
                            : "edit"}
                        your ${request.transactionType}
                    </h3>

                    <p>
                        Date:
                        ${escapeHtml(oldData.date)}
                        -
                        ${capitalize(oldData.session)}
                    </p>

                    <p>
                        Current Quantity:
                        ${oldQuantity || 0} L
                    </p>

                    ${
                        request.type === "edit"
                            ? `
                                <p>
                                    New Quantity:
                                    ${newQuantity || 0} L
                                </p>

                                <p>
                                    Current Rate:
                                    ₹${oldData.rate || 0}
                                </p>

                                <p>
                                    New Rate:
                                    ₹${newData.rate || 0}
                                </p>

                                <p>
                                    New Paid Amount:
                                    ₹${newData.paymentAmount || 0}
                                </p>
                            `
                            : ""
                    }

                    <p>
                        Reason:
                        ${escapeHtml(request.reason)}
                    </p>

                    <div class="request-actions">

                        <button
                            class="approve-btn"
                            onclick="approveRequest('${request.id}')">
                            Accept
                        </button>

                        <button
                            class="reject-btn"
                            onclick="rejectRequest('${request.id}')">
                            Reject
                        </button>

                    </div>

                </div>
            `;

        });


        requestContainer.innerHTML =
            html;

    } catch (error) {

        console.error(
            "Error loading change requests:",
            error
        );

        requestContainer.innerHTML =
            "<p class='loading'>Unable to load requests.</p>";

    }

}


/* =========================================
   APPROVE REQUEST
========================================= */

window.approveRequest = async function (
    requestId
) {

    try {

        const requestSnapshot =
            await get(
                ref(
                    database,
                    "changeRequests/" +
                    requestId
                )
            );


        if (!requestSnapshot.exists()) {
            return;
        }


        const request =
            requestSnapshot.val();


        if (
            request.targetUserId !==
            currentUser.uid
        ) {
            return;
        }


        const path =
            request.transactionType === "collection"
                ? "milkCollections/"
                : "milkSupplies/";


        const transactionRef =
            ref(
                database,
                path + request.transactionId
            );


        const transactionSnapshot =
            await get(transactionRef);


        if (!transactionSnapshot.exists()) {
            return;
        }


        if (request.type === "delete") {

            await update(
                transactionRef,
                {

                    recordStatus:
                        "Deleted",

                    deletedAt:
                        new Date().toISOString(),

                    deletedBy:
                        currentUser.uid,

                    deletionApprovedBy:
                        currentUser.uid,

                    deletionRequestId:
                        requestId

                }
            );

        } else {

            const newData =
                request.newData;


            const updates =
                request.transactionType === "collection"
                    ? {

                        actualQuantity:
                            newData.quantity,

                        rate:
                            newData.rate,

                        totalAmount:
                            newData.totalAmount,

                        paymentAmount:
                            newData.paymentAmount,

                        pendingAmount:
                            newData.pendingAmount,

                        paymentStatus:
                            newData.paymentStatus,

                        updatedAt:
                            new Date().toISOString(),

                        editApprovedBy:
                            currentUser.uid,

                        editRequestId:
                            requestId

                    }
                    : {

                        suppliedQuantity:
                            newData.quantity,

                        rate:
                            newData.rate,

                        totalAmount:
                            newData.totalAmount,

                        paymentAmount:
                            newData.paymentAmount,

                        pendingAmount:
                            newData.pendingAmount,

                        paymentStatus:
                            newData.paymentStatus,

                        updatedAt:
                            new Date().toISOString(),

                        editApprovedBy:
                            currentUser.uid,

                        editRequestId:
                            requestId

                    };


            await update(
                transactionRef,
                updates
            );

        }


        await update(
            ref(
                database,
                "changeRequests/" +
                requestId
            ),
            {

                status:
                    "Approved",

                approvedAt:
                    new Date().toISOString(),

                approvedBy:
                    currentUser.uid

            }
        );


        await loadRequests();

        await loadHistory();


    } catch (error) {

        console.error(
            "Error approving request:",
            error
        );

    }

};


/* =========================================
   REJECT REQUEST
========================================= */

window.rejectRequest = async function (
    requestId
) {

    try {

        const requestSnapshot =
            await get(
                ref(
                    database,
                    "changeRequests/" +
                    requestId
                )
            );


        if (!requestSnapshot.exists()) {
            return;
        }


        const request =
            requestSnapshot.val();


        if (
            request.targetUserId !==
            currentUser.uid
        ) {
            return;
        }


        await update(
            ref(
                database,
                "changeRequests/" +
                requestId
            ),
            {

                status:
                    "Rejected",

                rejectedAt:
                    new Date().toISOString(),

                rejectedBy:
                    currentUser.uid

            }
        );


        await loadRequests();


    } catch (error) {

        console.error(
            "Error rejecting request:",
            error
        );

    }

};


/* =========================================
   COLLECTION HISTORY
========================================= */

async function loadHistory() {

    if (!currentUser) {
        return;
    }


    try {

        const historyQuery =
            query(
                ref(
                    database,
                    "milkCollections"
                ),
                orderByChild("sellerId"),
                equalTo(currentUser.uid)
            );


        const snapshot =
            await get(historyQuery);


        if (!snapshot.exists()) {

            historyContainer.innerHTML =
                "<p class='loading'>No collection history yet.</p>";

            return;
        }


        const records =
            Object.values(snapshot.val())
                .sort(
                    (a, b) =>
                        (b.date + b.session)
                            .localeCompare(
                                a.date + a.session
                            )
                );


        if (records.length === 0) {

            historyContainer.innerHTML =
                "<p class='loading'>No collection history yet.</p>";

            return;
        }


        let html = `
            <table class="history-table">

                <thead>

                    <tr>

                        <th>Date</th>

                        <th>Session</th>

                        <th>Quantity</th>

                        <th>Rate</th>

                        <th>Total</th>

                        <th>Paid</th>

                        <th>Pending</th>

                        <th>Status</th>

                    </tr>

                </thead>

                <tbody>
        `;


        records.forEach(record => {

            const deleted =
                record.recordStatus === "Deleted";


            const statusClass =
                deleted
                    ? "deleted"
                    : record.paymentStatus === "Paid"
                        ? "paid"
                        : record.paymentStatus === "Partial"
                            ? "partial"
                            : "not-paid";


            html += `
                <tr>

                    <td>
                        ${formatDate(record.date)}
                    </td>

                    <td>
                        ${capitalize(record.session)}
                    </td>

                    <td>
                        ${record.actualQuantity || 0} L
                    </td>

                    <td>
                        ₹${record.rate || 0}
                    </td>

                    <td>
                        ₹${record.totalAmount || 0}
                    </td>

                    <td>
                        ₹${record.paymentAmount || 0}
                    </td>

                    <td>
                        ₹${record.pendingAmount || 0}
                    </td>

                    <td>

                        <span class="status-badge ${statusClass}">
                            ${
                                deleted
                                    ? "Deleted"
                                    : record.paymentStatus
                            }
                        </span>

                    </td>

                </tr>
            `;

        });


        html += `
                </tbody>

            </table>
        `;


        historyContainer.innerHTML =
            html;


    } catch (error) {

        console.error(
            "Error loading collection history:",
            error
        );

        historyContainer.innerHTML =
            "<p class='loading'>Unable to load collection history.</p>";

    }

}


/* =========================================
   LOGOUT
========================================= */

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        async () => {

            try {

                await signOut(auth);

                window.location.href =
                    "./login.html";

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }

        }
    );


/* =========================================
   AUTHENTICATION
========================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "./login.html";

            return;
        }


        currentUser =
            user;


        try {

            const snapshot =
                await get(
                    ref(
                        database,
                        "users/" +
                        user.uid
                    )
                );


            if (!snapshot.exists()) {

                window.location.href =
                    "./login.html";

                return;
            }


            const userData =
                snapshot.val();


            if (userData.role !== "seller") {

                window.location.href =
                    "./login.html";

                return;
            }


            userName.textContent =
                userData.name || "Seller";


            await loadTodayNotification();

            await loadRequests();

            await loadHistory();


        } catch (error) {

            console.error(
                "Error loading seller profile:",
                error
            );

        }

    }
);