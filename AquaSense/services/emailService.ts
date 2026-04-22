type SendVerificationEmailPayload = {
  nome: string;
  email: string;
};

type SendPasswordResetPayload = {
  email: string;
};

type SendVerificationEmailResponse = {
  message: string;
  messageId?: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function sendVerificationEmail(
  payload: SendVerificationEmailPayload
): Promise<SendVerificationEmailResponse> {
  if (!API_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_URL não definida. Verifique o arquivo .env.local"
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_URL}/send-verification-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.details || data.error || "Erro ao enviar e-mail de verificação."
      );
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error(
        "O servidor demorou demais para responder. Verifique se o backend está rodando e se a URL está correta."
      );
    }

    throw error;
  }
}

export async function sendPasswordResetEmail(
  payload: SendPasswordResetPayload
): Promise<SendVerificationEmailResponse> {
  if (!API_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_URL não definida. Verifique o arquivo .env.local"
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_URL}/send-password-reset-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.details || data.error || "Erro ao enviar e-mail de redefinição."
      );
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error(
        "O servidor demorou demais para responder. Verifique se o backend está rodando."
      );
    }

    throw error;
  }
}