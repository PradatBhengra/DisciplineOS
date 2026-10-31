const mongoose = require('mongoose');

// Wraps any {"$...": ...} object from user input in $eq so it can't act as a query operator
mongoose.set('sanitizeFilter', true);

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`MongoDB connection error: ${err.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
