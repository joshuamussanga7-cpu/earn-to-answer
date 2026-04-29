import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, increment, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBB_J-33kRosjVKdKa0FDmIWg04pTtU5CY",
  authDomain: "earn-to-answer-b7cd0.firebaseapp.com",
  projectId: "earn-to-answer-b7cd0",
  storageBucket: "earn-to-answer-b7cd0.firebasestorage.app",
  messagingSenderId: "1074144496696",
  appId: "1:1074144496696:web:bb4695d8cf8760de83eacd",
  measurementId: "G-C1YTHKDZL9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const landingPage = document.getElementById('landing-page');
const mainApp = document.getElementById('main-app');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');

const balanceSpan = document.getElementById('balance');
const balanceBigSpan = document.getElementById('balance-big');
const tasksCountSpan = document.getElementById('tasks-count');
const videoProgressText = document.getElementById('video-progress');
const watchVideoBtn = document.getElementById('watch-video-btn');
const walletInput = document.getElementById('wallet-address');
const saveWalletBtn = document.getElementById('save-wallet-btn');
const userEmailSidebar = document.getElementById('user-email-sidebar');
const userAvatar = document.getElementById('user-avatar');

// Referral & Leaderboard Elements
const refCountText = document.getElementById('ref-count');
const refEarningsText = document.getElementById('ref-earnings');
const referralLinkInput = document.getElementById('referral-link');
const leaderboardBody = document.getElementById('leaderboard-body');
const historyBody = document.getElementById('history-body');

// --- Helpers ---
function generateReferralCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// --- Auth Logic ---

registerBtn.addEventListener('click', async () => {
    const fullName = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!fullName || !email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    // Check for referral ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referredByCode = urlParams.get('ref') || null;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const myReferralCode = generateReferralCode();

        let referrerUid = null;
        // If referred by someone (using their unique code), find their UID
        if (referredByCode) {
            const q = query(collection(db, "users"), where("referralCode", "==", referredByCode), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                referrerUid = querySnapshot.docs[0].id;

                // Increment referrer's count
                await updateDoc(doc(db, "users", referrerUid), {
                    referralCount: increment(1)
                });
            }
        }

        await setDoc(doc(db, "users", user.uid), {
            fullName: fullName,
            email: email,
            balance: 0.00,
            walletAddress: "",
            videoTasksCompleted: 0,
            totalTasksDone: 0,
            referralCount: 0,
            referralEarnings: 0,
            referralCode: myReferralCode,
            referredBy: referrerUid,
            createdAt: new Date().toISOString()
        });

        alert("Account created successfully!");
        window.closeAuthModal();
    } catch (error) {
        alert(error.message);
    }
});

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.closeAuthModal();
    } catch (error) {
        alert(error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- UI Sync Logic ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        landingPage.classList.add('screen-hidden');
        mainApp.classList.remove('screen-hidden');

        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();

                // Update UI with User Data
                userEmailSidebar.innerText = data.email;
                userAvatar.innerText = (data.fullName ? data.fullName[0] : data.email[0]).toUpperCase();
                document.getElementById('user-name-display').innerText = data.fullName || 'Earner';

                const bal = (data.balance || 0).toFixed(2);
                balanceSpan.innerText = bal;
                balanceBigSpan.innerText = bal;
                tasksCountSpan.innerText = data.totalTasksDone || 0;
                walletInput.value = data.walletAddress || "";

                const progress = data.videoTasksCompleted || 0;
                videoProgressText.innerText = `Progress: ${progress}/10 Videos`;

                // Update Referral Stats
                if (refCountText) refCountText.innerText = data.referralCount || 0;
                const refCountDash = document.getElementById('ref-count-dash');
                if (refCountDash) refCountDash.innerText = data.referralCount || 0;

                if (refEarningsText) refEarningsText.innerText = (data.referralEarnings || 0).toFixed(2);

                const refLink = `${window.location.origin}/index.html?ref=${data.referralCode || user.uid}`;
                if (referralLinkInput) referralLinkInput.value = refLink;

                // Update Dashboard Referral Link
                const dashRefInput = document.querySelector('.referral-box .copy-link input');
                if (dashRefInput) dashRefInput.value = refLink;
            }
        });

        // Load Leaderboards & History
        loadLeaderboard();
        loadAffiliateLeaderboard();
        loadTransactionHistory(user.uid);
    } else {
        landingPage.classList.remove('screen-hidden');
        mainApp.classList.add('screen-hidden');
    }
});

// --- Wallet Logic ---

saveWalletBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const address = walletInput.value;
    if (user && address) {
        try {
            await updateDoc(doc(db, "users", user.uid), {
                walletAddress: address
            });
            alert("Success! Your payout wallet has been updated.");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
});

// --- Task Logic ---

