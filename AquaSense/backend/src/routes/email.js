const express = require("express");
const { Resend } = require("resend");
const admin = require("../config/firebaseAdmin");
const { buildVerificationEmailHtml } = require("../templates/verificationEmail");
const { buildPasswordResetEmailHtml } = require("../templates/passwordResetEmail");

const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const actionCodeSettings = {
      url: "https://aquasense-b0ad9.firebaseapp.com",
      handleCodeInApp: false,
    };

    const verificationLink = await admin
      .auth()
      .generateEmailVerificationLink(email, actionCodeSettings);

    const html = buildVerificationEmailHtml({ nome, verificationLink });

    const { data, error } = await resend.emails.send({
      from: "AquaSense <onboarding@resend.dev>",
      to: email,
      subject: "Confirme seu e-mail no AquaSense",
      html,
    });

    if (error) {
      console.error("Erro ao enviar via Resend:", error);
      return res.status(500).json({
        error: "Erro ao enviar e-mail de verificação.",
        details: error.message,
      });
    }

    console.log(`E-mail enviado para ${email} | ID: ${data.id}`);

    return res.status(200).json({
      message: "E-mail de verificação enviado com sucesso.",
      messageId: data.id,
    });

  } catch (error) {
    console.error("Erro ao enviar e-mail de verificação:", error);

    const isFirebaseError = error.code && error.code.startsWith("auth/");

    return res.status(500).json({
      error: isFirebaseError
        ? "Erro ao gerar link de verificação no Firebase."
        : "Erro ao enviar e-mail via Resend.",
      details: error.message,
      code: error.code || null,
    });
  }
});

/**
 * POST /send-password-reset-email
 * Recebe { email }, gera o link via Firebase Admin e envia o e-mail customizado.
 */
router.post("/send-password-reset-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: "Campo obrigatório ausente: email.",
    });
  }

  try {
    const actionCodeSettings = {
      url: "https://aquasense-b0ad9.firebaseapp.com",
      handleCodeInApp: false,
    };

    const resetLink = await admin
      .auth()
      .generatePasswordResetLink(email, actionCodeSettings);

    const html = buildPasswordResetEmailHtml({ resetLink });

    const { data, error } = await resend.emails.send({
      from: "AquaSense <onboarding@resend.dev>",
      to: email,
      subject: "Redefinição de senha no AquaSense",
      html,
    });

    if (error) {
      console.error("Erro ao enviar via Resend:", error);
      return res.status(500).json({
        error: "Erro ao enviar e-mail de redefinição.",
        details: error.message,
      });
    }

    console.log(`E-mail de reset enviado para ${email} | ID: ${data.id}`);

    return res.status(200).json({
      message: "E-mail de redefinição enviado com sucesso.",
      messageId: data.id,
    });

  } catch (error) {
    console.error("Erro ao enviar e-mail de reset:", error);

    const isFirebaseError = error.code && error.code.startsWith("auth/");

    return res.status(500).json({
      error: isFirebaseError
        ? "Erro ao gerar link de redefinição no Firebase."
        : "Erro ao enviar e-mail via Resend.",
      details: error.message,
      code: error.code || null,
    });
  }
});

module.exports = router;