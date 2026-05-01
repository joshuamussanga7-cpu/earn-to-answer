import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, increment, addDoc, serverTimestamp, where, arrayUnion, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- Platform Configuration ---
const PLATFORM_CONFIG = {
    rewardShares: {
        videoConstant: 0.10,     // User gets $0.10 per 10 videos (50% of typical $0.20 revenue)
        surveyMargin: 0.45,      // User gets 45% of the survey value
        referralCommission: 0.10 // Referrer gets 10% of friend's earnings
    },
    limits: {
        maxVideosPerDay: 100,    // 10 full rewards per day
        maxSurveysPerDay: 2,     // Internal daily surveys
        maxDailyEarnings: 5.00,  // Safety cap for platform health
        videoCooldownSeconds: 15, // Anti-bot cooldown
        minWithdrawal: 10.00
    },
    withdrawalDay: 0,          // 0 = Sunday
    adProviders: ['propeller', 'adsterra'] // Rotation list
};

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
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
const requestPayoutBtn = document.getElementById('request-payout-btn');

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
if (themeIcon) {
    themeIcon.className = savedTheme === 'dark' ? 'bx bx-sun' : 'bx bx-moon';
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'bx bx-sun' : 'bx bx-moon';
        }
    });
}

// Referral & Leaderboard Elements
const refCountText = document.getElementById('ref-count');
const refEarningsText = document.getElementById('ref-earnings');
const referralLinkInput = document.getElementById('referral-link');
const leaderboardBody = document.getElementById('leaderboard-body');
const historyBody = document.getElementById('history-body');

