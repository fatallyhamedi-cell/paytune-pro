let notificationService;
try {
  notificationService = require('../../src/services/notificationService');
} catch (e) {
  notificationService = {
    createNotification: () => null,
    notifyWithdrawalStatus: () => null,
    notifyArtistApproved: () => null
  };
}

module.exports = notificationService;
