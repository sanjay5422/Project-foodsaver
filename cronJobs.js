const cron = require('node-cron');
const FoodPost = require('./models/FoodPost');

// Run every 5 minutes - check for expired food posts
const startCronJobs = () => {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const now = new Date();
            const result = await FoodPost.updateMany(
                {
                    expiryDate: { $lte: now },
                    isExpired: false,
                    status: 'Available'
                },
                {
                    $set: { isExpired: true, status: 'Expired' }
                }
            );
            if (result.modifiedCount > 0) {
                console.log(`[Cron] Expired ${result.modifiedCount} food post(s)`);
            }
        } catch (error) {
            console.error('[Cron] Error expiring food posts:', error);
        }
    });

    console.log('[Cron] Food expiry job scheduled (every 5 minutes)');
};

module.exports = startCronJobs;