// --- Helpers ---
async function getUserMetadata() {
    try {
        const response = await fetch('https://ipwho.is/');
        const data = await response.json();
        return {
            ip: data.ip,
            country: data.country,
            isProxy: data.security?.proxy || data.security?.vpn || data.security?.tor || false,
            userAgent: navigator.userAgent,
            lastSeen: serverTimestamp()
        };
    } catch (e) {
        return { ip: "unknown", isProxy: false, userAgent: navigator.userAgent, lastSeen: serverTimestamp() };
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type} animate__animated animate__fadeInRight`;
    toast.innerHTML = `
        <i class='bx ${type === 'success' ? 'bxs-check-circle' : 'bxs-error'}'></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function generateReferralCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function validateTRC20(address) {
    const regex = /^T[a-zA-Z0-9]{33}$/;
    return regex.test(address);
}

// --- Auth Logic ---

registerBtn.addEventListener('click', async () => {
    const fullName = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!fullName || !email || !password) {
        showToast("Please fill in all fields.", "error");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const referredByCode = urlParams.get('ref') || null;

    try {
        registerBtn.classList.add('btn-loading');
        registerBtn.disabled = true;

        const meta = await getUserMetadata();
        if (meta.isProxy) {
            showToast("VPN/Proxy detected. Please disable it to continue.", "error");
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const myReferralCode = generateReferralCode();

        let referrerUid = null;
        if (referredByCode) {
            const q = query(collection(db, "users"), where("referralCode", "==", referredByCode), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                referrerUid = querySnapshot.docs[0].id;
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
            completedSocialTasks: [],
            lastCheckIn: null,
            lastWheelSpin: null,
            checkInStreak: 0,
            createdAt: new Date().toISOString(),
            metadata: meta,
            role: "user"
        });

        showToast("Account created successfully!");
        window.closeAuthModal();
    } catch (error) {
        console.error("Registration Error:", error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
        showToast(msg, 'error');
    } finally {
        registerBtn.classList.remove('btn-loading');
        registerBtn.disabled = false;
    }
});

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showToast("Please enter email and password.", "error");
        return;
    }

    loginBtn.classList.add('btn-loading');
    loginBtn.disabled = true;

    try {
        const meta = await getUserMetadata();
        if (meta.isProxy) {
            showToast("VPN/Proxy detected. Please disable it to continue.", "error");
            return;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if banned
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().isBanned) {
            await signOut(auth);
            showToast("Your account has been suspended for violating terms.", "error");
            return;
        }

        await updateDoc(doc(db, "users", user.uid), {
            "metadata.ip": meta.ip,
            "metadata.lastSeen": meta.lastSeen,
            "metadata.userAgent": meta.userAgent,
            "metadata.isProxy": meta.isProxy
        });

        showToast("Welcome back!");
        window.closeAuthModal();
    } catch (error) {
        console.error("Login Error:", error);
        showToast("Invalid email or password.", 'error');
    } finally {
        loginBtn.classList.remove('btn-loading');
        loginBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- Wallet Logic ---

saveWalletBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const address = walletInput.value.trim();
    if (!user) return;
    if (!address) { showToast("Please enter a wallet address.", "error"); return; }
    if (!validateTRC20(address)) { showToast("Invalid USDT TRC-20 address format (must start with 'T').", "error"); return; }

    saveWalletBtn.classList.add('btn-loading');
    saveWalletBtn.disabled = true;
    try {
        await updateDoc(doc(db, "users", user.uid), {
            walletAddress: address
        });
        showToast("Wallet address updated!");
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        saveWalletBtn.classList.remove('btn-loading');
        saveWalletBtn.disabled = false;
    }
});

// --- Task Logic ---

window.startVideoTask = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (watchVideoBtn.disabled) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const today = new Date().toDateString();

    // 1. Check Daily Earnings Cap
    const dailyEarnings = data.lastRewardDate === today ? (data.dailyEarningsCount || 0) : 0;
    if (dailyEarnings >= PLATFORM_CONFIG.limits.maxDailyEarnings) {
        showToast("Daily earnings limit reached ($5.00). Keep it up tomorrow!", "warning");
        return;
    }

    // 2. Check Daily Video Count
    const dailyCount = data.lastVideoDate === today ? (data.dailyVideoCount || 0) : 0;
    if (dailyCount >= PLATFORM_CONFIG.limits.maxVideosPerDay) {
        showToast("Daily video limit reached. Partners need a break!", "error");
        return;
    }

    // 3. Check Cooldown
    const lastAction = data.lastVideoTimestamp ? data.lastVideoTimestamp.toDate() : 0;
    const secondsSince = (Date.now() - lastAction) / 1000;
    if (secondsSince < PLATFORM_CONFIG.limits.videoCooldownSeconds) {
        showToast(`Cooling down... Wait ${Math.ceil(PLATFORM_CONFIG.limits.videoCooldownSeconds - secondsSince)}s`, "info");
        return;
    }

    watchVideoBtn.disabled = true;
    const originalText = watchVideoBtn.innerHTML;
    watchVideoBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Initializing Ad...";

    const startTime = Date.now();

    window.showAdNetworkInterstitial(async () => {
        const timeTaken = (Date.now() - startTime) / 1000;
        if (timeTaken < 3) {
            showToast("Fraud detected: Ad interaction too fast.", "error");
            watchVideoBtn.innerHTML = originalText;
            watchVideoBtn.disabled = false;
            return;
        }

        watchVideoBtn.innerHTML = originalText;
        watchVideoBtn.disabled = false;

        let currentProgress = (data.videoTasksCompleted || 0) + 1;
        let newDailyCount = dailyCount + 1;

        const updates = {
            dailyVideoCount: newDailyCount,
            lastVideoDate: today,
            lastVideoTimestamp: serverTimestamp()
        };

        if (currentProgress >= 10) {
            const reward = PLATFORM_CONFIG.rewardShares.videoConstant;
            updates.balance = increment(reward);
            updates.dailyEarningsCount = increment(reward);
            updates.lastRewardDate = today;
            updates.totalTasksDone = increment(1);
            updates.videoTasksCompleted = 0;

            await updateDoc(userRef, updates);

            await addDoc(collection(db, "users", user.uid, "transactions"), {
                activity: "Watched 10 Videos",
                amount: reward,
                status: "Completed",
                timestamp: serverTimestamp()
            });

            showToast(`+$${reward} USDT earned!`);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

            if (data.referredBy) {
                const referrerRef = doc(db, "users", data.referredBy);
                const commission = reward * PLATFORM_CONFIG.rewardShares.referralCommission;
                await updateDoc(referrerRef, {
                    balance: increment(commission),
                    referralEarnings: increment(commission)
                });
            }
        } else {
            updates.videoTasksCompleted = increment(1);
            await updateDoc(userRef, updates);
            showToast(`Progress: ${currentProgress}/10 videos`, "info");
        }
    });
};

