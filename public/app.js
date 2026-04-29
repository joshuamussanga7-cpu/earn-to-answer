import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, increment, addDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

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
            lastCheckIn: null,
            lastWheelSpin: null,
            checkInStreak: 0,
            createdAt: new Date().toISOString()
        });

        showToast("Account created successfully!");
        window.closeAuthModal();
        // Clear inputs
        document.getElementById('reg-name').value = "";
        document.getElementById('reg-email').value = "";
        document.getElementById('reg-password').value = "";
    } catch (error) {
        console.error("Registration Error:", error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
        if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
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
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Welcome back!");
        window.closeAuthModal();
        // Clear inputs
        document.getElementById('email').value = "";
        document.getElementById('password').value = "";
    } catch (error) {
        console.error("Login Error:", error);
        let msg = "Invalid email or password.";
        if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
        if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
        if (error.code === 'auth/invalid-email') msg = "Invalid email format.";
        if (error.code === 'auth/too-many-requests') msg = "Too many failed attempts. Try again later.";
        showToast(msg, 'error');
    } finally {
        loginBtn.classList.remove('btn-loading');
        loginBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- UI Sync Logic ---
// Removed redundant auth listener here, consolidated at the bottom.

// --- Wallet Logic ---

saveWalletBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const address = walletInput.value;
    if (user && address) {
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
    }
});

// --- Task Logic ---

window.startVideoTask = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Trigger PropellerAds Interstitial if available
    if (typeof show_8984362 === 'function') {
        show_8984362().then(() => {
            console.log('Ad finished');
        });
    }

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
            let videoProgress = (data.videoTasksCompleted || 0) + 1;
            let balance = data.balance || 0;
            let totalTasks = data.totalTasksDone || 0;

            if (videoProgress >= 10) {
                const reward = 0.10;
                balance += reward;
                videoProgress = 0;
                totalTasks += 1;

                await addDoc(collection(db, "users", user.uid, "transactions"), {
                    activity: "Watched 10 Videos",
                    amount: reward,
                    status: "Completed",
                    timestamp: serverTimestamp()
                });

                showToast(`+$${reward} USDT earned!`);
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

                if (data.referredBy) {
                    await updateDoc(doc(db, "users", data.referredBy), {
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
            await updateDoc(userRef, {
                balance: increment(reward),
                totalTasksDone: increment(1)
            });

            await addDoc(collection(db, "users", user.uid, "transactions"), {
                activity: "Daily Survey",
                amount: reward,
                status: "Completed",
                timestamp: serverTimestamp()
            });

            if (data.referredBy) {
                await updateDoc(doc(db, "users", data.referredBy), {
                    balance: increment(reward * 0.1),
                    referralEarnings: increment(reward * 0.1)
                });
            }

            showToast(`+$${reward} USDT earned!`);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    }
};

window.verifySocialTask = async (platform, url, reward) => {
    const user = auth.currentUser;
    if (!user) return;

    // Check if already completed
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.completedSocialTasks && data.completedSocialTasks.includes(platform)) {
            showToast("Task already completed!", "error");
            return;
        }
    }

    // Open social link in new tab
    window.open(url, '_blank');

    // Simulate verification
    showToast(`Verifying ${platform} follow...`, "info");

    setTimeout(async () => {
        try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                balance: increment(reward),
                totalTasksDone: increment(1),
                completedSocialTasks: (userSnap.data().completedSocialTasks || []).concat([platform])
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
            showToast("Verification failed. Try again.", "error");
        }
    }, 5000); // 5 second delay for verification
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

// --- Leaderboards & History ---
async function loadLeaderboard() {
    if (!leaderboardBody) return;
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(5));
    const querySnapshot = await getDocs(q);
    leaderboardBody.innerHTML = "";
    let rank = 1;
    querySnapshot.forEach((userDoc) => {
        const data = userDoc.data();
        leaderboardBody.innerHTML += `
            <tr class="history-row">
                <td>#${rank++}</td>
                <td>${data.fullName || 'User'}</td>
                <td>${data.totalTasksDone || 0}</td>
                <td style="font-weight: 800; color: var(--success);">$${(data.balance || 0).toFixed(2)}</td>
            </tr>`;
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
        affBody.innerHTML += `
            <tr class="history-row">
                <td>#${rank++}</td>
                <td>${data.fullName || 'User'}</td>
                <td>${data.referralCount || 0}</td>
                <td style="font-weight: 800; color: var(--primary);">$${(data.referralEarnings || 0).toFixed(2)}</td>
            </tr>`;
    });
}

