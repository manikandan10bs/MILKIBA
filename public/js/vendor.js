import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    ref,
    get,
    set,
    push,
    update
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import {
    auth,
    database
} from "./firebase-config.js";


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let currentSession = "morning";

let selectedSeller = null;
let selectedBuyer = null;

let sellerNotificationsCache = {};
let buyerNotificationsCache = {};


/* =========================================================
   DOM ELEMENTS
========================================================= */

const userName = document.getElementById("userName");
const selectedDate = document.getElementById("selectedDate");

const sellerContainer = document.getElementById("sellerContainer");
const buyerContainer = document.getElementById("buyerContainer");

const collectionModal = document.getElementById("collectionModal");
const supplyModal = document.getElementById("supplyModal");

const editRequestModal = document.getElementById("editRequestModal");
const deleteRequestModal = document.getElementById("deleteRequestModal");


/* History styles are now bundled cleanly in vendor.css */


/* =========================================================
   CREATE HISTORY SECTIONS IF HTML DOES NOT HAVE THEM
========================================================= */

function createHistorySections() {

    let historyWrapper =
        document.getElementById("milkibaHistoryWrapper");

    if (!historyWrapper) {

        historyWrapper = document.createElement("div");

        historyWrapper.id = "milkibaHistoryWrapper";

        historyWrapper.className =
            "milkiba-history-wrapper";

        const mainContainer =
            document.querySelector("main") ||
            document.querySelector(".dashboard-container") ||
            document.body;

        mainContainer.appendChild(historyWrapper);
    }


    let collectionHistory =
        document.getElementById("collectionHistory");

    if (!collectionHistory) {

        const section =
            document.createElement("div");

        section.className =
            "milkiba-history-section";

        section.innerHTML = `
            <div class="milkiba-history-title">
                <h2>Collection History</h2>
                <span id="collectionHistoryDate"
                      class="milkiba-history-date"></span>
            </div>

            <div id="collectionHistory"></div>
        `;

        historyWrapper.appendChild(section);
    }


    let supplyHistory =
        document.getElementById("supplyHistory");

    if (!supplyHistory) {

        const section =
            document.createElement("div");

        section.className =
            "milkiba-history-section";

        section.innerHTML = `
            <div class="milkiba-history-title">
                <h2>Supply History</h2>
                <span id="supplyHistoryDate"
                      class="milkiba-history-date"></span>
            </div>

            <div id="supplyHistory"></div>
        `;

        historyWrapper.appendChild(section);
    }
}

createHistorySections();


/* =========================================================
   GET HISTORY ELEMENTS
========================================================= */

function getCollectionHistoryContainer() {
    return document.getElementById("collectionHistory");
}

function getSupplyHistoryContainer() {
    return document.getElementById("supplyHistory");
}


/* =========================================================
   HELPERS
========================================================= */

function getToday() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(now.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getDate() {

    return selectedDate?.value ||
        getToday();
}


function number(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
}


function money(value) {

    return number(value).toFixed(2);
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function safeFileName(value) {

    return String(value || "milkiba")
        .replace(/[^a-z0-9-_]/gi, "_");
}


/* =========================================================
   PAYMENT CALCULATIONS
========================================================= */

function paymentStatus(total, paid) {

    total = number(total);
    paid = number(paid);

    if (total <= 0) {
        return "Not Paid";
    }

    if (paid <= 0) {
        return "Not Paid";
    }

    if (paid >= total) {
        return "Paid";
    }

    return "Partial";
}


function pendingAmount(total, paid) {

    return Math.max(
        number(total) - number(paid),
        0
    );
}


function transactionIsActive(record) {

    return (
        record &&
        record.recordStatus !== "Deleted"
    );
}


/* =========================================================
   FIND NOTIFICATION
========================================================= */

function getNotification(
    notifications,
    userId,
    date,
    session
) {

    if (!notifications || !userId) {
        return null;
    }

    const key =
        `${userId}_${date}_${session}`;

    if (notifications[key]) {
        return notifications[key];
    }


    /* -----------------------------------------------------
       Fallback:
       Search notification values in case the key was
       created differently.
    ----------------------------------------------------- */

    for (const notificationKey in notifications) {

        const notification =
            notifications[notificationKey];

        if (!notification) {
            continue;
        }

        const notificationUserId =
            notification.sellerId ||
            notification.buyerId;

        const notificationDate =
            notification.date;

        const notificationSession =
            notification.session;

        if (
            String(notificationUserId) ===
                String(userId) &&
            String(notificationDate) ===
                String(date) &&
            String(notificationSession).toLowerCase() ===
                String(session).toLowerCase()
        ) {

            return notification;
        }
    }

    return null;
}


/* =========================================================
   GET SELLER NOTIFICATION QUANTITY
========================================================= */

function getSellerEstimatedQuantity(sellerId) {

    const notification =
        getNotification(
            sellerNotificationsCache,
            sellerId,
            getDate(),
            currentSession
        );

    if (!notification) {
        return 0;
    }

    return number(
        notification.estimatedQuantity
    );
}


/* =========================================================
   GET BUYER REQUESTED QUANTITY
========================================================= */

function getBuyerRequestedQuantity(buyerId) {

    const notification =
        getNotification(
            buyerNotificationsCache,
            buyerId,
            getDate(),
            currentSession
        );

    if (!notification) {
        return 0;
    }

    return number(
        notification.requestedQuantity
    );
}


/* =========================================================
   CALCULATION PREVIEW
========================================================= */

function createCalculationBox(
    container,
    prefix
) {

    if (!container) {
        return;
    }

    if (
        document.getElementById(
            `${prefix}CalculationBox`
        )
    ) {
        return;
    }

    const box =
        document.createElement("div");

    box.id =
        `${prefix}CalculationBox`;

    box.className =
        "milkiba-calculation-box";

    box.innerHTML = `

        <div class="milkiba-calculation-row">
            <span>Quantity</span>
            <strong id="${prefix}CalcQuantity">0.00</strong>
        </div>

        <div class="milkiba-calculation-row">
            <span>Rate</span>
            <strong id="${prefix}CalcRate">₹0.00</strong>
        </div>

        <div class="milkiba-calculation-row total">
            <span>Total Amount</span>
            <strong id="${prefix}CalcTotal">₹0.00</strong>
        </div>

        <div class="milkiba-calculation-row">
            <span>Payment</span>
            <strong id="${prefix}CalcPaid">₹0.00</strong>
        </div>

        <div class="milkiba-calculation-row pending">
            <span>Pending Amount</span>
            <strong id="${prefix}CalcPending">₹0.00</strong>
        </div>

        <div class="milkiba-calculation-row">
            <span>Payment Status</span>
            <span
                id="${prefix}CalcStatus"
                class="milkiba-calculation-status milkiba-calc-notpaid"
            >
                Not Paid
            </span>
        </div>

    `;

    container.appendChild(box);
}


/* =========================================================
   UPDATE CALCULATION PREVIEW
========================================================= */

function updateCalculationPreview(
    prefix,
    quantity,
    rate,
    paid
) {

    quantity = number(quantity);
    rate = number(rate);
    paid = number(paid);

    const total =
        quantity * rate;

    const pending =
        pendingAmount(
            total,
            paid
        );

    const status =
        paymentStatus(
            total,
            paid
        );


    const quantityElement =
        document.getElementById(
            `${prefix}CalcQuantity`
        );

    const rateElement =
        document.getElementById(
            `${prefix}CalcRate`
        );

    const totalElement =
        document.getElementById(
            `${prefix}CalcTotal`
        );

    const paidElement =
        document.getElementById(
            `${prefix}CalcPaid`
        );

    const pendingElement =
        document.getElementById(
            `${prefix}CalcPending`
        );

    const statusElement =
        document.getElementById(
            `${prefix}CalcStatus`
        );


    if (quantityElement) {
        quantityElement.textContent =
            money(quantity);
    }

    if (rateElement) {
        rateElement.textContent =
            `₹${money(rate)}`;
    }

    if (totalElement) {
        totalElement.textContent =
            `₹${money(total)}`;
    }

    if (paidElement) {
        paidElement.textContent =
            `₹${money(paid)}`;
    }

    if (pendingElement) {
        pendingElement.textContent =
            `₹${money(pending)}`;
    }


    if (statusElement) {

        statusElement.textContent =
            status;

        statusElement.className =
            "milkiba-calculation-status";

        if (status === "Paid") {

            statusElement.classList.add(
                "milkiba-calc-paid"
            );

        } else if (status === "Partial") {

            statusElement.classList.add(
                "milkiba-calc-partial"
            );

        } else {

            statusElement.classList.add(
                "milkiba-calc-notpaid"
            );
        }
    }
}


/* =========================================================
   COLLECTION LIVE CALCULATION
========================================================= */

function updateCollectionCalculation() {

    const actualQuantity =
        number(
            document.getElementById(
                "actualQuantity"
            )?.value
        );

    const rate =
        number(
            document.getElementById(
                "collectionRate"
            )?.value
        );

    const payment =
        number(
            document.getElementById(
                "collectionPaymentAmount"
            )?.value
        );

    updateCalculationPreview(
        "collection",
        actualQuantity,
        rate,
        payment
    );
}


/* =========================================================
   SUPPLY LIVE CALCULATION
========================================================= */

function updateSupplyCalculation() {

    const suppliedQuantity =
        number(
            document.getElementById(
                "suppliedQuantity"
            )?.value
        );

    const rate =
        number(
            document.getElementById(
                "supplyRate"
            )?.value
        );

    const payment =
        number(
            document.getElementById(
                "supplyPaymentAmount"
            )?.value
        );

    updateCalculationPreview(
        "supply",
        suppliedQuantity,
        rate,
        payment
    );
}


/* =========================================================
   EDIT LIVE CALCULATION
========================================================= */

function updateEditCalculation() {

    const quantity =
        number(
            document.getElementById(
                "editQuantity"
            )?.value
        );

    const rate =
        number(
            document.getElementById(
                "editRate"
            )?.value
        );

    const payment =
        number(
            document.getElementById(
                "editPaymentAmount"
            )?.value
        );

    updateCalculationPreview(
        "edit",
        quantity,
        rate,
        payment
    );
}


/* =========================================================
   ADD CALCULATION BOXES
========================================================= */

function setupCalculationBoxes() {

    if (collectionModal) {

        createCalculationBox(
            collectionModal,
            "collection"
        );
    }

    if (supplyModal) {

        createCalculationBox(
            supplyModal,
            "supply"
        );
    }

    if (editRequestModal) {

        createCalculationBox(
            editRequestModal,
            "edit"
        );
    }
}

setupCalculationBoxes();


/* =========================================================
   LIVE INPUT LISTENERS
========================================================= */

document.addEventListener(
    "input",
    event => {

        const id =
            event.target?.id;

        if (
            id === "actualQuantity" ||
            id === "collectionRate" ||
            id === "collectionPaymentAmount"
        ) {

            updateCollectionCalculation();
        }


        if (
            id === "suppliedQuantity" ||
            id === "supplyRate" ||
            id === "supplyPaymentAmount"
        ) {

            updateSupplyCalculation();
        }


        if (
            id === "editQuantity" ||
            id === "editRate" ||
            id === "editPaymentAmount"
        ) {

            updateEditCalculation();
        }
    }
);


/* =========================================================
   DATE / SESSION
========================================================= */

if (selectedDate) {

    selectedDate.value =
        getToday();

    selectedDate.addEventListener(
        "change",
        async () => {

            await loadDashboard();
        }
    );
}


/* =========================================================
   SESSION BUTTONS
========================================================= */

document
    .querySelectorAll("[data-session]")
    .forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                currentSession =
                    button.dataset.session;

                document
                    .querySelectorAll("[data-session]")
                    .forEach(btn => {

                        btn.classList.remove(
                            "active"
                        );
                    });

                button.classList.add(
                    "active"
                );

                await loadDashboard();
            }
        );
    });


