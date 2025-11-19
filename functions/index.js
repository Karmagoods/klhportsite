/* eslint-disable no-unused-vars */
import {onRequest} from 'firebase-functions/v2/https';
import logger from 'firebase-functions/logger';
import nodemailer from 'nodemailer';
import cors from 'cors';
import functions from 'firebase-functions';

// Access environment variables directly from Firebase Functions config
const gmailUser = functions.config().gmail.user;
const gmailAppPassword = functions.config().gmail.pass;

// Validate environment variables
if (!gmailUser || !gmailAppPassword) {
  logger.error('Missing environment variables.');
  throw new Error('Environment variables not configured correctly.');
}

// Create Nodemailer transporter using Gmail's SMTP with app password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
});

// CORS configuration to allow requests from your specific frontend domain
const corsOptions = {
  origin: 'https://klhinnovation-6eac7.web.app', // Replace with your frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};

// Define the email-sending function
export const sendEmail = onRequest((req, res) => {
  cors(corsOptions)(req, res, async () => {
    try {
      // Ensure it's a POST request
      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed. Use POST.'});
      }

      const {to, subject, text, html} = req.body;

      // Check for required fields
      if (!to || !subject) {
        return res.status(400).json({
          error: 'Missing required fields: \'to\' and \'subject\'.',
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({
          error: 'Invalid \'to\' email address format.',
        });
      }

      // Log sending email
      logger.info(`Sending email to ${to}`);

      // Set up mail options
      const mailOptions = {
        from: gmailUser,
        to,
        subject,
        text: text || '',
        html: html || '',
      };

      // Send the email
      await transporter.sendMail(mailOptions);
      logger.info('Email sent successfully.');
      return res.status(200).json({message: 'Email sent successfully.'});
    } catch (error) {
      logger.error('Error sending email:', error);
      return res.status(500).json({
        error: 'Error sending email. Please try again later.',
      });
    }
  });
});
