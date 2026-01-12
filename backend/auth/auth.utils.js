const jwt = require("jsonwebtoken");

exports.issueJWT = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d"
  });
};