/* =========================================================
   SET MORNING ACTIVE BY DEFAULT
========================================================= */

const defaultMorningButton =
    document.querySelector(
        '[data-session="morning"]'
    );

if (defaultMorningButton) {

    document
        .querySelectorAll("[data-session]")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );
        });

    defaultMorningButton.classList.add(
        "active"
    );
}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "index.html";

            return;
        }


        try {

            const userSnapshot =
                await get(
                    ref(
                        database,
                        `users/${user.uid}`
                    )
                );


            if (!userSnapshot.exists()) {

                alert(
                    "Vendor profile not found."
                );

                await signOut(auth);

                window.location.href =
                    "index.html";

                return;
            }


            const profile =
                userSnapshot.val();


            if (profile.role !== "vendor") {

                alert(
                    "Vendor access only."
                );

                await signOut(auth);

                window.location.href =
                    "index.html";

                return;
            }


            currentUser = {
                uid: user.uid,
                ...profile
            };


            if (userName) {

                userName.textContent =
                    profile.name ||
                    profile.fullName ||
                    user.email ||
                    "Vendor";
            }


            await loadDashboard();

        } catch (error) {

            console.error(
                "Vendor authentication error:",
                error
            );

            alert(
                "Unable to load vendor profile: " +
                error.message
            );
        }
    }
);


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    if (!currentUser) {
        return;
    }


    try {

        createHistorySections();

        await loadSellers();

        await loadBuyers();

        await loadCollectionHistory();

        await loadSupplyHistory();

        await updateSummary();
        await loadOverallAnalytics();

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );
    }
}


/* =========================================================
   GET USERS
========================================================= */

async function getUsers() {

    const snapshot =
        await get(
            ref(
                database,
                "users"
            )
        );


    if (!snapshot.exists()) {
        return [];
    }


    const users = [];


    snapshot.forEach(child => {

        users.push({
            uid: child.key,
            ...child.val()
        });
    });


    return users;
}


/* =========================================================
   SELLER ACTIVITY
========================================================= */

async function loadSellers() {

    if (!sellerContainer) {
        return;
    }


    sellerContainer.innerHTML =
        `
        <div class="milkiba-activity-empty">
            Loading sellers...
        </div>
        `;


    const users =
        await getUsers();


    const sellers =
        users.filter(
            user =>
                String(user.role)
                    .toLowerCase() ===
                "seller"
        );


    /* -----------------------------------------------------
       READ COLLECTIONS
    ----------------------------------------------------- */

    const collectionSnapshot =
        await get(
            ref(
                database,
                "milkCollections"
            )
        );


    const processedSellerIds =
        new Set();


    if (collectionSnapshot.exists()) {

        collectionSnapshot.forEach(
            child => {

                const record =
                    child.val();


                if (
                    record.vendorId ===
                        currentUser.uid &&

                    record.date ===
                        getDate() &&

                    record.session ===
                        currentSession &&

                    transactionIsActive(
                        record
                    ) &&

                    record.sellerId
                ) {

                    processedSellerIds.add(
                        record.sellerId
                    );
                }
            }
        );
    }


    /* -----------------------------------------------------
       ONLY SHOW SELLERS NOT YET PROCESSED
    ----------------------------------------------------- */

    const activeSellers =
        sellers.filter(
            seller =>
                !processedSellerIds.has(
                    seller.uid
                )
        );


    if (activeSellers.length === 0) {

        sellerContainer.innerHTML =
            `
            <div class="milkiba-activity-empty">
                All sellers have been processed
                for this date and session.
            </div>
            `;

        return;
    }


    /* -----------------------------------------------------
       SELLER NOTIFICATIONS
    ----------------------------------------------------- */

    const notificationSnapshot =
        await get(
            ref(
                database,
                "sellerNotifications"
            )
        );


    sellerNotificationsCache =
        notificationSnapshot.exists()
            ? notificationSnapshot.val()
            : {};


    const notifications =
        sellerNotificationsCache;


    sellerContainer.innerHTML =
        activeSellers
            .map(seller => {

                const notification =
                    getNotification(
                        notifications,
                        seller.uid,
                        getDate(),
                        currentSession
                    );


                const notified =
                    !!notification;


                const estimatedQuantity =
                    notification
                        ? number(
                            notification
                                .estimatedQuantity
                        )
                        : 0;


                return `
                    <div
                        class="seller-card"
                        style="
                            background:#fff;
                            border-radius:12px;
                            padding:16px;
                            margin-bottom:12px;
                            box-shadow:0 3px 10px rgba(0,0,0,.08);
                        "
                    >

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                                gap:10px;
                                flex-wrap:wrap;
                            "
                        >

                            <div>

                                <div
                                    style="
                                        font-size:16px;
                                        font-weight:700;
                                    "
                                >
                                    ${escapeHtml(
                                        seller.name ||
                                        seller.fullName ||
                                        "Seller"
                                    )}
                                </div>

                                <div
                                    style="
                                        font-size:13px;
                                        color:#777;
                                        margin-top:4px;
                                    "
                                >
                                    ${escapeHtml(
                                        seller.email ||
                                        ""
                                    )}
                                </div>

                                ${
                                    notified
                                        ? `
                                            <div
                                                style="
                                                    margin-top:7px;
                                                    color:#15803d;
                                                    font-size:12px;
                                                    font-weight:600;
                                                "
                                            >
                                                Seller requested
                                                milk collection
                                                ${
                                                    estimatedQuantity > 0
                                                        ? `• ${money(estimatedQuantity)} L`
                                                        : ""
                                                }
                                            </div>
                                          `
                                        : `
                                            <div
                                                style="
                                                    margin-top:7px;
                                                    color:#777;
                                                    font-size:12px;
                                                "
                                            >
                                                No milk request
                                                notification
                                                for this session
                                            </div>
                                          `
                                }

                            </div>


                            <button
                                type="button"
                                onclick='openCollectionModal(${JSON.stringify({
                                    uid: seller.uid,
                                    name:
                                        seller.name ||
                                        seller.fullName ||
                                        "Seller"
                                })})'
                                style="
                                    border:none;
                                    background:#16a34a;
                                    color:#fff;
                                    padding:9px 14px;
                                    border-radius:8px;
                                    cursor:pointer;
                                    font-weight:600;
                                "
                            >
                                Record Collection
                            </button>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   BUYER ACTIVITY
========================================================= */

async function loadBuyers() {

    if (!buyerContainer) {
        return;
    }


    buyerContainer.innerHTML =
        `
        <div class="milkiba-activity-empty">
            Loading buyers...
        </div>
        `;


    const users =
        await getUsers();


    const buyers =
        users.filter(
            user =>
                String(user.role)
                    .toLowerCase() ===
                "buyer"
        );


    /* -----------------------------------------------------
       READ SUPPLIES
    ----------------------------------------------------- */

    const supplySnapshot =
        await get(
            ref(
                database,
                "milkSupplies"
            )
        );


    const processedBuyerIds =
        new Set();


    if (supplySnapshot.exists()) {

        supplySnapshot.forEach(
            child => {

                const record =
                    child.val();


                if (
                    record.vendorId ===
                        currentUser.uid &&

                    record.date ===
                        getDate() &&

                    record.session ===
                        currentSession &&

                    transactionIsActive(
                        record
                    ) &&

                    record.buyerId
                ) {

                    processedBuyerIds.add(
                        record.buyerId
                    );
                }
            }
        );
    }


    /* -----------------------------------------------------
       ONLY SHOW BUYERS NOT YET PROCESSED
    ----------------------------------------------------- */

    const activeBuyers =
        buyers.filter(
            buyer =>
                !processedBuyerIds.has(
                    buyer.uid
                )
        );


    if (activeBuyers.length === 0) {

        buyerContainer.innerHTML =
            `
            <div class="milkiba-activity-empty">
                All buyers have been processed
                for this date and session.
            </div>
            `;

        return;
    }


    /* -----------------------------------------------------
       BUYER NOTIFICATIONS
    ----------------------------------------------------- */

    const notificationSnapshot =
        await get(
            ref(
                database,
                "buyerNotifications"
            )
        );


    buyerNotificationsCache =
        notificationSnapshot.exists()
            ? notificationSnapshot.val()
            : {};


    const notifications =
        buyerNotificationsCache;


    buyerContainer.innerHTML =
        activeBuyers
            .map(buyer => {

                const notification =
                    getNotification(
                        notifications,
                        buyer.uid,
                        getDate(),
                        currentSession
                    );


                const notified =
                    !!notification;


                const requestedQuantity =
                    notification
                        ? number(
                            notification
                                .requestedQuantity
                        )
                        : 0;


                return `
                    <div
                        class="buyer-card"
                        style="
                            background:#fff;
                            border-radius:12px;
                            padding:16px;
                            margin-bottom:12px;
                            box-shadow:0 3px 10px rgba(0,0,0,.08);
                        "
                    >

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                                gap:10px;
                                flex-wrap:wrap;
                            "
                        >

                            <div>

                                <div
                                    style="
                                        font-size:16px;
                                        font-weight:700;
                                    "
                                >
                                    ${escapeHtml(
                                        buyer.name ||
                                        buyer.fullName ||
                                        "Buyer"
                                    )}
                                </div>

                                <div
                                    style="
                                        font-size:13px;
                                        color:#777;
                                        margin-top:4px;
                                    "
                                >
                                    ${escapeHtml(
                                        buyer.email ||
                                        ""
                                    )}
                                </div>

                                ${
                                    notified
                                        ? `
                                            <div
                                                style="
                                                    margin-top:7px;
                                                    color:#2563eb;
                                                    font-size:12px;
                                                    font-weight:600;
                                                "
                                            >
                                                Buyer requested
                                                milk supply
                                                ${
                                                    requestedQuantity > 0
                                                        ? `• ${money(requestedQuantity)} L`
                                                        : ""
                                                }
                                            </div>
                                          `
                                        : `
                                            <div
                                                style="
                                                    margin-top:7px;
                                                    color:#777;
                                                    font-size:12px;
                                                "
                                            >
                                                No milk request
                                                notification
                                                for this session
                                            </div>
                                          `
                                }

                            </div>


                            <button
                                type="button"
                                onclick='openSupplyModal(${JSON.stringify({
                                    uid: buyer.uid,
                                    name:
                                        buyer.name ||
                                        buyer.fullName ||
                                        "Buyer"
                                })})'
                                style="
                                    border:none;
                                    background:#2563eb;
                                    color:#fff;
                                    padding:9px 14px;
                                    border-radius:8px;
                                    cursor:pointer;
                                    font-weight:600;
                                "
                            >
                                Record Supply
                            </button>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   COLLECTION MODAL
