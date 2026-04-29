import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBB_J-33kRosjVKdKa0FDmIWg04pTtU5CY",
  authDomain: "earn-to-answer-b7cd0.firebaseapp.com",
  projectId: "earn-to-answer-b7cd0",
  storageBucket: "earn-to-answer-b7cd0.firebasestorage.app",
  messagingSenderId: "1074144496696",
  appId: "1:1074144496696:web:bb4695d8cf8760de83eacd",
  measurementId: "G-C1YTHKDZL9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userList = document.getElementById('admin-user-list');

async function loadPayoutRequests() {
    userList.innerHTML = "<tr><td colspan='5'>Loading requests...</td></tr>";

    // Fetch users with balance > 0 (or you can filter by >= 10 for actual payouts)
    const q = query(collection(db, "users"), where("balance", ">", 0));
    const querySnapshot = await getDocs(q);

    userList.innerHTML = "";

    querySnapshot.forEach((userDoc) => {
        const data = userDoc.data();
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.fullName || 'N/A'}</td>
            <td>${data.email}</td>
            <td><strong>$${data.balance.toFixed(2)}</strong></td>
            <td><small>${data.walletAddress || 'No Wallet Set'}</small></td>
            <td>
                <button class="pay-btn" onclick="markAsPaid('${userDoc.id}')">Confirm Payout</button>
            </td>
        `;
        userList.appendChild(row);
    });
}

window.markAsPaid = async (userId) => {
    if (confirm("Are you sure you have sent the USDT to this user? This will reset their balance to $0.")) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            balance: 0,
            totalPaidOut: increment(1) // Optional: track payout history
        });
        alert("Payout confirmed!");
        loadPayoutRequests();
    }
};

// Initial Load
loadPayoutRequests();
