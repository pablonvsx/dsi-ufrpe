// Critérios de validações 
// Para reutilizar para os outros tipos de cadastro, importar: 
/** * import {
 * validateName,
 * validateEmail, 
 * validateCity,
 * validateOrganization,
 * validatePassword,
 * validateConfirmPassword,
 * } from "@/utils/validators";
 */

export function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "O nome é obrigatório.";
  if (trimmed.length < 3) return "O nome deve ter pelo menos 3 caracteres.";
  if (trimmed.length > 80) return "O nome é muito longo.";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "O e-mail é obrigatório.";
  if (/\s/.test(value)) return "O e-mail não pode conter espaços.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return "Informe um e-mail válido.";
  return null;
}

export function validateCity(value: string): string | null {
  if (!value.trim()) return "Selecione uma cidade.";
  return null;
}

export const PASSWORD_RULES = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[^A-Za-z0-9]/,
};

export function validatePassword(value: string): string | null {
  if (!value) return "A senha é obrigatória.";
  if (value.length < PASSWORD_RULES.minLength)
    return "A senha deve ter pelo menos 8 caracteres.";
  if (!PASSWORD_RULES.hasUppercase.test(value))
    return "A senha deve conter pelo menos uma letra maiúscula.";
  if (!PASSWORD_RULES.hasNumber.test(value))
    return "A senha deve conter pelo menos um número.";
  if (!PASSWORD_RULES.hasSpecial.test(value))
    return "A senha deve conter pelo menos um caractere especial.";
  return null;
}

export function validateConfirmPassword(
  password: string,
  confirm: string
): string | null {
  if (!confirm) return "Confirme sua senha.";
  if (confirm !== password) return "As senhas não coincidem.";
  return null;
}

export function validateOrganization(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "A organização é obrigatória.";
  if (trimmed.length < 3) return "A organização deve ter pelo menos 3 caracteres.";
  if (trimmed.length > 100) return "O nome da organização é muito longo.";
  return null;
}