========================================================= */

window.openCollectionModal =
    function(seller) {

        selectedSeller =
            seller;


        if (!collectionModal) {
            return;
        }


        collectionModal.classList.remove(
            "hidden"
        );


        const sellerNameInput =
            document.getElementById(
                "collectionSellerName"
            );


        if (sellerNameInput) {

            sellerNameInput.value =
                seller.name || "";
        }


        const sellerIdInput =
            document.getElementById(
                "collectionSellerId"
            );


        if (sellerIdInput) {

            sellerIdInput.value =
                seller.uid || "";
        }


        /* -------------------------------------------------
           AUTO-FILL SELLER ESTIMATED QUANTITY
        ------------------------------------------------- */

        const estimatedQuantityInput =
            document.getElementById(
                "estimatedQuantity"
            );


        const estimatedQuantity =
            getSellerEstimatedQuantity(
                seller.uid
            );


        if (estimatedQuantityInput) {

            estimatedQuantityInput.value =
                estimatedQuantity > 0
                    ? estimatedQuantity
                    : "";
        }


        /* -------------------------------------------------
           AUTO-FILL PAYMENT DATE
        ------------------------------------------------- */

        const paymentDateInput =
            document.getElementById(
                "collectionPaymentDate"
            );


        if (paymentDateInput) {

            paymentDateInput.value =
                getDate();
        }


        /* -------------------------------------------------
           CLEAR FIELDS THAT SHOULD BE NEW
        ------------------------------------------------- */

        const actualQuantity =
            document.getElementById(
                "actualQuantity"
            );

        const quality =
            document.getElementById(
                "quality"
            );

        const qualityNote =
            document.getElementById(
                "qualityNote"
            );

        const rate =
            document.getElementById(
                "collectionRate"
            );

        const paymentAmount =
            document.getElementById(
                "collectionPaymentAmount"
            );

        const paymentMethod =
            document.getElementById(
                "collectionPaymentMethod"
            );

        const paymentNote =
            document.getElementById(
                "collectionPaymentNote"
            );


        if (actualQuantity) {
            actualQuantity.value = "";
        }

        if (quality) {
            quality.value = "";
        }

        if (qualityNote) {
            qualityNote.value = "";
        }

        if (rate) {
            rate.value = "";
        }

        if (paymentAmount) {
            paymentAmount.value = "0";
        }

        if (paymentMethod) {
            paymentMethod.value = "";
        }

        if (paymentNote) {
            paymentNote.value = "";
        }


        updateCollectionCalculation();
    };


/* =========================================================
   SUPPLY MODAL
========================================================= */

window.openSupplyModal =
    function(buyer) {

        selectedBuyer =
            buyer;


        if (!supplyModal) {
            return;
        }


        supplyModal.classList.remove(
            "hidden"
        );


        const buyerNameInput =
            document.getElementById(
                "supplyBuyerName"
            );


        if (buyerNameInput) {

            buyerNameInput.value =
                buyer.name || "";
        }


        const buyerIdInput =
            document.getElementById(
                "supplyBuyerId"
            );


        if (buyerIdInput) {

            buyerIdInput.value =
                buyer.uid || "";
        }


        /* -------------------------------------------------
           AUTO-FILL BUYER REQUESTED QUANTITY
        ------------------------------------------------- */

        const requestedQuantityInput =
            document.getElementById(
                "requestedQuantity"
            );


        const requestedQuantity =
            getBuyerRequestedQuantity(
                buyer.uid
            );


        if (requestedQuantityInput) {

            requestedQuantityInput.value =
                requestedQuantity > 0
                    ? requestedQuantity
                    : "";
        }


        /* -------------------------------------------------
           AUTO-FILL PAYMENT DATE
        ------------------------------------------------- */

        const paymentDateInput =
            document.getElementById(
                "supplyPaymentDate"
            );


        if (paymentDateInput) {

            paymentDateInput.value =
                getDate();
        }


        /* -------------------------------------------------
           CLEAR NEW FIELDS
        ------------------------------------------------- */

        const suppliedQuantity =
            document.getElementById(
                "suppliedQuantity"
            );

        const rate =
            document.getElementById(
                "supplyRate"
            );

        const paymentAmount =
            document.getElementById(
                "supplyPaymentAmount"
            );

        const paymentMethod =
            document.getElementById(
                "supplyPaymentMethod"
            );

        const paymentNote =
            document.getElementById(
                "supplyPaymentNote"
            );


        if (suppliedQuantity) {
            suppliedQuantity.value = "";
        }

        if (rate) {
            rate.value = "";
        }

        if (paymentAmount) {
            paymentAmount.value = "0";
        }

        if (paymentMethod) {
            paymentMethod.value = "";
        }

        if (paymentNote) {
            paymentNote.value = "";
        }


        updateSupplyCalculation();
    };


/* =========================================================
   CLOSE MODALS
========================================================= */

document
    .querySelectorAll("[data-close-modal]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const modalId =
                    button.dataset.closeModal;


                const modal =
                    document.getElementById(
                        modalId
                    );


                if (modal) {

                    modal.classList.add(
                        "hidden"
                    );
                }


                selectedSeller = null;
                selectedBuyer = null;
            }
        );
    });


/* =========================================================
   SAVE COLLECTION
========================================================= */

const collectionForm =
    document.getElementById(
        "collectionForm"
    );


if (collectionForm) {

    collectionForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (
                !currentUser ||
                !selectedSeller
            ) {
                return;
            }


            try {

                const estimatedQuantity =
                    number(
                        document.getElementById(
                            "estimatedQuantity"
                        )?.value
                    );


                const actualQuantity =
                    number(
                        document.getElementById(
                            "actualQuantity"
                        )?.value
                    );


                const quality =
                    document.getElementById(
                        "quality"
                    )?.value || "";


                const qualityNote =
                    document.getElementById(
                        "qualityNote"
                    )?.value || "";


                const rate =
                    number(
                        document.getElementById(
                            "collectionRate"
                        )?.value
                    );


                const paymentAmount =
                    number(
                        document.getElementById(
                            "collectionPaymentAmount"
                        )?.value
                    );


                const paymentMethod =
                    document.getElementById(
                        "collectionPaymentMethod"
                    )?.value || "";


                const paymentDate =
                    document.getElementById(
                        "collectionPaymentDate"
                    )?.value || "";


                const paymentNote =
                    document.getElementById(
                        "collectionPaymentNote"
                    )?.value || "";


                /* -----------------------------------------
                   CALCULATION
                ----------------------------------------- */

                const totalAmount =
                    actualQuantity * rate;


                const pending =
                    pendingAmount(
                        totalAmount,
                        paymentAmount
                    );


                const status =
                    paymentStatus(
                        totalAmount,
                        paymentAmount
                    );


                /* -----------------------------------------
                   VALIDATION
                ----------------------------------------- */

                if (actualQuantity <= 0) {

                    alert(
                        "Please enter the actual milk quantity."
                    );

                    return;
                }


                if (rate <= 0) {

                    alert(
                        "Please enter the milk rate."
                    );

                    return;
                }


                if (paymentAmount > totalAmount) {

                    alert(
                        "Payment amount cannot be greater than total amount."
                    );

                    return;
                }


                /* -----------------------------------------
                   CREATE TRANSACTION
                ----------------------------------------- */

                const collectionRef =
                    push(
                        ref(
                            database,
                            "milkCollections"
                        )
                    );


                await set(
                    collectionRef,
                    {

                        sellerId:
                            selectedSeller.uid,

                        sellerName:
                            selectedSeller.name,

                        vendorId:
                            currentUser.uid,

                        date:
                            getDate(),

                        session:
                            currentSession,

                        estimatedQuantity,

                        actualQuantity,

                        quality,

                        qualityNote,

                        rate,

                        totalAmount,

                        paymentAmount,

                        pendingAmount:
                            pending,

                        paymentStatus:
                            status,

                        paymentMethod,

                        paymentDate,

                        paymentNote,

                        recordStatus:
                            "Active",

                        transactionStatus:
                            "Collected",

                        createdAt:
                            new Date()
                                .toISOString(),

                        updatedAt:
                            new Date()
                                .toISOString()
                    }
                );


                if (collectionModal) {

                    collectionModal.classList.add(
                        "hidden"
                    );
                }


                selectedSeller =
                    null;


                alert(
                    "Milk collection recorded successfully."
                );


                await loadDashboard();


            } catch (error) {

                console.error(
                    "Collection save error:",
                    error
                );


                alert(
                    "Failed to save collection: " +
                    error.message
                );
            }
        }
    );
}


/* =========================================================
   SAVE SUPPLY
========================================================= */

const supplyForm =
    document.getElementById(
        "supplyForm"
    );


