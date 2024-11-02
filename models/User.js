// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  referenceNo: { type: String, required: true, unique: true },
  referenceDate: { type: String },
  licenseType: { type: String },
  vehicleClass: { type: String },
  personalInfo: {
    name: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    dateOfBirth: { type: String },
    bloodGroup: { type: String },
    mobileNo: { type: String },
    nidNumber: { type: String },
    permanentAddress: { type: String },
    presentAddress: { type: String },
    licensingAuthority: { type: String }
  },
  photo: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);