window.startSurveyTask = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const data = userSnap.data();

    const today = new Date().toDateString();
    const surveyCount = data.lastSurveyDate === today ? (data.dailySurveyCount || 0) : 0;

    if (surveyCount >= PLATFORM_CONFIG.limits.maxSurveysPerDay) {
        showToast(`You've reached the limit of ${PLATFORM_CONFIG.limits.maxSurveysPerDay} surveys today!`, "error");
        return;
    }

    document.getElementById('survey-modal').classList.remove('screen-hidden');
};

window.completeSurvey = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const modal = document.getElementById('survey-modal');
    const btn = modal.querySelector('.btn-primary.btn-block');

    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            const today = new Date().toDateString();

            const baseValue = 1.00;
            const reward = baseValue * PLATFORM_CONFIG.rewardShares.surveyMargin;

            await updateDoc(userRef, {
                balance: increment(reward),
                dailyEarningsCount: increment(reward),
                lastRewardDate: today,
                totalTasksDone: increment(1),
                dailySurveyCount: increment(1),
                lastSurveyDate: today
            });

            await addDoc(collection(db, "users", user.uid, "transactions"), {
                activity: "Daily Survey",
                amount: reward,
                status: "Completed",
                timestamp: serverTimestamp()
            });

            if (data.referredBy) {
                const referrerRef = doc(db, "users", data.referredBy);
                const commission = reward * PLATFORM_CONFIG.rewardShares.referralCommission;
                await updateDoc(referrerRef, {
                    balance: increment(commission),
                    referralEarnings: increment(commission)
                });
            }

            showToast(`+$${reward.toFixed(2)} USDT earned!`);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            modal.classList.add('screen-hidden');
        }
    } catch (error) {
        showToast("Error saving survey", "error");
    } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
};

window.verifySocialTask = async (platform, url, reward) => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.completedSocialTasks && data.completedSocialTasks.includes(platform)) {
            showToast("Task already completed!", "error");
            return;
        }
    }

    window.open(url, '_blank');
    showToast(`Verifying ${platform} follow...`, "info");

    setTimeout(async () => {
        try {
            await updateDoc(userRef, {
                balance: increment(reward),
                totalTasksDone: increment(1),
                completedSocialTasks: arrayUnion(platform)
            });

            await addDoc(collection(db, "users", user.uid, "transactions"), {
                activity: `Followed ${platform}`,
                amount: reward,
                status: "Completed",
                timestamp: serverTimestamp()
            });

            showToast(`+$${reward} USDT earned!`);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } catch (error) {
            showToast("Verification failed.", "error");
        }
    }, 5000);
};

// --- Task Filtering ---
window.filterTasks = (category, btn) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cards = document.querySelectorAll('.task-card-premium');
    cards.forEach(card => {
        const title = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = (category === 'all' ||
            (category === 'surveys' && title.includes('survey')) ||
            (category === 'videos' && (title.includes('video') || title.includes('ads')))) ? 'flex' : 'none';
    });
};

// --- Leaderboards ---
function loadLeaderboard() {
    if (!leaderboardBody) return;
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        leaderboardBody.innerHTML = "";
        let rank = 1;
        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            leaderboardBody.innerHTML += `
                <tr class="history-row animate__animated animate__fadeIn">
                    <td>#${rank++}</td>
                    <td>${data.fullName || 'User'}</td>
                    <td>${data.totalTasksDone || 0}</td>
                    <td style="font-weight: 800; color: var(--success);">$${(data.balance || 0).toFixed(2)}</td>
                </tr>`;
        });
    });
}

function loadAffiliateLeaderboard() {
    const affBody = document.getElementById('affiliate-leaderboard-body');
    if (!affBody) return;
    const q = query(collection(db, "users"), orderBy("referralCount", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        affBody.innerHTML = "";
        let rank = 1;
        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            affBody.innerHTML += `
                <tr class="history-row animate__animated animate__fadeIn">
                    <td>#${rank++}</td>
                    <td>${data.fullName || 'User'}</td>
                    <td>${data.referralCount || 0}</td>
                    <td style="font-weight: 800; color: var(--primary);">$${(data.referralEarnings || 0).toFixed(2)}</td>
                </tr>`;
        });
    });
}

