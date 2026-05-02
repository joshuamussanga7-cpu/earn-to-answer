import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, increment, addDoc, serverTimestamp, where, arrayUnion, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

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
const messaging = getMessaging(app);

// --- FCM Logic ---
async function requestNotificationPermission(uid) {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: 'BGErNq7H-3v3vW4v4v4v4v4v4v4v4v4v4v4v4v4v4v4' // Replace with your Firebase Project -> Cloud Messaging -> Web Push VAPID Key
            });
            if (token) {
                await updateDoc(doc(db, "users", uid), { fcmToken: token });
                console.log("FCM Token saved");
            }
        }
    } catch (e) {
        console.warn("FCM permission denied or error:", e);
    }
}

onMessage(messaging, (payload) => {
    console.log("Message received:", payload);
    showToast(`${payload.notification.title}: ${payload.notification.body}`, "info");
    if (payload.data && payload.data.type === 'balance_update') {
        // Force refresh balance if needed, though onSnapshot handles it
    }
});

// Add Chart.js import (assuming it's loaded via CDN in HTML, otherwise use local or npm)
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script> in index.html

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
const videoProgressText = document.getElementById('video-progress-text-center');
const watchVideoBtn = document.getElementById('watch-video-btn');
const walletInput = document.getElementById('wallet-address');
const saveWalletBtn = document.getElementById('save-wallet-btn');
const userEmailSidebar = document.getElementById('user-email-sidebar');
const userAvatar = document.getElementById('user-avatar');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
const requestPayoutBtn = document.getElementById('request-payout-btn');
const notifBell = document.getElementById('notif-btn');

const promoInput = document.getElementById('promo-code-input');

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
if (themeIcon) {
    themeIcon.className = savedTheme === 'dark' ? 'bx bx-sun' : 'bx bx-moon';
}

// Initialize security check on load
refreshSecurityCheck();

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

// Mock Ad Network for development (Replace with real Ad Network SDK later)
window.showAdNetworkInterstitial = (callback) => {
    console.log("Ad Network: Initializing...");
    showToast("Loading Sponsored Ad...", "info");
    setTimeout(() => {
        console.log("Ad Network: Ad Finished.");
        callback();
    }, 2000); // 2-second mock ad
};

// --- Helpers ---
let prevValues = {
    balance: 0,
    tasks: 0,
    xpPercent: 0
};

function animateValue(id, start, end, duration, decimals = 0, suffix = "") {
    const obj = document.getElementById(id);
    if (!obj) return;

    // Sanitize inputs to prevent NaN errors
    const startVal = isNaN(parseFloat(start)) ? 0 : parseFloat(start);
    const endVal = isNaN(parseFloat(end)) ? 0 : parseFloat(end);

    // Don't animate if values are the same
    if (startVal === endVal) {
        obj.innerHTML = (decimals === 0 ? Math.floor(endVal) : endVal.toFixed(decimals)) + suffix;
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = progress * (endVal - startVal) + startVal;

        if (decimals === 0) {
            obj.innerHTML = Math.floor(current) + suffix;
        } else {
            obj.innerHTML = current.toFixed(decimals) + suffix;
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = (decimals === 0 ? Math.floor(endVal) : endVal.toFixed(decimals)) + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

async function getUserMetadata() {
    const fetchWithTimeout = async (url, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { signal: controller.signal });
            return await response.json();
        } finally {
            clearTimeout(id);
        }
    };

    try {
        // Primary Check
        const data = await fetchWithTimeout('https://ipwho.is/');
        return {
            ip: data.ip || "Unknown",
            country: data.country || "Unknown",
            isProxy: data.security?.proxy || data.security?.vpn || data.security?.tor || false,
            userAgent: navigator.userAgent,
            lastSeen: serverTimestamp()
        };
    } catch (e) {
        console.warn("Primary VPN check failed or timed out, trying fallback...", e);
        try {
            // Secondary Fallback (using a different provider)
            const data = await fetchWithTimeout('https://ipapi.co/json/');
            return {
                ip: data.ip || "Unknown",
                country: data.country_name || "Unknown",
                isProxy: false, // Fallback service might not provide proxy info in free tier
                userAgent: navigator.userAgent,
                lastSeen: serverTimestamp()
            };
        } catch (e2) {
            console.warn("All VPN checks failed, proceeding with safety defaults:", e2);
            return {
                ip: "N/A (Timeout)",
                country: "Unknown",
                isProxy: false, // Don't block users if services are down
                userAgent: navigator.userAgent,
                lastSeen: serverTimestamp()
            };
        }
    }
}

// Admin Audit Logging
async function addAuditLog(action, details, targetUid = null) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await addDoc(collection(db, "audit_logs"), {
            adminUid: user.uid,
            adminEmail: user.email,
            action,
            details,
            targetUid,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Audit log error:", e);
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

// --- Global Loader Helper ---
function showGlobalLoader(text = "Secure connection...") {
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('loader-text');
    if (loader) {
        if (loaderText) loaderText.innerText = text;
        loader.classList.remove('screen-hidden');
        loader.style.display = 'flex';
    }
}

function hideGlobalLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('screen-hidden');
        loader.style.display = 'none';
    }
}

// --- Auth Logic ---

// Generate a simple math challenge for registration
let currentSecurityAnswer = 0;
window.refreshSecurityCheck = function() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    currentSecurityAnswer = a + b;
    const label = document.getElementById('human-check-label');
    if (label) label.innerText = `Security Check: ${a} + ${b} = ?`;
    console.log("Security check refreshed. Answer:", currentSecurityAnswer);
}

