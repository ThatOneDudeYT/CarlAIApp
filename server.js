const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const otpStore = {};

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: 'erbreen@icloud.com',
        pass: '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'
    }
});

app.post('/api/send-otp', async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const code = Math.floor(10000 + Math.random() * 90000).toString();
    otpStore[email] = { code, expires: Date.now() + 10 * 60 * 1000 };

    try {
        await transporter.sendMail({
            from: '"Carl AI Support" <carlaisupport@gmail.com>',
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

app.post('/api/send-alert', async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const type = (req.body.type || 'signin');
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        const subject = type === "signup" ? "New Account Created" : "New Sign-In Detected";
        const text = type === "signup" ? `An account was created for ${email}.` : `A sign-in was detected for ${email}.`;
        
        await transporter.sendMail({
            from: '"Carl AI Support" <carlaisupport@gmail.com>',
            to: 'erbreen@icloud.com',
            subject: subject,
            text: text
        });
        res.json({ success: true, message: "Alert sent successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send alert." });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Carl AI Server is running on http://localhost:${PORT}`);
});