// --- History ---
async function loadTransactionHistory(uid) {
    if (!historyBody) return;
    const q = query(collection(db, "users", uid, "transactions"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (snapshot) => {
        historyBody.innerHTML = snapshot.empty ? "<tr><td colspan='4'>No activity yet.</td></tr>" : "";
        snapshot.forEach((txDoc) => {
            const data = txDoc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'Pending...';
            historyBody.innerHTML += `
                <tr class="history-row">
                    <td>${date}</td>
                    <td>${data.activity}</td>
                    <td style="color: ${data.amount >= 0 ? 'var(--success)' : 'var(--error)'}; font-weight: 700;">${data.amount >= 0 ? '+' : ''}$${data.amount.toFixed(2)}</td>
                    <td><span class="badge" style="background: #eef2ff; color: #4f46e5;">${data.status}</span></td>
                </tr>`;
        });
    });
}

// --- Admin Section ---
async function loadAdminStats() {
    const usersSnap = await getDocs(collection(db, "users"));
    const payoutsSnap = await getDocs(collection(db, "payouts"));

    let totalBalance = 0;
    let totalUsers = usersSnap.size;
    let pendingPayouts = 0;
    let totalPaid = 0;

    usersSnap.forEach(doc => totalBalance += (doc.data().balance || 0));
    payoutsSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === "Pending") pendingPayouts += data.amount;
        if (data.status === "Completed") totalPaid += data.amount;
    });

    const statsGrid = document.getElementById('admin-stats-grid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <p>Total Users</p>
                <h3>${totalUsers}</h3>
            </div>
            <div class="stat-card">
                <p>Platform Liability</p>
                <h3>$${totalBalance.toFixed(2)}</h3>
            </div>
            <div class="stat-card">
                <p>Pending Payouts</p>
                <h3 style="color:var(--warning);">$${pendingPayouts.toFixed(2)}</h3>
            </div>
            <div class="stat-card">
                <p>Total Paid Out</p>
                <h3 style="color:var(--success);">$${totalPaid.toFixed(2)}</h3>
            </div>
        `;
    }
}

let adminUsersListener = null;
let adminPayoutsListener = null;

async function loadAdminUsers(filter = "") {
    const list = document.getElementById('admin-users-list');
    if (!list) return;

    if (adminUsersListener) adminUsersListener(); // Unsubscribe existing

    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(100));

    adminUsersListener = onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            const meta = data.metadata || {};
            const userIP = meta.ip || '0.0.0.0';

            if (filter) {
                const f = filter.toLowerCase();
                const matchesEmail = data.email && data.email.toLowerCase().includes(f);
                const matchesID = userDoc.id.toLowerCase().includes(f);
                const matchesIP = userIP.includes(f);
                if (!matchesEmail && !matchesID && !matchesIP) return;
            }

            const lastSeen = meta.lastSeen ? new Date(meta.lastSeen.seconds * 1000).toLocaleString() : "N/A";

            list.innerHTML += `
                <tr class="animate__animated animate__fadeIn">
                    <td>
                        <div style="font-weight:600;">${data.fullName || 'Unknown'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${userDoc.id}</div>
                    </td>
                    <td><code style="background:rgba(0,0,0,0.05); padding:2px 4px; border-radius:4px;">${meta.ip || '0.0.0.0'}</code></td>
                    <td style="color:var(--success); font-weight:700;">$${(data.balance || 0).toFixed(2)}</td>
                    <td style="font-size:12px;">${lastSeen}</td>
                    <td><span class="status-pill ${data.isBanned ? 'error' : 'active'}">${data.isBanned ? 'Banned' : 'Active'}</span></td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            <button onclick="toggleBanUser('${userDoc.id}', ${data.isBanned || false})" class="btn-text" style="color:${data.isBanned ? 'var(--success)' : 'var(--error)'};">
                                ${data.isBanned ? 'Unban' : 'Ban'}
                            </button>
                            <button onclick="resetUserDailyLimits('${userDoc.id}')" class="btn-text" style="color:var(--primary);">
                                Reset Limits
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    });
}