// Ensure it's available for the UI
window.showGlobalLoader = showGlobalLoader;
window.hideGlobalLoader = hideGlobalLoader;

window.switchAuthTab = (type) => {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const loginTab = document.getElementById('tab-login');
    const regTab = document.getElementById('tab-register');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');

    if (type === 'login') {
        loginForm.style.display = 'flex';
        regForm.style.display = 'none';
        loginTab.classList.add('active');
        regTab.classList.remove('active');
        title.innerText = "Welcome Back";
        subtitle.innerText = "Sign in to continue earning USDT rewards";
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'flex';
        loginTab.classList.remove('active');
        regTab.classList.add('active');
        title.innerText = "Create Account";
        subtitle.innerText = "Join thousands of users earning daily rewards";
        refreshSecurityCheck();
    }
};

window.closeAuthModal = () => {
    // onAuthStateChanged handles the main switch, but this ensures immediate UI feedback
    if (landingPage) landingPage.classList.add('screen-hidden');
    if (mainApp) mainApp.classList.remove('screen-hidden');
};

window.showTerms = () => {
    const termsModal = document.getElementById('terms-modal');
    if (termsModal) {
        termsModal.classList.remove('screen-hidden');
    }
};

window.showPrivacy = () => {
    const privacyModal = document.getElementById('privacy-modal');
    if (privacyModal) {
        privacyModal.classList.remove('screen-hidden');
    }
};