async function loadTransactionHistory(uid) {
    if (!historyBody) return;
    const q = query(collection(db, "users", uid, "transactions"), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        historyBody.innerHTML = snapshot.empty ? "<tr><td colspan='4'>No activity yet.</td></tr>" : "";
        snapshot.forEach((txDoc) => {
            const data = txDoc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'Pending...';
            historyBody.innerHTML += `
                <tr class="history-row">
                    <td>${date}</td>
                    <td>${data.activity}</td>
                    <td style="color: var(--success); font-weight: 700;">+$${data.amount.toFixed(2)}</td>
                    <td><span class="badge" style="background: #eef2ff; color: #4f46e5;">${data.status}</span></td>
                </tr>`;
        });
    });
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
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
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

// --- Fortune Wheel Logic ---
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
    const userSnap = await getDoc(doc(db, "users", user.uid));
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
        if (prize.value > 0) {
            await updateDoc(doc(db, "users", user.uid), {
                balance: increment(prize.value),
                lastWheelSpin: new Date().toISOString()
            });
            showToast(`You won $${prize.value}!`);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } else {
            await updateDoc(doc(db, "users", user.uid), { lastWheelSpin: new Date().toISOString() });
            showToast("Better luck next time!", "error");
        }
        btn.disabled = false;
    }, 4500);
};

// --- Social Sharing ---
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

// --- Notifications & Achievements ---

window.addNotification = (title, message) => {
    const list = document.getElementById('notif-list');
    const dot = document.getElementById('notif-dot');
    if (!list || !dot) return;

    if (list.querySelector('.notif-item p')) list.innerHTML = '';
    dot.style.display = 'block';

    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `
        <i class='bx bxs-bell-ring'></i>
        <div class="content">
            <p>${title}</p>
            <span>${message}</span>
        </div>
    `;
    list.prepend(item);
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
        card.innerHTML = `
            <i class='bx ${ach.icon}'></i>
            <h4>${ach.title}</h4>
            <p>${ach.desc}</p>
        `;
        grid.appendChild(card);
    });
}

function updateLevelUI(tasksCount) {
    const level = Math.floor(tasksCount / 50) + 1;
    const xp = tasksCount % 50;
    const progress = (xp / 50) * 100;

    const levelNum = document.getElementById('level-num');
    const levelProgress = document.getElementById('level-progress');
    const levelName = document.getElementById('level-name');

    if (levelNum) levelNum.innerText = level;
    if (levelProgress) levelProgress.style.width = `${progress}%`;

    if (levelName) {
        const titles = ["Rookie", "Novice", "Pro", "Expert", "Master", "Legend"];
        levelName.innerText = titles[Math.min(level - 1, titles.length - 1)];
    }
}

// Notification Bell Toggle
const bell = document.getElementById('notif-bell');
const dropdown = document.getElementById('notif-dropdown');
if (bell) {
    bell.onclick = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        document.getElementById('notif-dot').style.display = 'none';
    };
}
document.onclick = () => { if (dropdown) dropdown.style.display = 'none'; };

// --- Profile, Support & Payouts ---
const updateProfileBtn = document.getElementById('update-profile-btn');
if (updateProfileBtn) {
    updateProfileBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        const newName = document.getElementById('profile-name').value;
        if (user && newName) {
            try {
                await updateDoc(doc(db, "users", user.uid), { fullName: newName });
                showToast("Profile updated successfully!");
            } catch (error) {
                showToast(error.message, "error");
            }
        }
    });
}

const requestPayoutBtn = document.getElementById('request-payout-btn');
if (requestPayoutBtn) {
    requestPayoutBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const bal = data.balance || 0;
            const wallet = data.walletAddress || "";

            if (bal < 10) {
                showToast("Minimum withdrawal is $10.00 USDT", "error");
                return;
            }
            if (!wallet) {
                showToast("Please save your USDT address first", "error");
                showSection('wallet');
                return;
            }

            requestPayoutBtn.classList.add('btn-loading');
            requestPayoutBtn.disabled = true;

            try {
                // Deduct balance and create request
                await updateDoc(userRef, { balance: increment(-bal) });
                await addDoc(collection(db, "payouts"), {
                    uid: user.uid,
                    email: data.email,
                    amount: bal,
                    address: wallet,
                    status: "Pending",
                    timestamp: serverTimestamp()
                });

                await addDoc(collection(db, "users", user.uid, "transactions"), {
                    activity: "Withdrawal Request",
                    amount: -bal,
                    status: "Pending",
                    timestamp: serverTimestamp()
                });

                showToast("Withdrawal request sent! Payout on Sunday.");
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                requestPayoutBtn.classList.remove('btn-loading');
                requestPayoutBtn.disabled = false;
            }
        }
    });
}