const searchInput = document.getElementById('admin-user-search');
if (searchInput) {
    searchInput.addEventListener('input', (e) => loadAdminUsers(e.target.value));
}

async function loadAdminPayouts() {
    const list = document.getElementById('admin-payouts-list');
    if (!list) return;

    if (adminPayoutsListener) adminPayoutsListener(); // Unsubscribe existing

    const q = query(collection(db, "payouts"), where("status", "==", "Pending"), orderBy("timestamp", "desc"));

    adminPayoutsListener = onSnapshot(q, (snapshot) => {
        list.innerHTML = snapshot.empty ? "<tr><td colspan='5' style='text-align:center; padding:20px; color:var(--text-muted);'>No pending payouts to review.</td></tr>" : "";
        snapshot.forEach((pDoc) => {
            const data = pDoc.data();
            list.innerHTML += `
                <tr class="animate__animated animate__fadeIn">
                    <td style="font-size:12px;">${data.uid}</td>
                    <td><code>${data.address}</code></td>
                    <td style="font-weight:700;">$${data.amount.toFixed(2)}</td>
                    <td style="font-size:12px;">${new Date(data.timestamp.seconds * 1000).toLocaleDateString()}</td>
                    <td>
                        <button onclick="approvePayout('${pDoc.id}')" class="btn btn-primary btn-sm">Approve</button>
                    </td>
                </tr>`;
        });
    });
}

window.resetUserDailyLimits = async (uid) => {
    if (!confirm("Reset daily limits for this user (Today only)?")) return;
    await updateDoc(doc(db, "users", uid), {
        dailyVideoCount: 0,
        dailySurveyCount: 0,
        dailyEarningsCount: 0,
        lastVideoDate: "",
        lastSurveyDate: "",
        lastRewardDate: ""
    });
    showToast("Daily limits reset.");
};