if (supplyForm) {

    supplyForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (
                !currentUser ||
                !selectedBuyer
            ) {
                return;
            }


            try {

                const requestedQuantity =
                    number(
                        document.getElementById(
                            "requestedQuantity"
                        )?.value
                    );


                const suppliedQuantity =
                    number(
                        document.getElementById(
                            "suppliedQuantity"
                        )?.value
                    );


                const rate =
                    number(
                        document.getElementById(
                            "supplyRate"
                        )?.value
                    );


                const paymentAmount =
                    number(
                        document.getElementById(
                            "supplyPaymentAmount"
                        )?.value
                    );


                const paymentMethod =
                    document.getElementById(
                        "supplyPaymentMethod"
                    )?.value || "";


                const paymentDate =
                    document.getElementById(
                        "supplyPaymentDate"
                    )?.value || "";


                const paymentNote =
                    document.getElementById(
                        "supplyPaymentNote"
                    )?.value || "";


                /* -----------------------------------------
                   CALCULATION
                ----------------------------------------- */

                const totalAmount =
                    suppliedQuantity * rate;


                const pending =
                    pendingAmount(
                        totalAmount,
                        paymentAmount
                    );


                const status =
                    paymentStatus(
                        totalAmount,
                        paymentAmount
                    );


                /* -----------------------------------------
                   VALIDATION
                ----------------------------------------- */

                if (suppliedQuantity <= 0) {

                    alert(
                        "Please enter the supplied milk quantity."
                    );

                    return;
                }


                if (rate <= 0) {

                    alert(
                        "Please enter the milk rate."
                    );

                    return;
                }


                if (paymentAmount > totalAmount) {

                    alert(
                        "Payment amount cannot be greater than total amount."
                    );

                    return;
                }


                /* -----------------------------------------
                   CREATE TRANSACTION
                ----------------------------------------- */

                const supplyRef =
                    push(
                        ref(
                            database,
                            "milkSupplies"
                        )
                    );


                await set(
                    supplyRef,
                    {

                        buyerId:
                            selectedBuyer.uid,

                        buyerName:
                            selectedBuyer.name,

                        vendorId:
                            currentUser.uid,

                        date:
                            getDate(),

                        session:
                            currentSession,

                        requestedQuantity,

                        suppliedQuantity,

                        rate,

                        totalAmount,

                        paymentAmount,

                        pendingAmount:
                            pending,

                        paymentStatus:
                            status,

                        paymentMethod,

                        paymentDate,

                        paymentNote,

                        recordStatus:
                            "Active",

                        transactionStatus:
                            "Supplied",

                        createdAt:
                            new Date()
                                .toISOString(),

                        updatedAt:
                            new Date()
                                .toISOString()
                    }
                );


                if (supplyModal) {

                    supplyModal.classList.add(
                        "hidden"
                    );
                }


                selectedBuyer =
                    null;


                alert(
                    "Milk supply recorded successfully."
                );


                await loadDashboard();


            } catch (error) {

                console.error(
                    "Supply save error:",
                    error
                );


                alert(
                    "Failed to save supply: " +
                    error.message
                );
            }
        }
    );
}


/* =========================================================
   COLLECTION HISTORY
========================================================= */

async function loadCollectionHistory() {

    const container =
        getCollectionHistoryContainer();


    if (!container) {
        return;
    }


    const dateLabel =
        document.getElementById(
            "collectionHistoryDate"
        );


    if (dateLabel) {

        dateLabel.textContent =
            `${getDate()} • ${
                currentSession
                    .charAt(0)
                    .toUpperCase() +
                currentSession.slice(1)
            }`;
    }


    const snapshot =
        await get(
            ref(
                database,
                "milkCollections"
            )
        );


    const records = [];


    if (snapshot.exists()) {

        snapshot.forEach(
            child => {

                const record =
                    child.val();


                if (
                    record.vendorId ===
                        currentUser.uid &&

                    record.date ===
                        getDate() &&

                    record.session ===
                        currentSession
                ) {

                    records.push({
                        id: child.key,
                        ...record
                    });
                }
            }
        );
    }


    records.sort(
        (a, b) =>
            String(
                b.createdAt || ""
            ).localeCompare(
                String(
                    a.createdAt || ""
                )
            )
    );


    if (records.length === 0) {

        container.innerHTML =
            `
            <div class="milkiba-empty-history">
                No collection records for this date
                and session.
            </div>
            `;

        return;
    }


    container.innerHTML = `
        <table class="milkiba-history-table">

            <thead>

                <tr>

                    <th>Seller</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Pending</th>
                    <th>Transaction</th>
                    <th>Payment</th>
                    <th>Actions</th>

                </tr>

            </thead>

            <tbody>

                ${
                    records.map(
                        record => {

                            const deleted =
                                record.recordStatus ===
                                "Deleted";


                            const transactionStatus =
                                deleted
                                    ? "Deleted"
                                    : "Collected";


                            const transactionClass =
                                deleted
                                    ? "milkiba-status-deleted"
                                    : "milkiba-status-collected";


                            const payment =
                                record.paymentStatus ||
                                paymentStatus(
                                    record.totalAmount,
                                    record.paymentAmount
                                );


                            let paymentClass =
                                "milkiba-status-notpaid";


                            if (
                                payment ===
                                "Paid"
                            ) {

                                paymentClass =
                                    "milkiba-status-paid";
                            }


                            if (
                                payment ===
                                "Partial"
                            ) {

                                paymentClass =
                                    "milkiba-status-partial";
                            }


                            return `
                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHtml(
                                                record.sellerName ||
                                                "Seller"
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${money(
                                            record.actualQuantity
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.rate
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.totalAmount
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.paymentAmount
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.pendingAmount
                                        )}
                                    </td>

                                    <td>
                                        <span
                                            class="milkiba-status ${transactionClass}"
                                        >
                                            ${transactionStatus}
                                        </span>
                                    </td>

                                    <td>
                                        <span
                                            class="milkiba-status ${paymentClass}"
                                        >
                                            ${escapeHtml(
                                                payment
                                            )}
                                        </span>
                                    </td>

                                    <td>

                                        ${
                                            !deleted
                                                ? `
                                                    <button
                                                        class="milkiba-action-btn milkiba-edit-btn"
                                                        onclick="openEditRequest('${record.id}', 'collection')"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        class="milkiba-action-btn milkiba-delete-btn"
                                                        onclick="openDeleteRequest('${record.id}', 'collection')"
                                                    >
                                                        Delete
                                                    </button>

                                                    <button
                                                        class="milkiba-action-btn milkiba-pdf-btn"
                                                        onclick="generateCollectionPDF('${record.id}')"
                                                    >
                                                        PDF
                                                    </button>
                                                  `
                                                : `
                                                    <span
                                                        style="
                                                            color:#777;
                                                            font-size:12px;
                                                        "
                                                    >
                                                        Deleted
                                                    </span>
                                                  `
                                        }

                                    </td>

                                </tr>
                            `;

                        }
                    ).join("")
                }

            </tbody>

        </table>
    `;
}


/* =========================================================
   SUPPLY HISTORY
========================================================= */

async function loadSupplyHistory() {

    const container =
        getSupplyHistoryContainer();


    if (!container) {
        return;
    }


    const dateLabel =
        document.getElementById(
            "supplyHistoryDate"
        );


    if (dateLabel) {

        dateLabel.textContent =
            `${getDate()} • ${
                currentSession
                    .charAt(0)
                    .toUpperCase() +
                currentSession.slice(1)
            }`;
    }


    const snapshot =
        await get(
            ref(
                database,
                "milkSupplies"
            )
        );


    const records = [];


    if (snapshot.exists()) {

        snapshot.forEach(
            child => {

                const record =
                    child.val();


                if (
                    record.vendorId ===
                        currentUser.uid &&

                    record.date ===
                        getDate() &&

                    record.session ===
                        currentSession
                ) {

                    records.push({
                        id: child.key,
                        ...record
                    });
                }
            }
        );
    }


    records.sort(
        (a, b) =>
            String(
                b.createdAt || ""
            ).localeCompare(
                String(
                    a.createdAt || ""
                )
            )
    );


    if (records.length === 0) {

        container.innerHTML =
            `
            <div class="milkiba-empty-history">
                No supply records for this date
                and session.
            </div>
            `;

        return;
    }


    container.innerHTML = `
        <table class="milkiba-history-table">

            <thead>

                <tr>

                    <th>Buyer</th>
                    <th>Requested</th>
                    <th>Supplied</th>
                    <th>Rate</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Pending</th>
                    <th>Transaction</th>
                    <th>Payment</th>
                    <th>Actions</th>

                </tr>

            </thead>

            <tbody>

                ${
                    records.map(
                        record => {

                            const deleted =
                                record.recordStatus ===
                                "Deleted";


                            const transactionStatus =
                                deleted
                                    ? "Deleted"
                                    : "Supplied";


                            const transactionClass =
                                deleted
                                    ? "milkiba-status-deleted"
                                    : "milkiba-status-supplied";


                            const payment =
                                record.paymentStatus ||
                                paymentStatus(
                                    record.totalAmount,
                                    record.paymentAmount
                                );


                            let paymentClass =
                                "milkiba-status-notpaid";


                            if (
                                payment ===
                                "Paid"
                            ) {

                                paymentClass =
                                    "milkiba-status-paid";
                            }


                            if (
                                payment ===
                                "Partial"
                            ) {

                                paymentClass =
                                    "milkiba-status-partial";
                            }


                            return `
                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHtml(
                                                record.buyerName ||
                                                "Buyer"
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${money(
                                            record.requestedQuantity
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            record.suppliedQuantity
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.rate
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.totalAmount
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.paymentAmount
                                        )}
                                    </td>

                                    <td>
                                        ₹${money(
                                            record.pendingAmount
                                        )}
                                    </td>

                                    <td>
                                        <span
                                            class="milkiba-status ${transactionClass}"
                                        >
                                            ${transactionStatus}
                                        </span>
                                    </td>

                                    <td>
                                        <span
                                            class="milkiba-status ${paymentClass}"
                                        >
                                            ${escapeHtml(
                                                payment
                                            )}
                                        </span>
                                    </td>

                                    <td>

                                        ${
                                            !deleted
                                                ? `
                                                    <button
                                                        class="milkiba-action-btn milkiba-edit-btn"
                                                        onclick="openEditRequest('${record.id}', 'supply')"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        class="milkiba-action-btn milkiba-delete-btn"
                                                        onclick="openDeleteRequest('${record.id}', 'supply')"
                                                    >
                                                        Delete
                                                    </button>

                                                    <button
                                                        class="milkiba-action-btn milkiba-pdf-btn"
                                                        onclick="generateSupplyPDF('${record.id}')"
                                                    >
                                                        PDF
                                                    </button>
                                                  `
                                                : `
                                                    <span
                                                        style="
                                                            color:#777;
                                                            font-size:12px;
                                                        "
                                                    >
                                                        Deleted
                                                    </span>
                                                  `
                                        }

                                    </td>

                                </tr>
                            `;

                        }
                    ).join("")
                }

            </tbody>

        </table>
    `;
}


/* =========================================================
   EDIT REQUEST
========================================================= */

window.openEditRequest =
    async function(
        transactionId,
        transactionType
    ) {

        try {

            const path =
                transactionType ===
                "collection"
                    ? `milkCollections/${transactionId}`
                    : `milkSupplies/${transactionId}`;


            const snapshot =
                await get(
                    ref(
                        database,
                        path
                    )
                );


            if (!snapshot.exists()) {

                alert(
                    "Transaction not found."
                );

                return;
            }


            const record =
                snapshot.val();


            const quantityInput =
                document.getElementById(
                    "editQuantity"
                );


            const rateInput =
                document.getElementById(
                    "editRate"
                );


            const paidInput =
                document.getElementById(
                    "editPaymentAmount"
                );


            if (quantityInput) {

                quantityInput.value =
                    transactionType ===
                    "collection"
                        ? number(
                            record.actualQuantity
                        )
                        : number(
                            record.suppliedQuantity
                        );
            }


            if (rateInput) {

                rateInput.value =
                    number(
                        record.rate
                    );
            }


            if (paidInput) {

                paidInput.value =
                    number(
                        record.paymentAmount
                    );
            }


            window.currentEditRequest = {
                transactionId,
                transactionType,
                record
            };


            if (editRequestModal) {

                editRequestModal.classList.remove(
                    "hidden"
                );
            }


            updateEditCalculation();


        } catch (error) {

            console.error(
                "Edit request error:",
                error
            );

            alert(
                error.message
            );
        }
    };


/* =========================================================
   SUBMIT EDIT REQUEST
========================================================= */

const editRequestForm =
    document.getElementById(
        "editRequestForm"
    );


if (editRequestForm) {

    editRequestForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const request =
                window.currentEditRequest;


            if (!request) {
                return;
            }


            try {

                const newQuantity =
                    number(
                        document.getElementById(
                            "editQuantity"
                        )?.value
                    );


                const newRate =
                    number(
                        document.getElementById(
                            "editRate"
                        )?.value
                    );


                const newPayment =
                    number(
                        document.getElementById(
                            "editPaymentAmount"
                        )?.value
                    );


                const reason =
                    document.getElementById(
                        "editReason"
                    )?.value || "";


                const oldRecord =
                    request.record;


                const totalAmount =
                    newQuantity *
                    newRate;


                const pending =
                    pendingAmount(
                        totalAmount,
                        newPayment
                    );


                if (newQuantity <= 0) {

                    alert(
                        "Quantity must be greater than zero."
                    );

                    return;
                }


                if (newRate <= 0) {

                    alert(
                        "Rate must be greater than zero."
                    );

                    return;
                }


                if (
                    newPayment >
                    totalAmount
                ) {

                    alert(
                        "Payment amount cannot be greater than total amount."
                    );

                    return;
                }


                const requestRef =
                    push(
                        ref(
                            database,
                            "changeRequests"
                        )
                    );


                await set(
                    requestRef,
                    {

                        type:
                            "edit",

                        transactionType:
                            request.transactionType,

                        transactionId:
                            request.transactionId,

                        vendorId:
                            currentUser.uid,

                        targetUserId:
                            request.transactionType ===
                            "collection"
                                ? oldRecord.sellerId
                                : oldRecord.buyerId,

                        oldData:
                            oldRecord,

                        newData: {

                            quantity:
                                newQuantity,

                            rate:
                                newRate,

                            paymentAmount:
                                newPayment,

                            totalAmount,

                            pendingAmount:
                                pending,

                            paymentStatus:
                                paymentStatus(
                                    totalAmount,
                                    newPayment
                                )
                        },

                        reason,

                        status:
                            "Pending",

                        createdAt:
                            new Date()
                                .toISOString()
                    }
                );


                if (editRequestModal) {

                    editRequestModal.classList.add(
                        "hidden"
                    );
                }


                window.currentEditRequest =
                    null;


                alert(
                    "Edit request submitted for approval."
                );


            } catch (error) {

                console.error(
                    "Edit request error:",
                    error
                );

                alert(
                    error.message
                );
            }
        }
    );
}


