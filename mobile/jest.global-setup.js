// Dates in tests are shown in the store's time zone (Django TIME_ZONE = Asia/Karachi),
// whatever the machine running them uses. Set before Jest starts its workers.
module.exports = async () => {
  process.env.TZ = 'Asia/Karachi';
};