window.toggleBanUser = async (uid, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'Unban' : 'Ban'} this user?`)) return;
    await updateDoc(doc(db, "users", uid), { isBanned: !currentStatus });
    showToast(`User ${currentStatus ? 'unbanned' : 'banned'} successfully.`);
};

window.approvePayout = async (pid) => {
    if (!confirm("Approve and mark this payout as paid?")) return;

    try {
        const payoutRef = doc(db, "payouts", pid);
        const payoutSnap = await getDoc(payoutRef);
        const payoutData = payoutSnap.data();

        await updateDoc(payoutRef, { status: "Completed", paidAt: serverTimestamp() });
        const userTxRef = doc(db, "users", payoutData.uid, "transactions", pid);
        await updateDoc(userTxRef, { status: "Completed" });

        await addDoc(collection(db, "users", payoutData.uid, "notifications"), {
            title: "💰 Payment Sent!",
            message: `Your withdrawal of $${payoutData.amount.toFixed(2)} USDT has been processed.`,
            timestamp: serverTimestamp(),
            read: false
        });

        showToast("Payout approved.");
    } catch (error) {
        showToast("Error processing payout", "error");
    }
};

// --- Daily Check-in ---
function updateDailyCheckInUI(userData) {
    const grid = document.getElementById('daily-checkin-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const rewards = [0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.25];
    const lastCheckIn = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
    const today = new Date();
    const isCheckedInToday = lastCheckIn && lastCheckIn.toDateString() === today.toDateString();
    const currentDayIndex = (today.getDay() + 6) % 7;

    days.forEach((day, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = `daily-day ${index < currentDayIndex ? 'completed' : ''} ${index === currentDayIndex ? 'today' : ''} ${(index === currentDayIndex && isCheckedInToday) ? 'completed' : ''}`;
        if (index === currentDayIndex && !isCheckedInToday) dayDiv.onclick = () => claimDailyReward(userData, rewards[index]);
        dayDiv.innerHTML = `<h5>${day}</h5><div class="reward">$${rewards[index]}</div>`;
        grid.appendChild(dayDiv);
    });
}

async function claimDailyReward(userData, amount) {
    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
            balance: increment(amount),
            lastCheckIn: new Date().toISOString(),
            checkInStreak: increment(1)
        });
        await addDoc(collection(db, "users", auth.currentUser.uid, "transactions"), {
            activity: "Daily Check-in",
            amount: amount,
            status: "Completed",
            timestamp: serverTimestamp()
        });
        showToast(`+$${amount} Daily Reward!`);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (error) { showToast(error.message, "error"); }
}

// --- Fortune Wheel ---
const wheelSectors = [
    { label: "$0.01", value: 0.01, color: "#f8fafc" },
    { label: "$0.05", value: 0.05, color: "#e2e8f0" },
    { label: "$0.10", value: 0.10, color: "#f8fafc" },
    { label: "TRY AGAIN", value: 0, color: "#cbd5e1" },
    { label: "$0.25", value: 0.25, color: "#f8fafc" },
    { label: "$1.00", value: 1.00, color: "#6366f1" }
];

window.openWheel = () => document.getElementById('wheel-modal').classList.remove('screen-hidden');
window.closeWheel = () => document.getElementById('wheel-modal').classList.add('screen-hidden');

function drawWheel() {
    const canvas = document.getElementById('wheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const arc = Math.PI / (wheelSectors.length / 2);
    wheelSectors.forEach((s, i) => {
        const angle = i * arc;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.moveTo(150, 150); ctx.arc(150, 150, 140, angle, angle + arc); ctx.fill();
        ctx.save(); ctx.translate(150, 150); ctx.rotate(angle + arc / 2);
        ctx.fillStyle = "#1e293b"; ctx.font = "bold 14px sans-serif"; ctx.fillText(s.label, 60, 5);
        ctx.restore();
    });
}
drawWheel();

window.spinWheel = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const data = userSnap.data();

    const lastSpin = data.lastWheelSpin ? new Date(data.lastWheelSpin) : null;
    if (lastSpin && (new Date() - lastSpin < 24 * 60 * 60 * 1000)) {
        showToast("Wait 24 hours between spins!", "error");
        return;
    }

    const btn = document.getElementById('spin-btn');
    btn.disabled = true;
    const rand = Math.floor(Math.random() * wheelSectors.length);
    const deg = 3600 + (rand * (360 / wheelSectors.length));
    document.getElementById('wheel').style.transform = `rotate(${deg}deg)`;

    setTimeout(async () => {
        const prize = wheelSectors[wheelSectors.length - 1 - (rand % wheelSectors.length)];
        const updateData = { lastWheelSpin: new Date().toISOString() };
        if (prize.value > 0) {
            updateData.balance = increment(prize.value);
            await addDoc(collection(db, "users", user.uid, "transactions"), {
                activity: "Fortune Wheel Win",
                amount: prize.value,
                status: "Completed",
                timestamp: serverTimestamp()
            });
            showToast(`You won $${prize.value}!`);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } else {
            showToast("Better luck next time!", "error");
        }
        await updateDoc(userRef, updateData);
        btn.disabled = false;
    }, 4500);
};

// --- Social & UI ---
window.shareReferral = (platform) => {
    const link = document.getElementById('referral-link').value;
    const text = "Join EarnToAnswer and start earning USDT for free! 💸";
    const urls = {
        telegram: `https://t.me/share/url?url=${link}&text=${text}`,
        whatsapp: `https://api.whatsapp.com/send?text=${text} ${link}`,
        twitter: `https://twitter.com/intent/tweet?text=${text}&url=${link}`
    };
    window.open(urls[platform], '_blank');
};

const achievements = [
    { id: 'first_task', title: 'First Steps', desc: 'Complete 1 task', icon: 'bx-check-double', condition: (d) => d.totalTasksDone >= 1 },
    { id: 'earner_1', title: 'Novice Earner', desc: 'Earn your first $1.00', icon: 'bx-coin', condition: (d) => d.balance >= 1 },
    { id: 'referral_1', title: 'Team Player', desc: 'Refer 1 friend', icon: 'bx-user-plus', condition: (d) => d.referralCount >= 1 },
    { id: 'streak_3', title: 'Committed', desc: '3 day check-in streak', icon: 'bx-calendar-star', condition: (d) => d.checkInStreak >= 3 },
    { id: 'whale', title: 'High Roller', desc: 'Earn $10.00 total', icon: 'bx-crown', condition: (d) => d.balance >= 10 }
];