/* =========================================================
   DELETE REQUEST
========================================================= */

window.openDeleteRequest =
    async function(
        transactionId,
        transactionType
    ) {

        try {

            const path =
                transactionType ===
                "collection"
                    ? `milkCollections/${transactionId}`
                    : `milkSupplies/${transactionId}`;


            const snapshot =
                await get(
                    ref(
                        database,
                        path
                    )
                );


            if (!snapshot.exists()) {

                alert(
                    "Transaction not found."
                );

                return;
            }


            window.currentDeleteRequest = {

                transactionId,

                transactionType,

                record:
                    snapshot.val()
            };


            if (deleteRequestModal) {

                deleteRequestModal.classList.remove(
                    "hidden"
                );
            }


        } catch (error) {

            console.error(
                "Delete request error:",
                error
            );

            alert(
                error.message
            );
        }
    };


/* =========================================================
   SUBMIT DELETE REQUEST
========================================================= */

const deleteRequestForm =
    document.getElementById(
        "deleteRequestForm"
    );


if (deleteRequestForm) {

    deleteRequestForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const request =
                window.currentDeleteRequest;


            if (!request) {
                return;
            }


            try {

                const reason =
                    document.getElementById(
                        "deleteReason"
                    )?.value || "";


                const requestRef =
                    push(
                        ref(
                            database,
                            "changeRequests"
                        )
                    );


                await set(
                    requestRef,
                    {

                        type:
                            "delete",

                        transactionType:
                            request.transactionType,

                        transactionId:
                            request.transactionId,

                        vendorId:
                            currentUser.uid,

                        targetUserId:
                            request.transactionType ===
                            "collection"
                                ? request.record.sellerId
                                : request.record.buyerId,

                        oldData:
                            request.record,

                        reason,

                        status:
                            "Pending",

                        createdAt:
                            new Date()
                                .toISOString()
                    }
                );


                if (deleteRequestModal) {

                    deleteRequestModal.classList.add(
                        "hidden"
                    );
                }


                window.currentDeleteRequest =
                    null;


                alert(
                    "Delete request submitted for approval."
                );


            } catch (error) {

                console.error(
                    "Delete request error:",
                    error
                );

                alert(
                    error.message
                );
            }
        }
    );
}


/* =========================================================
   SUMMARY
========================================================= */

async function updateSummary() {

    const collectionSnapshot =
        await get(
            ref(
                database,
                "milkCollections"
            )
        );


    const supplySnapshot =
        await get(
            ref(
                database,
                "milkSupplies"
            )
        );


    let collected = 0;
    let supplied = 0;

    let purchaseCost = 0;
    let salesRevenue = 0;

    let pendingPurchase = 0;
    let pendingSales = 0;

    let transactionCount = 0;


    if (collectionSnapshot.exists()) {

        collectionSnapshot.forEach(
            child => {

                const record =
                    child.val();


                if (
                    record.vendorId ===
                        currentUser.uid &&

                    record.date ===
                        getDate() &&

                    record.session ===
                        currentSession &&

                    transactionIsActive(
                        record
                    )
                ) {

                    collected +=
                        number(
                            record.actualQuantity
                        );


                    purchaseCost +=
                        number(
                            record.totalAmount
                        );


                    pendingPurchase +=
                        number(
                            record.pendingAmount
                        );


                    transactionCount++;
                }
            }
        );
    }


    if (supplySnapshot.exists()) {

        supplySnapshot.forEach(
            child => {

                const record =
                    child.val();


                if (
                    record.vendorId ===
                        currentUser.uid &&

                    record.date ===
                        getDate() &&

                    record.session ===
                        currentSession &&

                    transactionIsActive(
                        record
                    )
                ) {

                    supplied +=
                        number(
                            record.suppliedQuantity
                        );


                    salesRevenue +=
                        number(
                            record.totalAmount
                        );


                    pendingSales +=
                        number(
                            record.pendingAmount
                        );


                    transactionCount++;
                }
            }
        );
    }


    const remainingTotal =
        collected -
        supplied;


    const grossMargin =
        salesRevenue -
        purchaseCost;


    const elements = {

        collected:
            document.getElementById(
                "totalCollected"
            ),

        supplied:
            document.getElementById(
                "totalSupplied"
            ),

        purchase:
            document.getElementById(
                "purchaseCost"
            ),

        sales:
            document.getElementById(
                "salesRevenue"
            ),

        pendingPurchase:
            document.getElementById(
                "pendingPurchase"
            ),

        pendingSales:
            document.getElementById(
                "pendingSales"
            ),

        remaining:
            document.getElementById(
                "remainingMilk"
            ),

        margin:
            document.getElementById(
                "grossMargin"
            ),

        transactions:
            document.getElementById(
                "transactionCount"
            )
    };


    if (elements.collected) {

        elements.collected.textContent =
            money(collected);
    }


    if (elements.supplied) {

        elements.supplied.textContent =
            money(supplied);
    }


    if (elements.purchase) {

        elements.purchase.textContent =
            `₹${money(purchaseCost)}`;
    }


    if (elements.sales) {

        elements.sales.textContent =
            `₹${money(salesRevenue)}`;
    }


    if (elements.pendingPurchase) {

        elements.pendingPurchase.textContent =
            `₹${money(pendingPurchase)}`;
    }


    if (elements.pendingSales) {

        elements.pendingSales.textContent =
            `₹${money(pendingSales)}`;
    }


    if (elements.remaining) {

        elements.remaining.textContent =
            money(remainingTotal);
    }


    if (elements.margin) {

        elements.margin.textContent =
            `₹${money(grossMargin)}`;
    }


    if (elements.transactions) {

        elements.transactions.textContent =
            transactionCount;
    }
}


/* =========================================================
   COLLECTION PDF
========================================================= */