window.startVideoTask = async () => {
    const user = auth.currentUser;
    if (!user) return;

    watchVideoBtn.disabled = true;
    let secondsLeft = 10;
    const originalText = watchVideoBtn.innerHTML;

    const timer = setInterval(() => {
        secondsLeft--;
        watchVideoBtn.innerText = `Watching... (${secondsLeft}s)`;
        if (secondsLeft <= 0) {
            clearInterval(timer);
            finishVideo();
        }
    }, 1000);

    async function finishVideo() {
        watchVideoBtn.innerHTML = originalText;
        watchVideoBtn.disabled = false;

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            let videoProgress = data.videoTasksCompleted || 0;
            let balance = data.balance || 0;
            let totalTasks = data.totalTasksDone || 0;

            videoProgress += 1;

            if (videoProgress >= 10) {
                const reward = 0.10;
                balance += reward;
                videoProgress = 0;
                totalTasks += 1;

                // Add to history
                await addDoc(collection(db, "users", user.uid, "transactions"), {
                    activity: "Watched 10 Videos",
                    amount: reward,
                    status: "Completed",
                    timestamp: serverTimestamp()
                });

                alert(`Boom! You completed 10 videos and earned $${reward} USDT.`);
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });

                // Referral Commission (10%)
                if (data.referredBy) {
                    const referrerRef = doc(db, "users", data.referredBy);
                    await updateDoc(referrerRef, {
                        balance: increment(reward * 0.1),
                        referralEarnings: increment(reward * 0.1)
                    });
                }
            }

            await updateDoc(userRef, {
                videoTasksCompleted: videoProgress,
                balance: balance,
                totalTasksDone: totalTasks
            });
        }
    }
};

window.startSurveyTask = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const answer = confirm("Complete this quick survey to earn $0.50 USDT?");
    if (answer) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            const reward = 0.50;
            const currentBalance = data.balance || 0;
            const totalTasks = data.totalTasksDone || 0;

            await updateDoc(userRef, {
                balance: currentBalance + reward,
                totalTasksDone: totalTasks + 1
            });

            // Add to history
            await addDoc(collection(db, "users", user.uid, "transactions"), {
                activity: "Daily Survey",
                amount: reward,
                status: "Completed",
                timestamp: serverTimestamp()
            });

            // Referral Commission (10%)
            if (data.referredBy) {
                const referrerRef = doc(db, "users", data.referredBy);
                await updateDoc(referrerRef, {
                    balance: increment(reward * 0.1),
                    referralEarnings: increment(reward * 0.1)
                });
            }

            alert(`Survey Completed! +$${reward} USDT added to your balance.`);
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }
};

// --- New Features Logic ---

// Task Filtering
window.filterTasks = (category, btn) => {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const cards = document.querySelectorAll('.task-card-premium');
    cards.forEach(card => {
        const title = card.querySelector('h3').innerText.toLowerCase();
        if (category === 'all') {
            card.style.display = 'flex';
        } else if (category === 'surveys' && title.includes('survey')) {
            card.style.display = 'flex';
        } else if (category === 'videos' && (title.includes('video') || title.includes('ads'))) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

async function loadLeaderboard() {
    if (!leaderboardBody) return;

    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(5));
    const querySnapshot = await getDocs(q);

    leaderboardBody.innerHTML = "";
    let rank = 1;

    querySnapshot.forEach((userDoc) => {
        const data = userDoc.data();
        const row = document.createElement('tr');
        row.className = "history-row";
        row.innerHTML = `
            <td>#${rank++}</td>
            <td>${data.fullName || 'User'}</td>
            <td>${data.totalTasksDone || 0}</td>
            <td style="font-weight: 800; color: var(--success);">$${(data.balance || 0).toFixed(2)}</td>
        `;
        leaderboardBody.appendChild(row);
    });
}

async function loadAffiliateLeaderboard() {
    const affBody = document.getElementById('affiliate-leaderboard-body');
    if (!affBody) return;

    const q = query(collection(db, "users"), orderBy("referralCount", "desc"), limit(5));
    const querySnapshot = await getDocs(q);

    affBody.innerHTML = "";
    let rank = 1;

    querySnapshot.forEach((userDoc) => {
        const data = userDoc.data();
        const row = document.createElement('tr');
        row.className = "history-row";
        row.innerHTML = `
            <td>#${rank++}</td>
            <td>${data.fullName || 'User'}</td>
            <td>${data.referralCount || 0} Users</td>
            <td style="font-weight: 800; color: var(--primary);">$${(data.referralEarnings || 0).toFixed(2)}</td>
        `;
        affBody.appendChild(row);
    });
}

async function loadTransactionHistory(uid) {
    if (!historyBody) return;

    const q = query(collection(db, "users", uid, "transactions"), orderBy("timestamp", "desc"), limit(20));

    onSnapshot(q, (snapshot) => {
        historyBody.innerHTML = "";
        if (snapshot.empty) {
            historyBody.innerHTML = "<tr><td colspan='4'>No activity yet. Start earning!</td></tr>";
            return;
        }

        snapshot.forEach((txDoc) => {
            const data = txDoc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'Pending...';
            const row = document.createElement('tr');
            row.className = "history-row";
            row.innerHTML = `
                <td>${date}</td>
                <td>${data.activity}</td>
                <td style="color: var(--success); font-weight: 700;">+$${data.amount.toFixed(2)}</td>
                <td><span class="badge" style="background: #eef2ff; color: #4f46e5;">${data.status}</span></td>
            `;
            historyBody.appendChild(row);
        });
    });
}

window.copyReferralLink = () => {
    const link = document.getElementById('referral-link');
    link.select();
    document.execCommand('copy');
    alert("Referral link copied to clipboard!");
};