function updateAchievementsUI(userData) {
    const grid = document.getElementById('badge-grid');
    if (!grid) return;
    grid.innerHTML = '';
    achievements.forEach(ach => {
        const unlocked = ach.condition(userData);
        const card = document.createElement('div');
        card.className = `badge-card ${unlocked ? 'unlocked' : ''}`;
        card.innerHTML = `<i class='bx ${ach.icon}'></i><h4>${ach.title}</h4><p>${ach.desc}</p>`;
        grid.appendChild(card);
    });
}

function updateLevelUI(tasksCount) {
    const level = Math.floor(tasksCount / 50) + 1;
    const xp = tasksCount % 50;
    const progress = (xp / 50) * 100;
    if (document.getElementById('user-level')) document.getElementById('user-level').innerText = level;
    if (document.getElementById('level-bar')) document.getElementById('level-bar').style.width = `${progress}%`;
    if (document.getElementById('level-percent')) document.getElementById('level-percent').innerText = `${Math.floor(progress)}%`;
}

// --- Notifications ---
window.clearNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const q = query(collection(db, "users", user.uid, "notifications"));
        const snapshot = await getDocs(q);
        const batch = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(batch);
        showToast("Notifications cleared.");
    } catch (e) {
        showToast("Error clearing notifications", "error");
    }
};

function loadNotifications(uid) {
    const list = document.getElementById('notif-list');
    const dot = document.getElementById('notif-dot');
    if (!list) return;

    const q = query(collection(db, "users", uid, "notifications"), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        list.innerHTML = snapshot.empty ? '<div class="notif-item"><p style="font-size:12px; color:var(--text-muted); padding:20px; text-align:center;">No notifications yet</p></div>' : "";
        let unread = 0;
        snapshot.forEach(nDoc => {
            const data = nDoc.data();
            if (!data.read) unread++;
            list.innerHTML += `
                <div class="notif-item ${data.read ? '' : 'unread'}" onclick="markNotifRead('${nDoc.id}')">
                    <div style="font-weight:700; font-size:13px; margin-bottom:2px;">${data.title}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${data.message}</div>
                </div>`;
        });
        if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
    });
}

window.markNotifRead = async (id) => {
    const user = auth.currentUser;
    if (user) {
        await updateDoc(doc(db, "users", user.uid, "notifications", id), { read: true });
    }
};

const notifBell = document.getElementById('notif-bell');
if (notifBell) {
    notifBell.addEventListener('click', () => {
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.classList.toggle('active');
    });
}

// --- Navigation ---
window.showSection = (sectionId) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('screen-hidden'));
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.remove('screen-hidden');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(sectionId)) link.classList.add('active');
    });

    if (sectionId === 'admin') {
        loadAdminStats();
    }
};

// --- Withdrawals ---
if (requestPayoutBtn) {
    requestPayoutBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        requestPayoutBtn.disabled = true;
        requestPayoutBtn.classList.add('btn-loading');

        try {
            const userRef = doc(db, "users", user.uid);
            const meta = await getUserMetadata();

            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw "User does not exist!";

                const data = userDoc.data();
                const bal = data.balance || 0;

                if (bal < 10) throw "Minimum withdrawal is $10.00 USDT";
                if (!data.walletAddress || !validateTRC20(data.walletAddress)) throw "Invalid or missing TRC-20 wallet address.";
                if (data.isBanned) throw "Account suspended.";

                // Check for existing pending payouts to prevent spam
                const pendingQuery = query(collection(db, "payouts"), where("uid", "==", user.uid), where("status", "==", "Pending"));
                const pendingSnap = await getDocs(pendingQuery);
                if (!pendingSnap.empty) throw "You already have a pending withdrawal request.";

                const payoutRef = doc(collection(db, "payouts"));
                const txRef = doc(collection(db, "users", user.uid, "transactions"), payoutRef.id);

                // Atomic updates
                transaction.update(userRef, { balance: 0 }); // Deduct full balance
                transaction.set(payoutRef, {
                    uid: user.uid,
                    amount: bal,
                    address: data.walletAddress,
                    status: "Pending",
                    timestamp: serverTimestamp(),
                    ip: meta.ip
                });
                transaction.set(txRef, {
                    activity: "Withdrawal Request",
                    amount: -bal,
                    status: "Pending",
                    timestamp: serverTimestamp()
                });
            });

            showToast("Withdrawal request sent! Your balance is now $0.00");
        } catch (error) {
            console.error("Payout Error:", error);
            showToast(typeof error === 'string' ? error : "Transaction failed. Try again.", "error");
        } finally {
            requestPayoutBtn.disabled = false;
            requestPayoutBtn.classList.remove('btn-loading');
        }
    });
}

