const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Automated Payout Processing (Every Sunday at 00:00 UTC)
exports.processSundayPayouts = functions.pubsub.schedule('0 0 * * 0')
    .timeZone('UTC')
    .onRun(async (context) => {
        const payoutsRef = db.collection('payouts');
        const snapshot = await payoutsRef.where('status', '==', 'Pending').get();

        if (snapshot.empty) {
            console.log('No pending payouts found.');
            return null;
        }

        const batch = db.batch();

        snapshot.forEach(doc => {
            // In a real scenario, you'd integrate with a Crypto API here
            // For now, we mark them as "Processing" or "Auto-Approved"
            batch.update(doc.ref, {
                status: 'Processing',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`Processed ${snapshot.size} payouts.`);
        return null;
    });

// Notify user on payout approval
exports.onPayoutStatusChange = functions.firestore
    .document('payouts/{payoutId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        if (newData.status === 'Paid' && oldData.status !== 'Paid') {
            const userId = newData.uid;
            const amount = newData.amount;

            // Add notification to user's collection (if you have one) or just log
            console.log(`User ${userId} was paid ${amount} USDT`);

            // Optional: Send email via SendGrid/Mailgun
        }
    });
