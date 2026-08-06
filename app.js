require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const sessionMiddleware = require("./config/session");
const locals = require("./middleware/locals");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");

const clientRoutes = require("./routes/client/index.routes");
const authRoutes = require("./routes/client/auth.routes");
const accountRoutes = require("./routes/client/account.routes");
const careerRoutes = require("./routes/client/career.routes");
const adminRoutes = require("./routes/admin/index.routes");
const apiRoutes = require("./routes/api/index.routes");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/client");

app.use(expressLayouts);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));
app.use(sessionMiddleware);
app.use(locals);

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/", clientRoutes);
app.use("/", authRoutes);
app.use("/", accountRoutes);
app.use("/", careerRoutes);
app.use("/admin", adminRoutes);
app.use("/api/v1", apiRoutes);

io.on("connection", (socket) => {
  socket.on("order:join", (orderId) => socket.join(`order:${orderId}`));
  socket.on("driver:location", (data) => {
    io.to(`order:${data.orderId}`).emit("driver:location", data);
  });
});

app.use(notFound);
app.use(errorHandler);
app.get("/test-image", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "media",
            "products",
            "pain-1.jpg"
        )
    );
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`TiopTiop démarré : http://localhost:${port}`);
  console.log(`Administration : http://localhost:${port}/admin`);
  console.log(`API santé : http://localhost:${port}/api/v1/health`);
});

module.exports = { app, server, io };
