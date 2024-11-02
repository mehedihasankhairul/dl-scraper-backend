const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const scrapeLicenseData = require('./scraper/scrapeLicenseData');
const User = require('./models/User');

// Load environment variables from .env file
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB connection with detailed error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log('MongoDB URI:', process.env.MONGODB_URI);

    // Test the connection by counting documents
    const count = await User.countDocuments();
    console.log(`Current document count in Users collection: ${count}`);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

// Modified scraping endpoint with better error handling and logging
app.get('/api/scrape/:refno', async (req, res) => {
  try {
    const refNo = req.params.refno;

    if (!refNo || refNo.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required',
      });
    }

    console.log(`Starting scrape for reference number: ${refNo}`);

    const data = await scrapeLicenseData(refNo);

    // Validate the scraped data
    if (!data || Object.keys(data).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data found for the provided reference number',
      });
    }

    console.log('Scraped data:', JSON.stringify(data, null, 2));

    // Check if user already exists
    const existingUser = await User.findOne({ referenceNo: data.referenceNo });

    if (existingUser) {
      console.log('Updating existing user');
      Object.assign(existingUser, data);
      await existingUser.save();
    } else {
      console.log('Creating new user');
      const user = new User(data);
      await user.save();
    }

    // Verify the save operation
    const savedUser = await User.findOne({ referenceNo: data.referenceNo });
    console.log('Saved user:', savedUser ? 'Success' : 'Failed');

    res.json({
      success: true,
      message: `Data ${existingUser ? 'updated' : 'saved'} successfully!`,
      data: savedUser,
    });
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry error',
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: process.env.NODE_ENV === 'development' ? error.stack : error.message,
    });
  }
});

// Endpoint to get all users from the database along with the total count
app.get('/api/users', async (req, res) => {
  try {
    // Retrieve all users from the Users collection
    const users = await User.find();
    const totalUsers = await User.countDocuments();

    res.json({
      success: true,
      message: 'All users retrieved successfully',
      totalUsers: totalUsers,
      data: users,
    });
  } catch (error) {
    console.error('Error retrieving all users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message,
    });
  }
});

// Endpoint to delete a specific user by reference number
app.delete('/api/users/:refno', async (req, res) => {
  try {
    const refNo = req.params.refno;

    if (!refNo || refNo.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required',
      });
    }

    // Find and delete the user with the specified reference number
    const deletedUser = await User.findOneAndDelete({ referenceNo: refNo });

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found with the provided reference number',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: deletedUser,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
});

// Test endpoint to verify MongoDB connection
app.get('/api/test-db', async (req, res) => {
  try {
    // Test write permission
    const testDoc = new User({
      referenceNo: 'test-' + Date.now(),
      personalInfo: {
        name: 'Test User',
      },
    });
    await testDoc.save();
    await User.findByIdAndDelete(testDoc._id);

    const count = await User.countDocuments();
    res.json({
      success: true,
      message: 'Database connection and write permission verified',
      documentCount: count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message,
    });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Don't exit the process in production
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});
