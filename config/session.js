const session = require("express-session");

module.exports = session({
  name: process.env.SESSION_NAME || "tioptiop.sid",
  secret: process.env.SESSION_SECRET || "development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Number(process.env.SESSION_MAX_AGE_MS || 604800000)
  }
});
