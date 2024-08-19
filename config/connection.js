const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/backend', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Kiểm tra kết nối
mongoose.connection.on('open', () => {
  console.log('Kết nối đến MongoDB thành công!');
});

mongoose.connection.on('error', (err) => {
  console.error('Kết nối đến MongoDB gặp lỗi:', err);
});

module.exports = mongoose.connection;