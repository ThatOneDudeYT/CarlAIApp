const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());

// Tell the server to load your website files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

const otpStore = {}; // { email: { code: '12345', expires: timestamp } }

// Updated Transporter for Brevo (Sendinblue)
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'erbreen@icloud.com', // Replace with your Brevo SMTP login email
        pass: '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' // Replace with your Brevo SMTP key
    }
});

app.post('/api/send-otp', async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const code = Math.floor(10000 + Math.random() * 90000).toString();
    otpStore[email] = { code, expires: Date.now() + 10 * 60 * 1000 }; // 10 min expiration

    try {
        await transporter.sendMail({
            from: '"Carl AI Support" <carlaisupport@gmail.com>', // Ensure this email is authorized in Brevo
            to: email,
            subject: 'Your Carl AI Verification Code',
            text: `Here's your one time use Carl AI code!\n\n${code}\n\nThis code will expire in 10 minutes.`
        });
        res.json({ success: true, message: "Code sent successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send email. Check your Brevo configuration." });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').toString().trim();

    const record = otpStore[email];
    if (!record) return res.status(400).json({ error: "No code found for this email" });
    if (Date.now() > record.expires) {
        delete otpStore[email];
        return res.status(400).json({ error: "Code has expired" });
    }
    if (record.code !== code) {
        return res.status(400).json({ error: "Incorrect verification code" });
    }

    delete otpStore[email];
    res.json({ success: true, message: "Verified successfully" });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Carl AI Server is running on http://localhost:${PORT}`);
});
