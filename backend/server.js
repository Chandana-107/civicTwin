// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const complaintsRoutes = require("./routes/complaints");
const uploadRoutes = require("./routes/upload");
const tendersRoutes = require("./routes/tenders");
const fraudRoutes = require("./routes/fraud");
const simulationRoutes = require("./routes/simulation");
const topicsRoutes = require("./routes/topics");
const socialRoutes = require("./routes/social_feed");

const app = express();
app.use(cors());
app.use(express.json());

// static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/complaints", complaintsRoutes);
app.use("/upload", uploadRoutes);
app.use("/tenders", tendersRoutes);
app.use("/fraud", fraudRoutes);
app.use("/simulation", simulationRoutes);
app.use("/topics", topicsRoutes);
app.use("/social", socialRoutes);

app.get("/", (req, res) => {
  res.send(`Civic Backend running. Schema doc path: ${process.env.SCHEMA_DOC_PATH || "not set"}`);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server listening on ${port}`));
