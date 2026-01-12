const axios = require("axios");

exports.sendOTP = async (phone, otp) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: {
          body: `Welcome to CivicTwin 👋\n\n🔐 CivicTwin Verification Code\n\nYour One-Time Password (OTP) is: *${otp}*\n\nThis code is valid for 5 minutes.\nDo not share this OTP with anyone.\n\nCivicTwin helps simulate policies, resolve citizen grievances, and build transparent, smarter governance.`
        }

      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("WhatsApp message sent successfully");
  } catch (err) {
    console.error("🔴 WhatsApp API Error:");
    console.error(err.response?.data);
    throw err;
  }
};