window.submitTicket = () => {
    const subject = document.getElementById('support-subject').value;
    const msg = document.getElementById('support-msg').value;
    if (!msg) {
        showToast("Please enter a message", "error");
        return;
    }
    showToast("Ticket submitted! Our team will contact you via email.");
    document.getElementById('support-msg').value = '';
};

// --- Navigation ---
window.showSection = (sectionId) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('screen-hidden'));
    document.getElementById(`section-${sectionId}`).classList.remove('screen-hidden');

    // Update active state in sidebar/bottom-nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(sectionId)) {
            link.classList.add('active');
        }
    });
};

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
            datasets: [{
                label: 'Earnings (USDT)',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

async function updateChartData(uid) {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
    startOfWeek.setHours(0, 0, 0, 0);

    const q = query(
        collection(db, "users", uid, "transactions"),
        where("timestamp", ">=", startOfWeek)
    );

    const querySnapshot = await getDocs(q);
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];

    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            const date = data.timestamp.toDate();
            const dayIndex = (date.getDay() + 6) % 7;
            weeklyData[dayIndex] += Math.abs(data.amount); // Show volume
        }
    });

    initChart(weeklyData);
}

// Global Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        landingPage.classList.add('screen-hidden');
        mainApp.classList.remove('screen-hidden');
        document.body.classList.remove('auth-mode');

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
        updateChartData(user.uid);
    } else {
        landingPage.classList.remove('screen-hidden');
        mainApp.classList.add('screen-hidden');
        document.body.classList.add('auth-mode');
    }
});

function syncUserData(data) {
    userEmailSidebar.innerText = data.email;
    userAvatar.innerText = (data.fullName ? data.fullName[0] : data.email[0]).toUpperCase();
    document.getElementById('user-name-display').innerText = data.fullName || 'Earner';

    const bal = (data.balance || 0).toFixed(2);
    if (balanceSpan) balanceSpan.innerText = bal;
    if (balanceBigSpan) balanceBigSpan.innerText = bal;
    if (tasksCountSpan) tasksCountSpan.innerText = data.totalTasksDone || 0;
    if (walletInput) walletInput.value = data.walletAddress || "";

    const progress = data.videoTasksCompleted || 0;
    if (videoProgressText) videoProgressText.innerText = `Progress: ${progress}/10 Videos`;

    // Dashboard Achievements Mini-list
    const dashAch = document.getElementById('dashboard-achievements');
    if (dashAch) {
        dashAch.innerHTML = '';
        achievements.slice(0, 4).forEach(ach => {
            const unlocked = ach.condition(data);
            dashAch.innerHTML += `<div class="mini-badge ${unlocked ? 'unlocked' : ''}" title="${ach.title}"><i class='bx ${ach.icon}'></i></div>`;
        });
    }

    // Dashboard Top Earners
    loadDashboardLeaderboard();

    if (refCountText) refCountText.innerText = data.referralCount || 0;
    const refCountDash = document.getElementById('ref-count-dash');
    if (refCountDash) refCountDash.innerText = data.referralCount || 0;
    if (refEarningsText) refEarningsText.innerText = (data.referralEarnings || 0).toFixed(2);

    const refLink = `${window.location.origin}/index.html?ref=${data.referralCode || (auth.currentUser ? auth.currentUser.uid : '')}`;
    if (referralLinkInput) referralLinkInput.value = refLink;
    const dashRefInput = document.getElementById('referral-link-dash');
    if (dashRefInput) dashRefInput.value = refLink;

    // Profile Fields
    const profName = document.getElementById('profile-name');
    const profEmail = document.getElementById('profile-email');
    const joinDate = document.getElementById('join-date');
    if (profName) profName.value = data.fullName || "";
    if (profEmail) profEmail.value = data.email || "";
    if (joinDate && data.createdAt) {
        joinDate.innerText = new Date(data.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // Wheel Status
    const lastSpin = data.lastWheelSpin ? new Date(data.lastWheelSpin) : null;
    const canSpin = !lastSpin || (new Date() - lastSpin > 24 * 60 * 60 * 1000);
    const wheelStatus = document.getElementById('wheel-status');
    if (wheelStatus) wheelStatus.innerText = canSpin ? "SPIN NOW" : "LOCKED";
}

async function loadDashboardLeaderboard() {
    const list = document.getElementById('dashboard-leaderboard');
    if (!list) return;
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(3));
    const querySnapshot = await getDocs(q);
    list.innerHTML = "";
    querySnapshot.forEach((userDoc) => {
        const data = userDoc.data();
        list.innerHTML += `
            <div class="status-row" style="margin-bottom: 8px;">
                <span>${data.fullName || 'User'}</span>
                <span style="color: var(--success); font-weight: 700;">$${(data.balance || 0).toFixed(2)}</span>
            </div>`;
    });
}
