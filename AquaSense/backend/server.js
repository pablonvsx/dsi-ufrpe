require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.error("Erro não capturado:", err.message);
  console.error(err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Promise rejeitada não tratada:", reason);
});

const express = require("express");
const cors = require("cors");
const emailRoutes = require("./src/routes/email");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/", emailRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  // "0.0.0.0" é CRÍTICO: faz o servidor escutar em todas as interfaces de rede,
  // não só em localhost. Sem isso, o celular físico não consegue se conectar.
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse em: http://localhost:${PORT}/health`);
});