// --- Analytics Chart ---
let earningsChart;
function initChart(data = [0, 0, 0, 0, 0, 0, 0]) {
    const canvas = document.getElementById('earningsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (earningsChart) earningsChart.destroy();
    earningsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ label: 'Earnings (USDT)', data: data, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

async function updateChartData(uid) {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
    startOfWeek.setHours(0, 0, 0, 0);
    const q = query(collection(db, "users", uid, "transactions"), where("timestamp", ">=", startOfWeek));
    const querySnapshot = await getDocs(q);
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.timestamp && data.amount > 0) {
            const dayIndex = (data.timestamp.toDate().getDay() + 6) % 7;
            weeklyData[dayIndex] += data.amount;
        }
    });
    initChart(weeklyData);
}

// --- Main Auth Observer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        landingPage.classList.add('screen-hidden');
        mainApp.classList.remove('screen-hidden');
        onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                syncUserData(data);
                updateLevelUI(data.totalTasksDone || 0);
                updateAchievementsUI(data);
                updateDailyCheckInUI(data);
            }
        });
        loadLeaderboard();
        loadAffiliateLeaderboard();
        loadTransactionHistory(user.uid);
        loadNotifications(user.uid);
        updateChartData(user.uid);
    } else {
        landingPage.classList.remove('screen-hidden');
        mainApp.classList.add('screen-hidden');
    }
});

window.copyToClipboard = (elementId) => {
    const copyText = document.getElementById(elementId);
    if (!copyText) return;
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    showToast("Copied to clipboard!");
};

function syncUserData(data) {
    const user = auth.currentUser;
    if (user && document.getElementById('profile-id')) {
        document.getElementById('profile-id').value = user.uid;
    }
    userEmailSidebar.innerText = data.email;
    userAvatar.innerText = (data.fullName ? data.fullName[0] : data.email[0]).toUpperCase();
    document.getElementById('user-name-display').innerText = data.fullName || 'Earner';
    const bal = (data.balance || 0).toFixed(2);
    if (balanceSpan) balanceSpan.innerText = bal;
    if (balanceBigSpan) balanceBigSpan.innerText = bal;
    if (tasksCountSpan) tasksCountSpan.innerText = data.totalTasksDone || 0;
    if (walletInput) walletInput.value = data.walletAddress || "";
    if (videoProgressText) videoProgressText.innerText = `Progress: ${data.videoTasksCompleted || 0}/10 Videos`;

    const progressPercent = ((data.videoTasksCompleted || 0) / 10) * 100;
    const progressBar = document.getElementById('video-progress-bar');
    const progressPercentText = document.getElementById('video-progress-percent');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressPercentText) progressPercentText.innerText = `${Math.floor(progressPercent)}%`;

    if (refCountText) refCountText.innerText = data.referralCount || 0;
    if (refEarningsText) refEarningsText.innerText = (data.referralEarnings || 0).toFixed(2);
    const refLink = `${window.location.origin}/index.html?ref=${data.referralCode}`;
    if (referralLinkInput) referralLinkInput.value = refLink;
    if (document.getElementById('referral-link-dash')) document.getElementById('referral-link-dash').value = refLink;

    if (data.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('screen-hidden'));
        if (!adminUsersListener) {
            loadAdminUsers();
            loadAdminPayouts();
            loadAdminStats();
        }
    }
}
