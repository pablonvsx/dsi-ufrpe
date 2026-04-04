const express = require("express");
const nodemailer = require("nodemailer");
const admin = require("../config/firebaseAdmin");
const { buildVerificationEmailHtml } = require("../templates/verificationEmail");

const router = express.Router();

// Cria o transporter uma única vez (singleton).
// Nodemailer reutiliza a conexão SMTP, mais eficiente do que criar a cada request.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465, // true só para porta 465 (SSL)
  family: 4, // força IPv4
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verifica a conexão SMTP ao iniciar (fail-fast: melhor saber logo se está errado)
transporter.verify((error) => {
  if (error) {
    console.error("Falha na conexão SMTP:", error.message);
    console.error("Detalhes:", error);
  } else {
    console.log("SMTP conectado e pronto para envio.");
  }
});

/**
 * POST /send-verification-email
 * Recebe { email, nome }, gera o link via Firebase Admin e envia o e-mail customizado.
 */
router.post("/send-verification-email", async (req, res) => {
  const { email, nome } = req.body;

  if (!email || !nome) {
    return res.status(400).json({
      error: "Campos obrigatórios ausentes: email e nome.",
    });
  }

  try {
    // Gera o link de verificação via Firebase Admin SDK.
    // Esse link é o mesmo que o Firebase enviaria no e-mail padrão,
    // mas agora controla o HTML ao redor dele.
    const actionCodeSettings = {
      url: "https://aquasense-b0ad9.firebaseapp.com", // redirect após verificação
      handleCodeInApp: false,
    };

    const verificationLink = await admin
      .auth()
      .generateEmailVerificationLink(email, actionCodeSettings);

    const html = buildVerificationEmailHtml({ nome, verificationLink });

    const info = await transporter.sendMail({
      from: `"AquaSense" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: "Confirme seu e-mail no AquaSense",
      html,
    });

    console.log(`E-mail enviado para ${email} | ID: ${info.messageId}`);

    return res.status(200).json({
      message: "E-mail de verificação enviado com sucesso.",
      messageId: info.messageId,
    });

  } catch (error) {
    console.error(" Erro ao enviar e-mail de verificação:", error);

    // Distingue erros do Firebase Admin de erros do SMTP
    const isFirebaseError = error.code && error.code.startsWith("auth/");

    return res.status(500).json({
      error: isFirebaseError
        ? "Erro ao gerar link de verificação no Firebase."
        : "Erro ao enviar e-mail via SMTP.",
      details: error.message,
      code: error.code || null,
    });
  }
});

module.exports = router;
