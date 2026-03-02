const mongoose = require('mongoose');

const contactSubmissionSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  phone:       { type: String },
  email:       { type: String },
  sessionType: { type: String },
  message:     { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ContactSubmission', contactSubmissionSchema);