window.generateCollectionPDF =
    async function(transactionId) {

        try {

            if (!window.jspdf) {

                alert(
                    "PDF library is not loaded."
                );

                return;
            }


            const snapshot =
                await get(
                    ref(
                        database,
                        `milkCollections/${transactionId}`
                    )
                );


            if (!snapshot.exists()) {

                alert(
                    "Collection not found."
                );

                return;
            }


            const record =
                snapshot.val();


            const {
                jsPDF
            } = window.jspdf;


            const doc =
                new jsPDF();


            doc.setFontSize(18);


            doc.text(
                "MILKIBA - Milk Collection Slip",
                20,
                20
            );


            doc.setFontSize(11);


            doc.text(
                `Seller: ${
                    record.sellerName || ""
                }`,
                20,
                40
            );


            doc.text(
                `Date: ${
                    record.date || ""
                }`,
                20,
                48
            );


            doc.text(
                `Session: ${
                    record.session || ""
                }`,
                20,
                56
            );


            doc.text(
                `Quantity: ${
                    money(
                        record.actualQuantity
                    )
                }`,
                20,
                64
            );


            doc.text(
                `Rate: ₹${
                    money(
                        record.rate
                    )
                }`,
                20,
                72
            );


            doc.text(
                `Total: ₹${
                    money(
                        record.totalAmount
                    )
                }`,
                20,
                80
            );


            doc.text(
                `Paid: ₹${
                    money(
                        record.paymentAmount
                    )
                }`,
                20,
                88
            );


            doc.text(
                `Pending: ₹${
                    money(
                        record.pendingAmount
                    )
                }`,
                20,
                96
            );


            doc.text(
                `Status: ${
                    record.recordStatus ===
                    "Deleted"
                        ? "Deleted"
                        : "Collected"
                }`,
                20,
                104
            );


            doc.save(
                `${safeFileName(
                    record.sellerName
                )}_collection.pdf`
            );


        } catch (error) {

            console.error(
                "Collection PDF error:",
                error
            );

            alert(
                error.message
            );
        }
    };


/* =========================================================
   SUPPLY PDF
========================================================= */

window.generateSupplyPDF =
    async function(transactionId) {

        try {

            if (!window.jspdf) {

                alert(
                    "PDF library is not loaded."
                );

                return;
            }


            const snapshot =
                await get(
                    ref(
                        database,
                        `milkSupplies/${transactionId}`
                    )
                );


            if (!snapshot.exists()) {

                alert(
                    "Supply not found."
                );

                return;
            }


            const record =
                snapshot.val();


            const {
                jsPDF
            } = window.jspdf;


            const doc =
                new jsPDF();


            doc.setFontSize(18);


            doc.text(
                "MILKIBA - Milk Supply Slip",
                20,
                20
            );


            doc.setFontSize(11);


            doc.text(
                `Buyer: ${
                    record.buyerName || ""
                }`,
                20,
                40
            );


            doc.text(
                `Date: ${
                    record.date || ""
                }`,
                20,
                48
            );


            doc.text(
                `Session: ${
                    record.session || ""
                }`,
                20,
                56
            );


            doc.text(
                `Requested: ${
                    money(
                        record.requestedQuantity
                    )
                }`,
                20,
                64
            );


            doc.text(
                `Supplied: ${
                    money(
                        record.suppliedQuantity
                    )
                }`,
                20,
                72
            );


            doc.text(
                `Rate: ₹${
                    money(
                        record.rate
                    )
                }`,
                20,
                80
            );


            doc.text(
                `Total: ₹${
                    money(
                        record.totalAmount
                    )
                }`,
                20,
                88
            );


            doc.text(
                `Paid: ₹${
                    money(
                        record.paymentAmount
                    )
                }`,
                20,
                96
            );


            doc.text(
                `Pending: ₹${
                    money(
                        record.pendingAmount
                    )
                }`,
                20,
                104
            );


            doc.text(
                `Status: ${
                    record.recordStatus ===
                    "Deleted"
                        ? "Deleted"
                        : "Supplied"
                }`,
                20,
                112
            );


            doc.save(
                `${safeFileName(
                    record.buyerName
                )}_supply.pdf`
            );


        } catch (error) {

            console.error(
                "Supply PDF error:",
                error
            );

            alert(
                error.message
            );
        }
    };


/* =========================================================
   LOGOUT
========================================================= */

const logoutButton =
    document.getElementById(
        "logoutBtn"
    ) ||
    document.getElementById(
        "logoutButton"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                await signOut(
                    auth
                );


                window.location.href =
                    "index.html";


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                alert(
                    error.message
                );
            }
        }
    );
}

/* =========================================================
   OVERALL ANALYTICS & MULTI-PERIOD REPORT MODULE
   Track Day, Weekly, Monthly, Yearly Reports & PDF Export
========================================================= */

let currentAnalyticsPeriod = 'day';
let allVendorCollectionsCache = [];
let allVendorSuppliesCache = [];

let filteredPeriodCollections = [];
let filteredPeriodSupplies = [];

function initAnalyticsControls() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStr = todayStr.slice(0, 7);
    const yearStr = String(today.getFullYear());

    const dayInput = document.getElementById('reportDayInput');
    const weekInput = document.getElementById('reportWeekInput');
    const monthInput = document.getElementById('reportMonthInput');
    const yearInput = document.getElementById('reportYearInput');

    if (dayInput) dayInput.value = todayStr;
    if (weekInput) weekInput.value = todayStr;
    if (monthInput) monthInput.value = monthStr;

    if (yearInput && yearInput.options.length === 0) {
        const curYear = today.getFullYear();
        for (let y = curYear + 1; y >= curYear - 4; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === curYear) opt.selected = true;
            yearInput.appendChild(opt);
        }
    }

    // Period selector buttons
    document.querySelectorAll('.analytics-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.analytics-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAnalyticsPeriod = btn.dataset.period;
            updateFilterInputsVisibility();
            applyAnalyticsFilterAndRender();
        });
    });

    // Date change listeners
    if (dayInput) dayInput.addEventListener('change', () => applyAnalyticsFilterAndRender());
    if (weekInput) weekInput.addEventListener('change', () => applyAnalyticsFilterAndRender());
    if (monthInput) monthInput.addEventListener('change', () => applyAnalyticsFilterAndRender());
    if (yearInput) yearInput.addEventListener('change', () => applyAnalyticsFilterAndRender());

    // Tab buttons inside the analytics detail section
    document.querySelectorAll('.analytics-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            document.querySelectorAll('.analytics-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.analytics-tab-panel').forEach(p => p.classList.remove('active'));

            tabBtn.classList.add('active');
            const targetTab = tabBtn.dataset.tab;
            if (targetTab === 'breakdown') {
                const el = document.getElementById('analyticsTabBreakdown');
                if (el) el.classList.add('active');
            } else if (targetTab === 'collections') {
                const el = document.getElementById('analyticsTabCollections');
                if (el) el.classList.add('active');
            } else if (targetTab === 'supplies') {
                const el = document.getElementById('analyticsTabSupplies');
                if (el) el.classList.add('active');
            }
        });
    });

    // PDF Download buttons
    const fullPdfBtn = document.getElementById('downloadFullReportPdfBtn');
    if (fullPdfBtn) fullPdfBtn.addEventListener('click', () => exportComprehensiveReportPDF());

    const collectionsPdfBtn = document.getElementById('downloadCollectionsPdfBtn');
    if (collectionsPdfBtn) collectionsPdfBtn.addEventListener('click', () => exportCollectionsReportPDF());

    const suppliesPdfBtn = document.getElementById('downloadSuppliesPdfBtn');
    if (suppliesPdfBtn) suppliesPdfBtn.addEventListener('click', () => exportSuppliesReportPDF());
}

function updateFilterInputsVisibility() {
    const dayCont = document.getElementById('filterDayContainer');
    const weekCont = document.getElementById('filterWeekContainer');
    const monthCont = document.getElementById('filterMonthContainer');
    const yearCont = document.getElementById('filterYearContainer');

    if (dayCont) dayCont.classList.toggle('hidden', currentAnalyticsPeriod !== 'day');
    if (weekCont) weekCont.classList.toggle('hidden', currentAnalyticsPeriod !== 'week');
    if (monthCont) monthCont.classList.toggle('hidden', currentAnalyticsPeriod !== 'month');
    if (yearCont) yearCont.classList.toggle('hidden', currentAnalyticsPeriod !== 'year');
}