registerBtn.addEventListener('click', async () => {
    const fullName = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const confirmPassword = document.getElementById('reg-confirm-password').value.trim();
    const humanAnswer = parseInt(document.getElementById('reg-human-answer').value);
    const regRefInput = document.getElementById('reg-ref').value.trim();
    const termsAccepted = document.getElementById('reg-terms-check').checked;
    const privacyAccepted = document.getElementById('reg-privacy-check').checked;

    if (!fullName || !email || !password || !confirmPassword) {
        showToast("Please fill in all fields.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
    }

    if (humanAnswer !== currentSecurityAnswer) {
        showToast("Security check failed. Try again.", "error");
        refreshSecurityCheck();
        return;
    }

    if (!termsAccepted || !privacyAccepted) {
        showToast("Please agree to the Terms and Privacy Policy.", "error");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const referredByCode = regRefInput || urlParams.get('ref') || null;

    try {
        console.log("Starting registration process...");
        showGlobalLoader("Creating Secure Account...");
        registerBtn.classList.add('btn-loading');
        registerBtn.disabled = true;

        const meta = await getUserMetadata();
        console.log("Metadata fetched:", meta);

        if (meta.isProxy) {
            showToast("VPN/Proxy detected. Please disable it to continue.", "error");
            hideGlobalLoader();
            registerBtn.classList.remove('btn-loading');
            registerBtn.disabled = false;
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Firebase Auth user created:", user.uid);

        const myReferralCode = generateReferralCode();

        let referrerUid = null;
        if (referredByCode) {
            try {
                const q = query(collection(db, "users"), where("referralCode", "==", referredByCode), limit(1));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    referrerUid = querySnapshot.docs[0].id;
                    // Increment referral count on the referrer document
                    await updateDoc(doc(db, "users", referrerUid), {
                        referralCount: increment(1)
                    });
                }
            } catch (refErr) {
                console.warn("Referral lookup failed (likely permissions):", refErr);
            }
        }

        await setDoc(doc(db, "users", user.uid), {
            fullName: fullName,
            email: email,
            balance: 0.00,
            walletAddress: "",
            videoTasksCompleted: 0,
            totalTasksDone: 0,
            totalVideosWatched: 0,
            totalXP: 0,
            referralCount: 0,
            referralEarnings: 0,
            referralCode: myReferralCode,
            referredBy: referrerUid,
            completedSocialTasks: [],
            completedCustomTasks: [],
            usedPromos: [],
            lastCheckIn: null,
            lastWheelSpin: null,
            checkInStreak: 0,
            createdAt: new Date().toISOString(),
            metadata: meta,
            role: "user",
            privacyAcceptedAt: serverTimestamp()
        });

        showToast("Account created successfully!");
        window.closeAuthModal();
    } catch (error) {
        console.error("Registration Error:", error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
        showToast(msg, 'error');
    } finally {
        hideGlobalLoader();
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

    showGlobalLoader("Authenticating...");
    loginBtn.classList.add('btn-loading');
    loginBtn.disabled = true;

    try {
        const meta = await getUserMetadata();
        if (meta.isProxy) {
            showToast("VPN/Proxy detected. Please disable it to continue.", "error");
            hideGlobalLoader();
            return;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if banned
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().isBanned) {
            await signOut(auth);
            showToast("Your account has been suspended for violating terms.", "error");
            hideGlobalLoader();
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
        hideGlobalLoader();
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
        if (timeTaken < 5) {
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
            updates.totalVideosWatched = increment(10); // Added for badge tracking
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

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const screenId = item.getAttribute('data-screen');
        if (!screenId) return;

        // UI Updates
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');

        const target = document.getElementById(screenId);
        if (target) {
            target.style.display = 'block';
            if (screenId === 'section-admin') loadAdminStats();
        }
    });
});

// --- Task Navigation ---
window.showCategories = () => {
    const categoriesView = document.getElementById('task-categories-view');
    const listView = document.getElementById('task-list-view');
    if (categoriesView) categoriesView.classList.remove('screen-hidden');
    if (listView) listView.classList.add('screen-hidden');
};

window.filterTasks = (category) => {
    const customContainer = document.getElementById('custom-tasks-container');
    const nativeGrid = document.getElementById('native-tasks-grid');
    const nativeCards = document.querySelectorAll('.native-task-card');
    const titleEl = document.getElementById('current-category-title');
    const categoriesView = document.getElementById('task-categories-view');
    const listView = document.getElementById('task-list-view');

    // Switch View
    if (categoriesView) categoriesView.classList.add('screen-hidden');
    if (listView) listView.classList.remove('screen-hidden');

    // Update Title
    const titles = {
        'custom': 'Priority XP Tasks',
        'surveys': 'Premium Surveys',
        'videos': 'Video Rewards',
        'social': 'Social Media Tasks'
    };
    if (titleEl) titleEl.innerText = titles[category] || 'Tasks';

    if (category === 'custom') {
        if (customContainer) customContainer.style.display = 'grid';
        if (nativeGrid) nativeGrid.style.display = 'none';
    } else {
        if (customContainer) customContainer.style.display = 'none';
        if (nativeGrid) nativeGrid.style.display = 'grid';
        nativeCards.forEach(card => {
            if (card.getAttribute('data-category') === category) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }
};

// --- Leaderboards ---
function loadLeaderboard() {
    if (!leaderboardBody) return;
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        leaderboardBody.innerHTML = "";
        const miniLeaderboard = document.getElementById('dashboard-leaderboard');
        if (miniLeaderboard) miniLeaderboard.innerHTML = "";

        let rank = 1;
        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            const rowHtml = `
                <tr class="history-row animate__animated animate__fadeIn">
                    <td>#${rank}</td>
                    <td>${data.fullName || 'User'}</td>
                    <td>${data.totalTasksDone || 0}</td>
                    <td style="font-weight: 800; color: var(--success);">$${(data.balance || 0).toFixed(2)}</td>
                </tr>`;
            leaderboardBody.innerHTML += rowHtml;

            if (miniLeaderboard && rank <= 3) {
                miniLeaderboard.innerHTML += `
                    <div class="quick-task-item">
                        <div class="qt-icon">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</div>
                        <div class="qt-info">
                            <p>${data.fullName || 'User'}</p>
                            <span>$${(data.balance || 0).toFixed(2)}</span>
                        </div>
                    </div>`;
            }
            rank++;
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

let auditLogsListener = null;
async function loadAuditLogs() {
    const list = document.getElementById('admin-audit-logs');
    if (!list) return;
    if (auditLogsListener) auditLogsListener();
    const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(50));
    auditLogsListener = onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        snapshot.forEach(logDoc => {
            const data = logDoc.data();
            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : "...";
            list.innerHTML += `<div class="log-item" style="padding:10px; border-bottom:1px solid var(--border-color); font-size:12px;">
                <strong>${data.action}</strong>: ${data.targetUid} by ${data.adminId} <br>
                <span style="opacity:0.6;">${time}</span>
            </div>`;
        });
    });
}

window.resetUserDailyLimits = async (uid) => {
    if (!confirm("Reset daily limits for this user (Today only)?")) return;
    try {
        await updateDoc(doc(db, "users", uid), {
            dailyVideoCount: 0,
            dailySurveyCount: 0,
            dailyEarningsCount: 0,
            lastVideoDate: "",
            lastSurveyDate: "",
            lastRewardDate: ""
        });

        await addDoc(collection(db, "audit_logs"), {
            adminId: auth.currentUser.uid,
            action: "RESET_LIMITS",
            targetUid: uid,
            timestamp: serverTimestamp()
        });

        showToast("Daily limits reset.");
    } catch (e) {
        showToast("Error resetting limits", "error");
    }
};

window.toggleBanUser = async (uid, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'Unban' : 'Ban'} this user?`)) return;
    try {
        await updateDoc(doc(db, "users", uid), { isBanned: !currentStatus });

        await addDoc(collection(db, "audit_logs"), {
            adminId: auth.currentUser.uid,
            action: currentStatus ? "UNBAN_USER" : "BAN_USER",
            targetUid: uid,
            timestamp: serverTimestamp()
        });

        showToast(`User ${currentStatus ? 'unbanned' : 'banned'} successfully.`);
    } catch (e) {
        showToast("Error toggling ban", "error");
    }
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

        // Update Timeline UI if the user is looking at it
        if (auth.currentUser && auth.currentUser.uid === payoutData.uid) {
            updateWithdrawalTimeline('Success');
        }

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

// --- Withdrawal UI Timeline ---
function updateWithdrawalTimeline(status) {
    const bullets = document.querySelectorAll('.timeline-item .t-bullet');
    const statusBox = document.getElementById('withdrawal-status-box');
    const statusText = document.getElementById('withdrawal-status-text');

    if (!statusBox || !statusText) return;

    // Reset
    bullets.forEach(b => b.classList.remove('active'));
    statusBox.style.display = 'block';

    if (status === 'Pending') {
        bullets[0].classList.add('active');
        bullets[1].classList.add('active');
        statusText.innerText = "Request received. Pending audit.";
    } else if (status === 'Processing') {
        bullets[0].classList.add('active');
        bullets[1].classList.add('active');
        bullets[2].classList.add('active');
        statusText.innerText = "Payment being processed on TRC-20.";
    } else if (status === 'Completed' || status === 'Success') {
        bullets.forEach(b => b.classList.add('active'));
        statusText.innerText = "Payment Sent! Check your wallet.";
        statusBox.style.borderColor = "var(--success)";
        statusBox.style.background = "rgba(16, 185, 129, 0.05)";
    } else {
        statusBox.style.display = 'none';
    }
}

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
            checkInStreak: increment(1),
            totalTasksDone: increment(1)
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
    { id: 'first_task', title: 'First Steps', desc: 'Complete 1 task', icon: 'bx-check-double', condition: (d) => (d.totalTasksDone || 0) >= 1 },
    { id: 'earner_1', title: 'Novice Earner', desc: 'Earn your first $1.00', icon: 'bx-coin', condition: (d) => (d.balance || 0) >= 1 },
    { id: 'referral_1', title: 'Team Player', desc: 'Refer 1 friend', icon: 'bx-user-plus', condition: (d) => (d.referralCount || 0) >= 1 },
    { id: 'streak_3', title: 'Committed', desc: '3 day check-in streak', icon: 'bx-calendar-star', condition: (d) => (d.checkInStreak || 0) >= 3 },
    { id: 'level_5', title: 'Rising Star', desc: 'Reach Level 5', icon: 'bx-trending-up', condition: (d) => (Math.floor((d.totalXP || d.totalTasksDone || 0) / 50) + 1) >= 5 },
    { id: 'whale', title: 'High Roller', desc: 'Earn $10.00 total', icon: 'bx-crown', condition: (d) => (d.balance || 0) >= 10 },
    { id: 'video_expert', title: 'Binge Watcher', desc: 'Watch 500 videos total', icon: 'bx-slideshow', condition: (d) => (d.totalVideosWatched || 0) >= 500 }
];

function updateAchievementsUI(userData) {
    const grid = document.getElementById('badge-grid');
    const miniGrid = document.getElementById('dashboard-achievements');

    if (grid) {
        grid.innerHTML = achievements.map(ach => {
            const unlocked = ach.condition(userData);
            return `
                <div class="badge-card ${unlocked ? 'unlocked' : ''}">
                    <div class="badge-icon-wrapper">
                        <i class='bx ${ach.icon}'></i>
                    </div>
                    <h4>${ach.title}</h4>
                    <p>${ach.desc}</p>
                    ${unlocked ? '<span class="status-badge">Unlocked</span>' : '<span class="status-badge locked">Locked</span>'}
                </div>`;
        }).join('');
    }

    if (miniGrid) {
        miniGrid.innerHTML = achievements
            .filter(ach => ach.condition(userData))
            .slice(0, 5) // Show only first 5 unlocked ones in banner
            .map(ach => `
                <div class="mini-badge unlocked animate__animated animate__bounceIn" title="${ach.title}: ${ach.desc}">
                    <i class='bx ${ach.icon}'></i>
                </div>
            `).join('');

        if (miniGrid.innerHTML === "") {
            miniGrid.innerHTML = '<p style="font-size: 11px; opacity: 0.7; font-weight: 600;">Complete tasks to unlock badges!</p>';
        }
    }
}

function updateLevelUI(userData) {
    const xpTotal = userData.totalXP || 0;
    const level = Math.floor(xpTotal / 50) + 1;
    const xp = xpTotal % 50;
    const progress = (xp / 50) * 100;
    if (document.getElementById('user-level')) document.getElementById('user-level').innerText = level;
    if (document.getElementById('level-bar')) document.getElementById('level-bar').style.width = `${progress}%`;

    if (prevValues.xpPercent !== progress) {
        animateValue('level-percent', prevValues.xpPercent, progress, 1000, 0, "%");
        prevValues.xpPercent = progress;
    }
}

// --- Live Payouts Feed ---
function initLiveFeed() {
    const feed = document.getElementById('live-payouts-feed');
    if (!feed) return;

    let isInitialLoad = true;
    const q = query(collection(db, "payouts"), orderBy("timestamp", "desc"), limit(5));
    onSnapshot(q, (snapshot) => {
        // Show notification for new payouts (skip initial load)
        if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const displayId = data.uid ? `User...${data.uid.slice(-4)}` : 'Anonymous';
                    showToast(`🔥 New Payout: $${(data.amount || 0).toFixed(2)} to ${displayId}!`, "success");

                    // Trigger confetti for big payouts (> $50)
                    if (data.amount >= 50) {
                        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                    }
                }
            });
        }
        isInitialLoad = false;

        feed.innerHTML = '';
        if (snapshot.empty) {
            feed.innerHTML = `
                <div class="feed-item">
                    <i class='bx bxs-info-circle'></i>
                    <span>Waiting for the next big payout...</span>
                </div>`;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'feed-item animate__animated animate__fadeInLeft';

            // Mask UID for privacy if no username
            const displayId = data.uid ? `User...${data.uid.slice(-4)}` : 'Anonymous';

            item.innerHTML = `
                <i class='bx bxs-check-circle' style="color: #10b981;"></i>
                <span>${displayId} just withdrew <strong>$${(data.amount || 0).toFixed(2)} USDT</strong></span>
            `;
            feed.appendChild(item);
        });
    });
}

// --- Priority (Custom) Tasks Logic ---
window.createNewAdminTask = async () => {
    const title = document.getElementById('admin-task-title').value;
    const link = document.getElementById('admin-task-link').value;
    const xp = parseInt(document.getElementById('admin-task-xp').value);
    const icon = document.getElementById('admin-task-icon').value;
    const desc = document.getElementById('admin-task-desc').value;
    const image = document.getElementById('admin-task-image').value;
    const category = document.getElementById('admin-task-category').value || 'Daily';

    if (!title || !link || !xp) return showToast("Please fill all fields", "error");

    try {
        await addDoc(collection(db, "custom_tasks"), {
            title, link, xp, icon, desc, image, category,
            createdAt: serverTimestamp(),
            active: true
        });
        showToast("Priority task added successfully!");
        addAuditLog("CREATE_PRIORITY_TASK", { title, xp, category });
        // Clear fields
        ['admin-task-title', 'admin-task-link', 'admin-task-xp', 'admin-task-desc', 'admin-task-image', 'admin-task-category'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        loadAdminCustomTasks();
    } catch (e) {
        showToast("Error adding task", "error");
    }
};

async function loadAdminCustomTasks() {
    const list = document.getElementById('admin-custom-tasks-list');
    if (!list) return;
    const q = query(collection(db, "custom_tasks"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    list.innerHTML = '';
    snapshot.forEach(docSnap => {
        const t = docSnap.data();
        list.innerHTML += `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class='bx ${t.icon}' style="font-size:18px; color:var(--primary);"></i>
                        <span>${t.title}</span>
                    </div>
                </td>
                <td><span class="badge" style="background:var(--primary); color:white;">+${t.xp} XP</span></td>
                <td><a href="${t.link}" target="_blank" class="btn-text" style="font-size:12px;">View Link</a></td>
                <td><button onclick="deleteCustomTask('${docSnap.id}')" class="btn btn-sm btn-outline" style="color:var(--danger);">Delete</button></td>
            </tr>
        `;
    });
}

window.deleteCustomTask = async (id) => {
    if (confirm("Delete this task?")) {
        await deleteDoc(doc(db, "custom_tasks", id));
        loadAdminCustomTasks();
        showToast("Task deleted");
    }
};

function loadUserPriorityTasks(userData) {
    const container = document.getElementById('custom-tasks-container');
    if (!container) return;

    onSnapshot(collection(db, "custom_tasks"), (snapshot) => {
        container.innerHTML = '';
        const completed = userData.completedCustomTasks || [];

        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;

            if (completed.includes(id)) return;

            container.innerHTML += `
                <div class="task-card-premium priority-task animate__animated animate__fadeInUp" style="border: 2px solid var(--primary); background: linear-gradient(145deg, rgba(255,255,255,1), rgba(var(--primary-rgb), 0.05));">
                    <div class="t-badge" style="background:var(--primary);">${t.category}</div>
                    ${t.image ? `<div class="t-banner" style="width:100%; height:120px; border-radius:12px; overflow:hidden; margin-bottom:15px;"><img src="${t.image}" style="width:100%; height:100%; object-fit:cover;"></div>` : `<div class="t-icon-large" style="background:rgba(var(--primary-rgb),0.1); color:var(--primary);"><i class='bx ${t.icon}'></i></div>`}
                    <h3 style="margin-top:10px;">${t.title}</h3>
                    <p style="font-size:13px; line-height:1.5; margin-bottom:15px;">${t.desc}</p>
                    <div class="t-meta" style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px;">
                        <span><i class='bx bxs-zap' style="color:var(--warning);"></i> <strong>+${t.xp} XP</strong></span>
                        <span style="font-size:11px; font-weight:700; color:var(--primary);">PRIORITY</span>
                    </div>
                    <button class="btn btn-primary btn-block" onclick="completePriorityTask('${id}', '${t.link}', ${t.xp})" style="margin-top:15px; box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3);">
                        <i class='bx bx-link-external'></i> Start Task
                    </button>
                </div>
            `;
        });
    });
}

window.completePriorityTask = async (id, link, xp) => {
    window.open(link, '_blank');

    showToast("Opening link... click Verify in 5 seconds.", "info");

    setTimeout(async () => {
        if (confirm(`Did you complete the task: ${link}?`)) {
            const user = auth.currentUser;
            const userRef = doc(db, "users", user.uid);

            try {
                await runTransaction(db, async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    const data = userDoc.data();

                    if (data.completedCustomTasks && data.completedCustomTasks.includes(id)) {
                        throw "Task already completed";
                    }

                    transaction.update(userRef, {
                        totalXP: increment(xp),
                        completedCustomTasks: arrayUnion(id),
                        totalTasksDone: increment(1)
                    });

                    // Log activity
                    const historyRef = doc(collection(db, "users", user.uid, "history"));
                    transaction.set(historyRef, {
                        type: 'Priority Task',
                        amount: xp,
                        currency: 'XP',
                        title: 'Social Task Completed',
                        timestamp: serverTimestamp()
                    });
                });
                showToast(`Success! +${xp} XP awarded.`, "success");
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } catch (e) {
                showToast(e, "error");
            }
        }
    }, 5000);
};

// --- Task Navigation ---
window.showCategories = () => {
    document.getElementById('task-categories-view').classList.remove('screen-hidden');
    document.getElementById('task-list-view').classList.add('screen-hidden');
};

window.filterTasks = (category) => {
    const customContainer = document.getElementById('custom-tasks-container');
    const nativeGrid = document.getElementById('native-tasks-grid');
    const nativeCards = document.querySelectorAll('.native-task-card');
    const titleEl = document.getElementById('current-category-title');

    // Switch View
    document.getElementById('task-categories-view').classList.add('screen-hidden');
    document.getElementById('task-list-view').classList.remove('screen-hidden');

    // Update Title
    const titles = {
        'custom': 'Priority XP Tasks',
        'surveys': 'Premium Surveys',
        'videos': 'Video Rewards',
        'social': 'Social Media Tasks'
    };
    titleEl.innerText = titles[category] || 'Tasks';

    if (category === 'custom') {
        customContainer.style.display = 'grid';
        nativeGrid.style.display = 'none';
    } else {
        customContainer.style.display = 'none';
        nativeGrid.style.display = 'grid';
        nativeCards.forEach(card => {
            if (card.getAttribute('data-category') === category) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }
};

// Replace existing filterTasks if it exists
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

const notifBell = document.getElementById('notif-btn');
if (notifBell) {
    notifBell.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.classList.toggle('active');
    });
}

// Close dropdown on click outside
document.addEventListener('click', () => {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) dropdown.classList.remove('active');
});

async function loadAdminStats() {
    const statsContainer = document.getElementById('admin-stats-grid');
    const logsContainer = document.getElementById('admin-audit-logs');
    if (!statsContainer) return;

    // Load Logs
    const logQuery = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(logQuery, (snapshot) => {
        if (logsContainer) {
            logsContainer.innerHTML = '';
            snapshot.forEach(logDoc => {
                const log = logDoc.data();
                logsContainer.innerHTML += `
                    <tr>
                        <td style="font-size:12px;">${log.adminEmail}</td>
                        <td><span class="badge">${log.action}</span></td>
                        <td style="font-size:12px;">${JSON.stringify(log.details)}</td>
                        <td style="font-size:11px; color:var(--text-muted);">${log.timestamp?.toDate().toLocaleString() || '...'}</td>
                    </tr>
                `;
            });
        }
    });

    // Load User List for investigation
    const usersQuery = query(collection(db, "users"), limit(50));
    onSnapshot(usersQuery, (snapshot) => {
        const userList = document.getElementById('admin-users-list');
        if (userList) {
            userList.innerHTML = '';
            snapshot.forEach(uDoc => {
                const u = uDoc.data();
                userList.innerHTML += `
                    <tr>
                        <td>
                            <div style="font-weight:700;">${u.email}</div>
                            <div style="font-size:10px; color:var(--text-muted);">${uDoc.id}</div>
                        </td>
                        <td>${u.metadata?.ip || 'N/A'}</td>
                        <td style="color:var(--success); font-weight:800;">$${(u.balance || 0).toFixed(2)}</td>
                        <td style="font-size:11px;">${u.metadata?.lastSeen?.toDate().toLocaleString() || 'Never'}</td>
                        <td><span class="badge ${u.isBanned ? 'danger' : 'success'}">${u.isBanned ? 'Banned' : 'Active'}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="toggleBan('${uDoc.id}', ${u.isBanned || false})">
                                ${u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
    });

    // Global Stats
    const usersSnap = await getDocs(collection(db, "users"));
    const pendingPayoutsSnap = await getDocs(query(collection(db, "payouts"), where("status", "==", "Pending")));
    const completedPayoutsSnap = await getDocs(query(collection(db, "payouts"), where("status", "==", "Completed")));

    let globalBal = 0;
    usersSnap.forEach(d => globalBal += (d.data().balance || 0));

    let pendingPayoutSum = 0;
    pendingPayoutsSnap.forEach(d => pendingPayoutSum += (d.data().amount || 0));

    let totalPaidSum = 0;
    completedPayoutsSnap.forEach(d => totalPaidSum += (d.data().amount || 0));

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="s-icon purple"><i class='bx bxs-user'></i></div>
            <div class="s-info"><p>Total Users</p><h2>${usersSnap.size}</h2></div>
        </div>
        <div class="stat-card">
            <div class="s-icon green"><i class='bx bxs-wallet'></i></div>
            <div class="s-info"><p>Platform Liability</p><h2>$${globalBal.toFixed(2)}</h2></div>
        </div>
        <div class="stat-card">
            <div class="s-icon orange"><i class='bx bxs-time'></i></div>
            <div class="s-info"><p>Pending Payouts</p><h2>$${pendingPayoutSum.toFixed(2)}</h2></div>
        </div>
        <div class="stat-card">
            <div class="s-icon blue"><i class='bx bxs-badge-check'></i></div>
            <div class="s-info"><p>Total Paid Out</p><h2>$${totalPaidSum.toFixed(2)}</h2></div>
        </div>
    `;

    // Global Analytics Chart
    initGlobalAnalyticsChart(globalBal);
}

let globalAnalyticsChart;
async function initGlobalAnalyticsChart(currentLiability) {
    const canvas = document.getElementById('globalAnalyticsChart');
    if (!canvas) return;

    // Get last 7 days labels
    const labels = [];
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        const startOfDay = new Date(d.setHours(0, 0, 0, 0));
        days.push(startOfDay);
    }

    const platformPayouts = [0, 0, 0, 0, 0, 0, 0];

    const payoutSnap = await getDocs(query(collection(db, "payouts"), where("timestamp", ">=", days[0])));
    payoutSnap.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            const d = data.timestamp.toDate();
            const dayIdx = labels.indexOf(d.toLocaleDateString('en-US', { weekday: 'short' }));
            if (dayIdx !== -1) platformPayouts[dayIdx] += data.amount;
        }
    });

    // Note: Transaction-wide search is heavy. We'll show Payouts vs Liability Growth (simulated for UI)
    const liabilityGrowth = [currentLiability * 0.8, currentLiability * 0.85, currentLiability * 0.9, currentLiability * 0.92, currentLiability * 0.95, currentLiability * 0.98, currentLiability];

    const ctx = canvas.getContext('2d');
    if (globalAnalyticsChart) globalAnalyticsChart.destroy();
    globalAnalyticsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Payouts Processed ($)',
                    data: platformPayouts,
                    backgroundColor: '#10b981',
                    borderRadius: 5
                },
                {
                    label: 'Platform Liability ($)',
                    data: liabilityGrowth,
                    type: 'line',
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

window.toggleBan = async (uid, currentStatus) => {
    const reason = prompt(`Reason for ${currentStatus ? 'unbanning' : 'banning'} user ${uid}:`);
    if (reason === null) return;

    try {
        await updateDoc(doc(db, "users", uid), { isBanned: !currentStatus });
        addAuditLog(currentStatus ? "UNBAN_USER" : "BAN_USER", { uid, reason });
        showToast(`User ${currentStatus ? 'unbanned' : 'banned'}.`);
    } catch (e) {
        showToast("Error toggling ban status", "error");
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
                transaction.update(userRef, {
                    balance: 0,
                    lastWithdrawalDate: serverTimestamp()
                });
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
let userDocUnsubscribe = null;
let payoutUnsubscribe = null;
let notificationsUnsubscribe = null;
let leaderboardUnsubscribe = null;
let affLeaderboardUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
    // Unsubscribe from previous listeners to prevent memory leaks and duplicate updates
    if (userDocUnsubscribe) userDocUnsubscribe();
    if (payoutUnsubscribe) payoutUnsubscribe();
    if (notificationsUnsubscribe) notificationsUnsubscribe();
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();
    if (affLeaderboardUnsubscribe) affLeaderboardUnsubscribe();

    if (user) {
        landingPage.classList.add('screen-hidden');
        mainApp.classList.remove('screen-hidden');
        requestNotificationPermission(user.uid);

        userDocUnsubscribe = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                syncUserData(data);
                updateLevelUI(data);
                updateAchievementsUI(data);
                updateDailyCheckInUI(data);
                loadUserPriorityTasks(data);
                if (data.role === 'admin') {
                    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('screen-hidden'));
                    loadAdminCustomTasks();
                }
            }
        });

        loadLeaderboard();
        loadAffiliateLeaderboard();
        loadTransactionHistory(user.uid);
        loadNotifications(user.uid);
        updateChartData(user.uid);
        initLiveFeed();

        // Real-time Payout/Withdrawal Status Listener
        const payoutQ = query(collection(db, "payouts"), where("uid", "==", user.uid), orderBy("timestamp", "desc"), limit(1));
        payoutUnsubscribe = onSnapshot(payoutQ, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                // Show timeline if it's not a very old completed payout (e.g. within last 3 days)
                const isRecent = data.timestamp && typeof data.timestamp.toDate === 'function' && (Date.now() - data.timestamp.toDate() < 3 * 24 * 60 * 60 * 1000);
                if (data.status !== 'Completed' || isRecent) {
                    updateWithdrawalTimeline(data.status);
                } else {
                    updateWithdrawalTimeline(null);
                }
            } else {
                updateWithdrawalTimeline(null);
            }
        });
    } else {
        landingPage.classList.remove('screen-hidden');
        mainApp.classList.add('screen-hidden');
    }
});

// --- Promo Code Logic ---
window.redeemPromoCode = async () => {
    const code = promoInput.value.trim().toUpperCase();
    const user = auth.currentUser;
    if (!user || !code) return;

    try {
        const promoRef = doc(db, "promo_codes", code);
        const promoSnap = await getDoc(promoRef);

        if (!promoSnap.exists()) {
            showToast("Invalid promo code.", "error");
            return;
        }

        const promoData = promoSnap.data();
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData.usedPromos && userData.usedPromos.includes(code)) {
            showToast("You've already used this code.", "error");
            return;
        }

        if (promoData.expiresAt && promoData.expiresAt.toDate() < new Date()) {
            showToast("This code has expired.", "error");
            return;
        }

        await updateDoc(userRef, {
            balance: increment(promoData.rewardAmount || 0),
            totalXP: increment(promoData.rewardXP || 0),
            totalVideosWatched: increment(promoData.rewardVideos || 0), // Added to support new badge
            usedPromos: arrayUnion(code)
        });

        await addDoc(collection(db, "users", user.uid, "transactions"), {
            activity: `Promo Code: ${code}`,
            amount: promoData.rewardAmount || 0,
            status: "Completed",
            timestamp: serverTimestamp()
        });

        showToast(`Success! +$${promoData.rewardAmount || 0} and +${promoData.rewardXP || 0} XP earned.`);
        promoInput.value = "";
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } catch (e) {
        showToast("Error redeeming code.", "error");
    }
};

window.copyToClipboard = (elementId) => {
    const copyText = document.getElementById(elementId);
    if (!copyText) return;
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    showToast("Copied to clipboard!");
};

window.copyReferralLink = () => {
    const link = document.getElementById('referral-link').value;
    navigator.clipboard.writeText(link);
    showToast("Referral link copied!");
};

window.selectSurveyOpt = (btn) => {
    const parent = btn.parentElement;
    parent.querySelectorAll('.survey-opt').forEach(b => b.classList.remove('active', 'btn-primary'));
    parent.querySelectorAll('.survey-opt').forEach(b => b.classList.add('btn-outline'));
    btn.classList.remove('btn-outline');
    btn.classList.add('active', 'btn-primary');
};

function syncUserData(data) {
    const user = auth.currentUser;
    if (user && document.getElementById('profile-id')) {
        document.getElementById('profile-id').value = user.uid;
    }
    userEmailSidebar.innerText = data.email;
    userAvatar.innerText = (data.fullName ? data.fullName[0] : data.email[0]).toUpperCase();
    document.getElementById('user-name-display').innerText = data.fullName || 'Earner';

    const balance = data.balance || 0;
    if (prevValues.balance !== balance) {
        animateValue('balance', prevValues.balance, balance, 1000, 2);
        animateValue('balance-big', prevValues.balance, balance, 1000, 2);
        if (document.getElementById('withdraw-balance')) animateValue('withdraw-balance', prevValues.balance, balance, 1000, 2);
        prevValues.balance = balance;
    }

    // Payout Progress
    const payoutGoal = PLATFORM_CONFIG.limits.minWithdrawal;
    const payoutPercent = Math.min((balance / payoutGoal) * 100, 100);
    const payoutBar = document.getElementById('payout-progress-bar');
    const payoutText = document.getElementById('payout-progress-text');
    if (payoutBar) payoutBar.style.width = `${payoutPercent}%`;
    if (payoutText) payoutText.innerText = `${Math.floor(payoutPercent)}%`;

    const tasks = data.totalTasksDone || 0;
    if (prevValues.tasks !== tasks) {
        animateValue('tasks-count', prevValues.tasks, tasks, 1000, 0);
        prevValues.tasks = tasks;
    }

    if (walletInput) walletInput.value = data.walletAddress || "";

    // Video Task Progress (towards $0.10 reward)
    const videoRewardProgress = data.videoTasksCompleted || 0;
    if (videoProgressText) videoProgressText.innerText = `Progress: ${videoRewardProgress}/10 Videos`;

    // Video Task Progress (Task Center)
    const today = new Date().toDateString();
    const dailyVideoCount = data.lastVideoDate === today ? (data.dailyVideoCount || 0) : 0;
    const videoLimit = PLATFORM_CONFIG.limits.maxVideosPerDay;
    const videoLimitPercent = (dailyVideoCount / videoLimit) * 100;

    const videoBarCenter = document.getElementById('video-progress-bar-center');
    const videoTextCenter = document.getElementById('video-progress-text-center');
    const videoPercentCenter = document.getElementById('video-progress-percent-center');

    if (videoBarCenter) videoBarCenter.style.width = `${(videoRewardProgress / 10) * 100}%`;
    if (videoTextCenter) videoTextCenter.innerText = `Daily: ${dailyVideoCount}/${videoLimit}`;
    if (videoPercentCenter) videoPercentCenter.innerText = `${Math.floor((videoRewardProgress / 10) * 100)}%`;

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
            loadAuditLogs();
        }
    }
}
