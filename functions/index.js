const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Automated Payout Processing (Every Sunday at 00:00 UTC)
exports.processSundayPayouts = onSchedule("0 0 * * 0", async (event) => {
    const payoutsRef = db.collection('payouts');
    const snapshot = await payoutsRef.where('status', '==', 'Pending').get();

    if (snapshot.empty) {
        console.log('No pending payouts found.');
        return;
    }

    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.update(doc.ref, {
            status: 'Processing',
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    console.log(`Processed ${snapshot.size} payouts.`);
});

// Notify user on payout approval
exports.onPayoutStatusChange = onDocumentUpdated("payouts/{payoutId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (newData.status === 'Paid' && oldData.status !== 'Paid') {
        const userId = newData.uid;
        const amount = newData.amount;

        await db.collection('users').doc(userId).collection('notifications').add({
            title: "💰 Payout Sent!",
            message: `Your withdrawal of $${amount.toFixed(2)} USDT has been processed successfully.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        console.log(`User ${userId} was paid ${amount} USDT`);
    }
});

// Survey Postback Verification (BitLabs, Pollfish, etc.)
exports.surveyPostback = onRequest(async (req, res) => {
    const { uid, reward, status, transId, network } = req.query;

    if (!uid || !reward || status !== 'complete') {
        console.warn('Invalid postback received:', req.query);
        return res.status(400).send('Invalid request');
    }

    try {
        const userRef = db.collection('users').doc(uid);

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw "User not found";

            const rewardAmount = parseFloat(reward);
            const today = new Date().toDateString();

            transaction.update(userRef, {
                balance: admin.firestore.FieldValue.increment(rewardAmount),
                dailyEarningsCount: admin.firestore.FieldValue.increment(rewardAmount),
                lastRewardDate: today,
                totalTasksDone: admin.firestore.FieldValue.increment(1)
            });

            // Log transaction
            const txRef = userRef.collection('transactions').doc(transId || Date.now().toString());
            transaction.set(txRef, {
                activity: `Survey Completion (${network || 'External'})`,
                amount: rewardAmount,
                status: 'Completed',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                transId: transId || null
            });
        });

        console.log(`Postback success: Reward $${reward} for user ${uid}`);
        return res.status(200).send('ok');
    } catch (error) {
        console.error('Postback error:', error);
        return res.status(500).send('Internal Error');
    }
});