function getWeekRange(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

    const monday = new Date(date);
    monday.setDate(date.getDate() + distanceToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const format = (dt) => {
        const yr = dt.getFullYear();
        const mo = String(dt.getMonth() + 1).padStart(2, '0');
        const dy = String(dt.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${dy}`;
    };

    const startStr = format(monday);
    const endStr = format(sunday);

    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    const label = `${monday.toLocaleDateString('en-IN', options)} - ${sunday.toLocaleDateString('en-IN', options)}`;

    return { start: startStr, end: endStr, label };
}

async function loadOverallAnalytics() {
    if (!currentUser) return;

    try {
        initAnalyticsControls();

        // 1. Fetch all collections for current vendor
        const colSnap = await get(ref(database, 'milkCollections'));
        allVendorCollectionsCache = [];
        if (colSnap.exists()) {
            colSnap.forEach(child => {
                const rec = child.val();
                if (rec.vendorId === currentUser.uid && rec.recordStatus !== 'Deleted') {
                    allVendorCollectionsCache.push({ id: child.key, ...rec });
                }
            });
        }

        // 2. Fetch all supplies for current vendor
        const supSnap = await get(ref(database, 'milkSupplies'));
        allVendorSuppliesCache = [];
        if (supSnap.exists()) {
            supSnap.forEach(child => {
                const rec = child.val();
                if (rec.vendorId === currentUser.uid && rec.recordStatus !== 'Deleted') {
                    allVendorSuppliesCache.push({ id: child.key, ...rec });
                }
            });
        }

        applyAnalyticsFilterAndRender();
    } catch (err) {
        console.error('Error loading overall analytics:', err);
    }
}

function applyAnalyticsFilterAndRender() {
    const dayInput = document.getElementById('reportDayInput');
    const weekInput = document.getElementById('reportWeekInput');
    const monthInput = document.getElementById('reportMonthInput');
    const yearInput = document.getElementById('reportYearInput');

    const selectedDay = dayInput ? dayInput.value : '';
    const selectedWeekBase = weekInput ? weekInput.value : '';
    const selectedMonth = monthInput ? monthInput.value : '';
    const selectedYear = yearInput ? yearInput.value : '';

    let periodLabelText = '';

    filteredPeriodCollections = [];
    filteredPeriodSupplies = [];

    if (currentAnalyticsPeriod === 'day') {
        const targetDate = selectedDay || new Date().toISOString().split('T')[0];
        periodLabelText = `Day Report: ${targetDate}`;
        filteredPeriodCollections = allVendorCollectionsCache.filter(r => r.date === targetDate);
        filteredPeriodSupplies = allVendorSuppliesCache.filter(r => r.date === targetDate);
    } else if (currentAnalyticsPeriod === 'week') {
        const baseDate = selectedWeekBase || new Date().toISOString().split('T')[0];
        const week = getWeekRange(baseDate);
        periodLabelText = `Weekly Report: ${week.label}`;
        filteredPeriodCollections = allVendorCollectionsCache.filter(r => r.date >= week.start && r.date <= week.end);
        filteredPeriodSupplies = allVendorSuppliesCache.filter(r => r.date >= week.start && r.date <= week.end);
    } else if (currentAnalyticsPeriod === 'month') {
        const targetMonth = selectedMonth || new Date().toISOString().slice(0, 7);
        const [yr, mo] = targetMonth.split('-');
        const monthName = new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        periodLabelText = `Monthly Report: ${monthName}`;
        filteredPeriodCollections = allVendorCollectionsCache.filter(r => String(r.date || '').startsWith(targetMonth));
        filteredPeriodSupplies = allVendorSuppliesCache.filter(r => String(r.date || '').startsWith(targetMonth));
    } else if (currentAnalyticsPeriod === 'year') {
        const targetYear = selectedYear || String(new Date().getFullYear());
        periodLabelText = `Yearly Report: ${targetYear}`;
        filteredPeriodCollections = allVendorCollectionsCache.filter(r => String(r.date || '').startsWith(targetYear));
        filteredPeriodSupplies = allVendorSuppliesCache.filter(r => String(r.date || '').startsWith(targetYear));
    } else {
        periodLabelText = 'All-Time Historical Report';
        filteredPeriodCollections = [...allVendorCollectionsCache];
        filteredPeriodSupplies = [...allVendorSuppliesCache];
    }

    // Sort descending by date, then session
    const sortByDate = (a, b) => {
        const cmp = String(b.date || '').localeCompare(String(a.date || ''));
        if (cmp !== 0) return cmp;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    };
    filteredPeriodCollections.sort(sortByDate);
    filteredPeriodSupplies.sort(sortByDate);

    // Update active period badge
    const badgeEl = document.getElementById('activePeriodLabel');
    if (badgeEl) badgeEl.textContent = periodLabelText;

    // Calculate aggregated metrics
    let totalCollectedLiters = 0;
    let totalPurchaseCost = 0;
    let paidToSellers = 0;
    let pendingToSellers = 0;

    filteredPeriodCollections.forEach(r => {
        totalCollectedLiters += Number(r.actualQuantity) || 0;
        totalPurchaseCost += Number(r.totalAmount) || 0;
        paidToSellers += Number(r.paymentAmount) || 0;
        pendingToSellers += Number(r.pendingAmount) || 0;
    });

    let totalSuppliedLiters = 0;
    let totalSupplyRevenue = 0;
    let receivedFromBuyers = 0;
    let pendingFromBuyers = 0;

    filteredPeriodSupplies.forEach(r => {
        totalSuppliedLiters += Number(r.suppliedQuantity) || 0;
        totalSupplyRevenue += Number(r.totalAmount) || 0;
        receivedFromBuyers += Number(r.paymentAmount) || 0;
        pendingFromBuyers += Number(r.pendingAmount) || 0;
    });

    const netStockLiters = totalCollectedLiters - totalSuppliedLiters;
    const grossMargin = totalSupplyRevenue - totalPurchaseCost;
    const marginPercent = totalPurchaseCost > 0 ? ((grossMargin / totalPurchaseCost) * 100).toFixed(1) : 0;

    // Render KPI Metrics
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setTxt('kpiCollectedLiters', `${totalCollectedLiters.toFixed(2)} L`);
    setTxt('kpiCollectedCount', `${filteredPeriodCollections.length} collections`);

    setTxt('kpiSuppliedLiters', `${totalSuppliedLiters.toFixed(2)} L`);
    setTxt('kpiSuppliedCount', `${filteredPeriodSupplies.length} supplies`);

    setTxt('kpiNetStockLiters', `${netStockLiters >= 0 ? '+' : ''}${netStockLiters.toFixed(2)} L`);
    const stockStatusEl = document.getElementById('kpiStockStatus');
    if (stockStatusEl) {
        if (netStockLiters > 0) stockStatusEl.textContent = 'Surplus / In Stock';
        else if (netStockLiters < 0) stockStatusEl.textContent = 'Deficit / Shortage';
        else stockStatusEl.textContent = 'Even Balance';
    }

    setTxt('kpiPurchaseCost', `₹${totalPurchaseCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setTxt('kpiPaidToSellers', `Paid: ₹${paidToSellers.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    setTxt('kpiSalesRevenue', `₹${totalSupplyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setTxt('kpiReceivedFromBuyers', `Collected: ₹${receivedFromBuyers.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    const grossMarginEl = document.getElementById('kpiGrossMargin');
    if (grossMarginEl) {
        grossMarginEl.textContent = `₹${grossMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        grossMarginEl.className = 'kpi-value ' + (grossMargin >= 0 ? 'text-success' : 'text-danger');
    }

    const marginBadgeEl = document.getElementById('kpiMarginBadge');
    if (marginBadgeEl) {
        marginBadgeEl.textContent = `${marginPercent}% Margin`;
        marginBadgeEl.className = 'kpi-badge ' + (grossMargin >= 0 ? 'profit' : 'loss');
    }

    setTxt('kpiPendingPayables', `₹${pendingToSellers.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    setTxt('kpiPendingReceivables', `₹${pendingFromBuyers.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    setTxt('analyticsCollectionsCount', filteredPeriodCollections.length);
    setTxt('analyticsSuppliesCount', filteredPeriodSupplies.length);

    // Render Tables
    renderPeriodBreakdownTable();
    renderDetailedCollectionsTable();
    renderDetailedSuppliesTable();
}

function renderPeriodBreakdownTable() {
    const tbody = document.getElementById('analyticsBreakdownTbody');
    if (!tbody) return;

    // Group collections & supplies by period units
    const groups = {};

    const getKey = (dateStr) => {
        if (!dateStr) return 'Unknown';
        if (currentAnalyticsPeriod === 'year' || currentAnalyticsPeriod === 'all') {
            return dateStr.slice(0, 7); // YYYY-MM
        }
        return dateStr; // YYYY-MM-DD
    };

    filteredPeriodCollections.forEach(r => {
        const k = getKey(r.date);
        if (!groups[k]) groups[k] = { label: k, inLiters: 0, outLiters: 0, cost: 0, rev: 0, pending: 0 };
        groups[k].inLiters += Number(r.actualQuantity) || 0;
        groups[k].cost += Number(r.totalAmount) || 0;
        groups[k].pending += Number(r.pendingAmount) || 0;
    });

    filteredPeriodSupplies.forEach(r => {
        const k = getKey(r.date);
        if (!groups[k]) groups[k] = { label: k, inLiters: 0, outLiters: 0, cost: 0, rev: 0, pending: 0 };
        groups[k].outLiters += Number(r.suppliedQuantity) || 0;
        groups[k].rev += Number(r.totalAmount) || 0;
        groups[k].pending += Number(r.pendingAmount) || 0;
    });

    const keys = Object.keys(groups).sort().reverse();
    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 25px; color: #777;">No transactions recorded for this period.</td></tr>';
        return;
    }

    let rowsHtml = '';
    keys.forEach(k => {
        const g = groups[k];
        const stock = g.inLiters - g.outLiters;
        const profit = g.rev - g.cost;
        rowsHtml += `
            <tr>
                <td><strong>${g.label}</strong></td>
                <td>${g.inLiters.toFixed(2)} L</td>
                <td>${g.outLiters.toFixed(2)} L</td>
                <td><span style="font-weight: 700; color: ${stock >= 0 ? '#16803c' : '#dc2626'}">${stock >= 0 ? '+' : ''}${stock.toFixed(2)} L</span></td>
                <td>₹${g.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>₹${g.rev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td><span style="font-weight: 700; color: ${profit >= 0 ? '#16803c' : '#dc2626'}">₹${profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
                <td>₹${g.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

function renderDetailedCollectionsTable() {
    const tbody = document.getElementById('analyticsCollectionsTbody');
    if (!tbody) return;

    if (filteredPeriodCollections.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 25px; color: #777;">No collections found for this period.</td></tr>';
        return;
    }

    let rowsHtml = '';
    filteredPeriodCollections.forEach(r => {
        const statusClass = r.paymentStatus === 'Paid' ? 'milkiba-status-paid' : (r.paymentStatus === 'Partial' ? 'milkiba-status-partial' : 'milkiba-status-notpaid');
        rowsHtml += `
            <tr>
                <td>${r.date || '-'}</td>
                <td><span class="milkiba-status" style="background: #f1f5f9; color: #334155; text-transform: capitalize;">${r.session || '-'}</span></td>
                <td><strong>${r.sellerName || 'Farmer'}</strong></td>
                <td>${Number(r.actualQuantity || 0).toFixed(2)} L</td>
                <td>${r.quality || '-'}</td>
                <td>₹${Number(r.rate || 0).toFixed(2)}</td>
                <td><strong>₹${Number(r.totalAmount || 0).toFixed(2)}</strong></td>
                <td>₹${Number(r.paymentAmount || 0).toFixed(2)}</td>
                <td><span style="color: ${Number(r.pendingAmount || 0) > 0 ? '#dc2626' : '#16803c'}">₹${Number(r.pendingAmount || 0).toFixed(2)}</span></td>
                <td><span class="milkiba-status ${statusClass}">${r.paymentStatus || 'Not Paid'}</span></td>
                <td>
                    <button type="button" class="milkiba-action-btn milkiba-pdf-btn" onclick="generateCollectionPDF('${r.id}')">Slip</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

function renderDetailedSuppliesTable() {
    const tbody = document.getElementById('analyticsSuppliesTbody');
    if (!tbody) return;

    if (filteredPeriodSupplies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px; color: #777;">No supplies found for this period.</td></tr>';
        return;
    }

    let rowsHtml = '';
    filteredPeriodSupplies.forEach(r => {
        const statusClass = r.paymentStatus === 'Paid' ? 'milkiba-status-paid' : (r.paymentStatus === 'Partial' ? 'milkiba-status-partial' : 'milkiba-status-notpaid');
        rowsHtml += `
            <tr>
                <td>${r.date || '-'}</td>
                <td><span class="milkiba-status" style="background: #f1f5f9; color: #334155; text-transform: capitalize;">${r.session || '-'}</span></td>
                <td><strong>${r.buyerName || 'Buyer'}</strong></td>
                <td>${Number(r.suppliedQuantity || 0).toFixed(2)} L</td>
                <td>₹${Number(r.rate || 0).toFixed(2)}</td>
                <td><strong>₹${Number(r.totalAmount || 0).toFixed(2)}</strong></td>
                <td>₹${Number(r.paymentAmount || 0).toFixed(2)}</td>
                <td><span style="color: ${Number(r.pendingAmount || 0) > 0 ? '#dc2626' : '#16803c'}">₹${Number(r.pendingAmount || 0).toFixed(2)}</span></td>
                <td><span class="milkiba-status ${statusClass}">${r.paymentStatus || 'Not Paid'}</span></td>
                <td>
                    <button type="button" class="milkiba-action-btn milkiba-pdf-btn" onclick="generateSupplyPDF('${r.id}')">Slip</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

/* =========================================================
   COMPREHENSIVE PDF EXPORTS
========================================================= */

function exportComprehensiveReportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF generation library is still loading. Please try again in a few seconds.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const vendorName = (document.getElementById('userName') && document.getElementById('userName').textContent.trim()) || 'Vendor';
    const periodLabel = (document.getElementById('activePeriodLabel') && document.getElementById('activePeriodLabel').textContent.trim()) || 'Report';

    // Top Header Banner
    doc.setFillColor(22, 128, 60); // #16803c
    doc.rect(0, 0, 210, 26, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('MILKIBA - DAIRY DISTRIBUTION MANAGEMENT', 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('COMPREHENSIVE VENDOR AUDIT & FINANCIAL REPORT', 14, 20);

    // Metadata
    doc.setTextColor(33, 37, 41);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Vendor: ${vendorName}`, 14, 34);
    doc.text(`Scope: ${periodLabel}`, 14, 40);

    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 120, 34);
    doc.text(`Status: Verified Digital Record`, 120, 40);

    // KPI Summary Cards in Table format
    let totCol = 0, totCost = 0, pendSeller = 0;
    filteredPeriodCollections.forEach(r => {
        totCol += Number(r.actualQuantity) || 0;
        totCost += Number(r.totalAmount) || 0;
        pendSeller += Number(r.pendingAmount) || 0;
    });

    let totSup = 0, totRev = 0, pendBuyer = 0;
    filteredPeriodSupplies.forEach(r => {
        totSup += Number(r.suppliedQuantity) || 0;
        totRev += Number(r.totalAmount) || 0;
        pendBuyer += Number(r.pendingAmount) || 0;
    });

    const netStock = totCol - totSup;
    const grossProfit = totRev - totCost;

    if (doc.autoTable) {
        doc.autoTable({
            startY: 46,
            theme: 'grid',
            head: [['EXECUTIVE SUMMARY METRIC', 'RECORDED VALUE', 'EXECUTIVE SUMMARY METRIC', 'RECORDED VALUE']],
            body: [
                ['Total Milk Collected', `${totCol.toFixed(2)} Liters`, 'Total Purchase Cost', `Rs. ${totCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
                ['Total Milk Supplied', `${totSup.toFixed(2)} Liters`, 'Total Sales Revenue', `Rs. ${totRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
                ['Net Milk Balance (Stock)', `${netStock >= 0 ? '+' : ''}${netStock.toFixed(2)} Liters`, 'Gross Profit / Margin', `Rs. ${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
                ['Seller Payable Dues', `Rs. ${pendSeller.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Buyer Receivable Dues', `Rs. ${pendBuyer.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]
            ],
            headStyles: { fillColor: [30, 41, 59], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            margin: { left: 14, right: 14 }
        });

        // Collections Table
        const colRows = filteredPeriodCollections.map((r, i) => [
            i + 1,
            r.date || '',
            r.session || '',
            r.sellerName || 'Farmer',
            Number(r.actualQuantity || 0).toFixed(2),
            Number(r.rate || 0).toFixed(2),
            Number(r.totalAmount || 0).toFixed(2),
            Number(r.paymentAmount || 0).toFixed(2),
            Number(r.pendingAmount || 0).toFixed(2),
            r.paymentStatus || 'Not Paid'
        ]);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['#', 'Date', 'Session', 'Seller / Farmer', 'Liters', 'Rate', 'Total (Rs)', 'Paid (Rs)', 'Balance (Rs)', 'Status']],
            body: colRows.length > 0 ? colRows : [['-', '-', '-', 'No collections in this period', '-', '-', '-', '-', '-', '-']],
            foot: colRows.length > 0 ? [['Total', '', '', `${colRows.length} Farmers`, totCol.toFixed(2), '', totCost.toFixed(2), '', pendSeller.toFixed(2), '']] : [],
            headStyles: { fillColor: [22, 128, 60], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [240, 253, 244], textColor: [22, 128, 60], fontStyle: 'bold', fontSize: 8 },
            margin: { left: 14, right: 14 }
        });

        // Supplies Table
        const supRows = filteredPeriodSupplies.map((r, i) => [
            i + 1,
            r.date || '',
            r.session || '',
            r.buyerName || 'Buyer',
            Number(r.suppliedQuantity || 0).toFixed(2),
            Number(r.rate || 0).toFixed(2),
            Number(r.totalAmount || 0).toFixed(2),
            Number(r.paymentAmount || 0).toFixed(2),
            Number(r.pendingAmount || 0).toFixed(2),
            r.paymentStatus || 'Not Paid'
        ]);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['#', 'Date', 'Session', 'Buyer / Consumer', 'Liters', 'Rate', 'Total (Rs)', 'Paid (Rs)', 'Balance (Rs)', 'Status']],
            body: supRows.length > 0 ? supRows : [['-', '-', '-', 'No supplies in this period', '-', '-', '-', '-', '-', '-']],
            foot: supRows.length > 0 ? [['Total', '', '', `${supRows.length} Buyers`, totSup.toFixed(2), '', totRev.toFixed(2), '', pendBuyer.toFixed(2), '']] : [],
            headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [239, 246, 255], textColor: [37, 99, 235], fontStyle: 'bold', fontSize: 8 },
            margin: { left: 14, right: 14 }
        });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`MILKIBA Dairy Platform - Official Statement • Page ${p} of ${pageCount}`, 14, 290);
    }

    doc.save(`MILKIBA_Comprehensive_Report_${currentAnalyticsPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportCollectionsReportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF generation library is still loading. Please try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const vendorName = (document.getElementById('userName') && document.getElementById('userName').textContent.trim()) || 'Vendor';
    const periodLabel = (document.getElementById('activePeriodLabel') && document.getElementById('activePeriodLabel').textContent.trim()) || 'Report';

    doc.setFillColor(22, 128, 60);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('MILKIBA - MILK COLLECTIONS AUDIT REPORT', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vendor: ${vendorName} | Period: ${periodLabel} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, 19);

    let totCol = 0, totCost = 0, pendSeller = 0;
    const colRows = filteredPeriodCollections.map((r, i) => {
        totCol += Number(r.actualQuantity) || 0;
        totCost += Number(r.totalAmount) || 0;
        pendSeller += Number(r.pendingAmount) || 0;
        return [
            i + 1,
            r.date || '',
            r.session || '',
            r.sellerName || 'Farmer',
            Number(r.actualQuantity || 0).toFixed(2),
            Number(r.rate || 0).toFixed(2),
            Number(r.totalAmount || 0).toFixed(2),
            Number(r.paymentAmount || 0).toFixed(2),
            Number(r.pendingAmount || 0).toFixed(2),
            r.paymentStatus || 'Not Paid'
        ];
    });

    if (doc.autoTable) {
        doc.autoTable({
            startY: 32,
            head: [['#', 'Date', 'Session', 'Farmer Name', 'Liters', 'Rate', 'Total (Rs)', 'Paid (Rs)', 'Pending (Rs)', 'Status']],
            body: colRows.length > 0 ? colRows : [['-', '-', '-', 'No collections in this period', '-', '-', '-', '-', '-', '-']],
            foot: colRows.length > 0 ? [['Total', '', '', `${colRows.length} Collections`, totCol.toFixed(2), '', totCost.toFixed(2), '', pendSeller.toFixed(2), '']] : [],
            headStyles: { fillColor: [22, 128, 60], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [240, 253, 244], textColor: [22, 128, 60], fontStyle: 'bold', fontSize: 8 },
            margin: { left: 14, right: 14 }
        });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`MILKIBA Dairy Platform - Collections Statement • Page ${p} of ${pageCount}`, 14, 290);
    }

    doc.save(`MILKIBA_Collections_${currentAnalyticsPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportSuppliesReportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF generation library is still loading. Please try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const vendorName = (document.getElementById('userName') && document.getElementById('userName').textContent.trim()) || 'Vendor';
    const periodLabel = (document.getElementById('activePeriodLabel') && document.getElementById('activePeriodLabel').textContent.trim()) || 'Report';

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('MILKIBA - MILK SUPPLIES AUDIT REPORT', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vendor: ${vendorName} | Period: ${periodLabel} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, 19);

    let totSup = 0, totRev = 0, pendBuyer = 0;
    const supRows = filteredPeriodSupplies.map((r, i) => {
        totSup += Number(r.suppliedQuantity) || 0;
        totRev += Number(r.totalAmount) || 0;
        pendBuyer += Number(r.pendingAmount) || 0;
        return [
            i + 1,
            r.date || '',
            r.session || '',
            r.buyerName || 'Buyer',
            Number(r.suppliedQuantity || 0).toFixed(2),
            Number(r.rate || 0).toFixed(2),
            Number(r.totalAmount || 0).toFixed(2),
            Number(r.paymentAmount || 0).toFixed(2),
            Number(r.pendingAmount || 0).toFixed(2),
            r.paymentStatus || 'Not Paid'
        ];
    });

    if (doc.autoTable) {
        doc.autoTable({
            startY: 32,
            head: [['#', 'Date', 'Session', 'Buyer Name', 'Liters', 'Rate', 'Total (Rs)', 'Paid (Rs)', 'Pending (Rs)', 'Status']],
            body: supRows.length > 0 ? supRows : [['-', '-', '-', 'No supplies in this period', '-', '-', '-', '-', '-', '-']],
            foot: supRows.length > 0 ? [['Total', '', '', `${supRows.length} Supplies`, totSup.toFixed(2), '', totRev.toFixed(2), '', pendBuyer.toFixed(2), '']] : [],
            headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [239, 246, 255], textColor: [37, 99, 235], fontStyle: 'bold', fontSize: 8 },
            margin: { left: 14, right: 14 }
        });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`MILKIBA Dairy Platform - Supplies Statement • Page ${p} of ${pageCount}`, 14, 290);
    }

    doc.save(`MILKIBA_Supplies_${currentAnalyticsPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
}
