const nodemailer = require('nodemailer');

//nodemailer setup
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password (not account password)
  },
});

module.exports = mailer;
