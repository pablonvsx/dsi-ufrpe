require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.error("Erro não capturado:", err.message);
  console.error(err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Promise rejeitada não tratada:", reason);
  process.exit(1);
});

const express = require("express");
const cors = require("cors");
const emailRoutes = require("./src/routes/email");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check (muito importante pro Render)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Rotas
app.use("/", emailRoutes);

// Porta dinâmica (Render) ou local
const PORT = process.env.PORT || 3000;

// IMPORTANTE: 0.0.0.0 pra funcionar no Render + dispositivos externos
app.listen(PORT, "0.0.0.0", () => {
  console.log(` Servidor rodando na porta ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
});