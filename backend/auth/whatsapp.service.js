const axios = require("axios");

exports.sendOTP = async (phone, otp) => {
  // Mock mode for testing when WhatsApp token is expired
  const MOCK_MODE = process.env.WHATSAPP_MOCK_MODE === 'true';
  
  // Format phone number for WhatsApp API
  // Remove all non-numeric characters and add country code if not present
  let formattedPhone = phone.replace(/\D/g, ''); // Remove all non-digits
  
  // If phone doesn't start with country code, add India code (91)
  if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone;
  }
  
  if (MOCK_MODE) {
    console.log(`📱 [MOCK MODE] OTP for ${formattedPhone}: ${otp}`);
    console.log('✅ WhatsApp message simulated successfully');
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedPhone,
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

    console.log("✅ WhatsApp message sent successfully");
  } catch (err) {
    console.error("🔴 WhatsApp API Error:");
    console.error(err.response?.data);
    throw err;
  }
};
