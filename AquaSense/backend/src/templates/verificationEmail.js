/**
 * Separa o template do HTML em um arquivo próprio.
 * Vantagem: fácil de editar sem mexer na lógica de negócio.
 */
function buildVerificationEmailHtml({ nome, verificationLink }) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Verifique seu e-mail</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f0fafa; font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fafa; padding:40px 0;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0"
              style="background:#ffffff; border-radius:12px; overflow:hidden;
                     box-shadow:0 4px 20px rgba(0,77,72,0.1);">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#004d48,#1a8c80);
                           padding:32px 40px; text-align:center;">
                  <h1 style="color:#ffffff; margin:0; font-size:24px;
                             letter-spacing:2px;">AQUASENSE</h1>
                  <p style="color:rgba(255,255,255,0.8); margin:8px 0 0;
                            font-size:13px;">Monitoramento Inteligente da Água</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="color:#004d48; margin:0 0 16px; font-size:20px;">
                    Olá, ${nome}!
                  </h2>
                  <p style="color:#374151; line-height:1.6; margin:0 0 12px;">
                    Seu cadastro no <strong>AquaSense</strong> foi realizado com sucesso.
                    Falta apenas um passo para ativar sua conta.
                  </p>
                  <p style="color:#374151; line-height:1.6; margin:0 0 28px;">
                    Clique no botão abaixo para verificar seu e-mail:
                  </p>

                  <!-- Botão -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${verificationLink}"
                           style="display:inline-block; padding:14px 32px;
                                  background-color:#004d48; color:#ffffff;
                                  text-decoration:none; border-radius:50px;
                                  font-weight:bold; font-size:15px;
                                  letter-spacing:1px;">
                          VERIFICAR E-MAIL
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Link alternativo -->
                  <p style="color:#6b7280; font-size:13px; margin:28px 0 0; line-height:1.6;">
                    Se o botão não funcionar, copie e cole este link no navegador:
                  </p>
                  <p style="word-break:break-all; color:#1a8c80; font-size:12px; margin:8px 0 0;">
                    ${verificationLink}
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f9fafb; padding:20px 40px;
                           border-top:1px solid #e5e7eb;">
                  <p style="color:#9ca3af; font-size:12px; margin:0; text-align:center;">
                    Se você não criou essa conta, pode ignorar esta mensagem com segurança.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

module.exports = { buildVerificationEmailHtml };
