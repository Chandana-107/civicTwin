const router = require("express").Router();
const controller = require("./auth.controller");

router.post("/aadhaar/request-otp", controller.requestOTP);
router.post("/aadhaar/verify-otp", controller.verifyOTP);
router.post("/register", controller.register);
router.post("/login", controller.login);

module.exports = router;
