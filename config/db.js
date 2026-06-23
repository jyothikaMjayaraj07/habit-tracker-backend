// backend/config/db.js

const mongoose = require('mongoose');
// mongoose = our MongoDB translator

const connectDB = async () => {
  // async because connecting to DB takes time (network call)
  // we must WAIT for it to finish before server starts accepting requests

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    // mongoose.connect() returns a connection object
    // process.env.MONGO_URI reads from your .env file
    // await = "pause here until connection is established"

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    // conn.connection.host shows WHICH server we connected to
    // useful for debugging (local vs Atlas)

  } catch (error) {
    // If connection fails (wrong URI, no internet, wrong password)
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
    // process.exit(1) = stop the entire Node process
    // "1" means "crashed with error" (0 = clean exit)
    // No point running server if DB is down
  }
};

module.exports = connectDB;
// Export so server.js can import and use it