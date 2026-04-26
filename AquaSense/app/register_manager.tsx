import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    StatusBar,
    Pressable,
    Platform,
    Image,
    KeyboardAvoidingView,
    ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { registerGestor, parseFirebaseAuthError } from "@/services/auth/register";
import { sendVerificationEmail } from "@/services/emailService";

interface FormErrors {
    nome?: string;
    email?: string;
    orgao?: string;
    cargo?: string;
    matricula?: string;
    senha?: string;
    confirmarSenha?: string;
}

interface TouchedFields {
    nome?: boolean;
    email?: boolean;
    orgao?: boolean;
    cargo?: boolean;
    matricula?: boolean;
    senha?: boolean;
    confirmarSenha?: boolean;
}

function validateNome(value: string): string | null {
    if (!value.trim()) return "Informe seu nome completo.";
    if (value.trim().length < 3) return "O nome deve ter pelo menos 3 caracteres.";
    return null;
}
function validateEmail(value: string): string | null {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) return "Informe seu e-mail institucional.";
    if (!re.test(value)) return "E-mail inválido.";
    return null;
}
function validateOrgao(value: string): string | null {
    if (!value.trim()) return "Informe o órgão ou instituição.";
    return null;
}
function validateCargo(value: string): string | null {
    if (!value.trim()) return "Informe seu cargo.";
    return null;
}
function validateMatricula(value: string): string | null {
    if (!value.trim()) return "Informe sua matrícula funcional.";
    return null;
}
function validateSenha(value: string): string | null {
    if (!value) return "Informe uma senha.";
    if (value.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
    if (!/[A-Z]/.test(value)) return "A senha deve ter pelo menos uma letra maiúscula.";
    if (!/[0-9]/.test(value)) return "A senha deve ter pelo menos um número.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
        return "A senha deve ter pelo menos um caractere especial (!@#$...).";
    return null;
}
function validateConfirmarSenha(senha: string, confirmar: string): string | null {
    if (!confirmar) return "Confirme sua senha.";
    if (senha !== confirmar) return "As senhas não coincidem.";
    return null;
}

function FieldLabel({ label, fontFamily }: { label: string; fontFamily?: string }) {
    return <Text style={[styles.fieldLabel, { fontFamily }]}>{label}</Text>;
}
function ErrorText({ message, fontFamily }: { message?: string; fontFamily?: string }) {
    if (!message) return null;
    return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttonLabel?: string;
    type?: "success" | "error" | "warning";
    onClose: () => void;
    fontFamily?: string;
}

function CustomAlert({
    visible,
    title,
    message,
    buttonLabel = "Entendi",
    type = "success",
    onClose,
    fontFamily,
}: CustomAlertProps) {
    const iconName =
        type === "success"
            ? "checkmark-circle"
            : type === "warning"
            ? "alert-circle"
            : "close-circle";
    const iconColor =
        type === "success" ? "#1a8c80" : type === "warning" ? "#e6a817" : "#e05252";

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={alertStyles.overlay} onPress={onClose}>
                <Pressable style={alertStyles.box} onPress={(e) => e.stopPropagation()}>
                    <View style={alertStyles.iconWrapper}>
                        <Ionicons name={iconName as any} size={48} color={iconColor} />
                    </View>
                    <Text style={[alertStyles.title, { fontFamily }]}>{title}</Text>
                    <View style={alertStyles.divider} />
                    <Text style={[alertStyles.message, { fontFamily }]}>{message}</Text>
                    <TouchableOpacity
                        style={alertStyles.button}
                        onPress={onClose}
                        activeOpacity={0.85}
                    >
                        <Text style={[alertStyles.buttonText, { fontFamily }]}>
                            {buttonLabel}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const alertStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.52)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
    },
    box: {
        backgroundColor: "#fff",
        borderRadius: 24,
        width: "100%",
        paddingHorizontal: 28,
        paddingTop: 32,
        paddingBottom: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 16,
    },
    iconWrapper: { marginBottom: 14 },
    title: {
        fontSize: 17,
        fontWeight: "700",
        color: "#004d48",
        textAlign: "center",
        marginBottom: 14,
        letterSpacing: 0.2,
    },
    divider: {
        width: "100%",
        height: 1,
        backgroundColor: "#e0f2f1",
        marginBottom: 14,
    },
    message: {
        fontSize: 14,
        color: "#555",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    button: {
        backgroundColor: "#004d48",
        borderRadius: 50,
        paddingVertical: 14,
        paddingHorizontal: 40,
        alignItems: "center",
        width: "100%",
    },
    buttonText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: 0.4,
    },
});

export default function RegisterGestor() {
    const router = useRouter();

    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [orgao, setOrgao] = useState("");
    const [cargo, setCargo] = useState("");
    const [matricula, setMatricula] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<TouchedFields>({});
    const [passwordInfoVisible, setPasswordInfoVisible] = useState(false);

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        title: string;
        message: string;
        type: "success" | "error" | "warning";
        onClose?: () => void;
    }>({ title: "", message: "", type: "success" });

    function showAlert(
        title: string,
        message: string,
        type: "success" | "error" | "warning" = "error",
        onClose?: () => void
    ) {
        setAlertConfig({ title, message, type, onClose });
        setAlertVisible(true);
    }

    function handleAlertClose() {
        setAlertVisible(false);
        alertConfig.onClose?.();
    }

    const emailRef = useRef<TextInput>(null);
    const orgaoRef = useRef<TextInput>(null);
    const cargoRef = useRef<TextInput>(null);
    const matriculaRef = useRef<TextInput>(null);
    const senhaRef = useRef<TextInput>(null);
    const confirmarRef = useRef<TextInput>(null);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    function handleBlur(field: keyof FormErrors) {
        setTouched((prev) => ({ ...prev, [field]: true }));
        let error: string | null = null;
        switch (field) {
            case "nome": error = validateNome(nome); break;
            case "email": error = validateEmail(email); break;
            case "orgao": error = validateOrgao(orgao); break;
            case "cargo": error = validateCargo(cargo); break;
            case "matricula": error = validateMatricula(matricula); break;
            case "senha": error = validateSenha(senha); break;
            case "confirmarSenha":
                error = confirmarSenha.length > 0
                    ? validateConfirmarSenha(senha, confirmarSenha)
                    : null;
                break;
        }
        setErrors((prev) => ({ ...prev, [field]: error ?? undefined }));
    }

    function validateAll(): boolean {
        setTouched({
            nome: true, email: true, orgao: true, cargo: true,
            matricula: true, senha: true, confirmarSenha: true,
        });
        const newErrors: FormErrors = {
            nome: validateNome(nome) ?? undefined,
            email: validateEmail(email) ?? undefined,
            orgao: validateOrgao(orgao) ?? undefined,
            cargo: validateCargo(cargo) ?? undefined,
            matricula: validateMatricula(matricula) ?? undefined,
            senha: validateSenha(senha) ?? undefined,
            confirmarSenha: validateConfirmarSenha(senha, confirmarSenha) ?? undefined,
        };
        setErrors(newErrors);
        return !Object.values(newErrors).some(Boolean);
    }

    async function handleRegister() {
        if (!validateAll()) return;

        setLoading(true);
        try {
            await registerGestor({ nome, email, orgao, cargo, matricula, senha });
            await sendVerificationEmail({ nome, email });

            showAlert(
                "Cadastro realizado!",
                Enviamos um e-mail de verificação para ${email}.\n\nVerifique sua caixa de entrada e confirme seu e-mail para acessar o AquaSense.,
                "success",
                () => router.replace("/awaiting-verification" as any)

            );
        } catch (err: any) {
            console.error("Erro no cadastro:", err);
            if (err?.code?.startsWith("auth/")) {
                showAlert("Erro no cadastro", parseFirebaseAuthError(err.code), "error");
            } else {
                showAlert(
                    "Erro no envio do e-mail",
                    err?.message ?? "O cadastro foi realizado, mas o e-mail de verificação não pôde ser enviado.",
                    "warning"
                );
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient
                colors={["#004d48", "#1a8c80", "#3ff3e7"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

                {Platform.OS === "android" && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.85)" />
                    </TouchableOpacity>
                )}

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.logoContainer}>
                            <Image
                                source={require("../assets/images/aquasense-logo.png")}
                                style={styles.logoImage}
                                resizeMode="contain"
                                tintColor="#FFFFFF"
                            />
                        </View>

                        <Text style={[styles.title, { fontFamily: questrial }]}>
                            CADASTRE-SE NO{"\n"}AQUASENSE
                        </Text>

                        <View style={styles.formWrapper}>

                            {/* NOME */}
                            <FieldLabel label="Seu nome:" fontFamily={questrial} />
                            <TextInput
                                style={[styles.input, { fontFamily: questrial }, errors.nome && touched.nome ? styles.inputError : null]}
                                placeholder="Nome completo..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={nome}
                                onChangeText={(text) => {
                                    setNome(text);
                                    if (touched.nome)
                                        setErrors((p) => ({ ...p, nome: validateNome(text) ?? undefined }));
                                }}
                                onBlur={() => handleBlur("nome")}
                                autoCapitalize="words"
                                returnKeyType="next"
                                onSubmitEditing={() => emailRef.current?.focus()}
                            />
                            <ErrorText message={touched.nome ? errors.nome : undefined} fontFamily={questrial} />

                            {/* EMAIL */}
                            <FieldLabel label="Seu email institucional:" fontFamily={questrial} />
                            <TextInput
                                ref={emailRef}
                                style={[styles.input, { fontFamily: questrial }, errors.email && touched.email ? styles.inputError : null]}
                                placeholder="email@orgao.gov.br..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={email}
                                onChangeText={(t) => {
                                    const s = t.replace(/\s/g, "");
                                    setEmail(s);
                                    if (touched.email)
                                        setErrors((p) => ({ ...p, email: validateEmail(s) ?? undefined }));
                                }}
                                onBlur={() => handleBlur("email")}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                returnKeyType="next"
                                onSubmitEditing={() => orgaoRef.current?.focus()}
                            />
                            <ErrorText message={touched.email ? errors.email : undefined} fontFamily={questrial} />

                            {/* ÓRGÃO */}
                            <FieldLabel label="Órgão / Instituição:" fontFamily={questrial} />
                            <TextInput
                                ref={orgaoRef}
                                style={[styles.input, { fontFamily: questrial }, errors.orgao && touched.orgao ? styles.inputError : null]}
                                placeholder="Ex: Secretaria de Recursos Hídricos..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={orgao}
                                onChangeText={(text) => {
                                    setOrgao(text);
                                    if (touched.orgao)
                                        setErrors((p) => ({ ...p, orgao: validateOrgao(text) ?? undefined }));
                                }}
                                onBlur={() => handleBlur("orgao")}
                                autoCapitalize="words"
                                returnKeyType="next"
                                onSubmitEditing={() => cargoRef.current?.focus()}
                            />
                            <ErrorText message={touched.orgao ? errors.orgao : undefined} fontFamily={questrial} />

                            {/* CARGO */}
                            <FieldLabel label="Cargo:" fontFamily={questrial} />
                            <TextInput
                                ref={cargoRef}
                                style={[styles.input, { fontFamily: questrial }, errors.cargo && touched.cargo ? styles.inputError : null]}
                                placeholder="Ex: Coordenador de Recursos Hídricos..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={cargo}
                                onChangeText={(text) => {
                                    setCargo(text);
                                    if (touched.cargo)
                                        setErrors((p) => ({ ...p, cargo: validateCargo(text) ?? undefined }));
                                }}
                                onBlur={() => handleBlur("cargo")}
                                autoCapitalize="words"
                                returnKeyType="next"
                                onSubmitEditing={() => matriculaRef.current?.focus()}
                            />
                            <ErrorText message={touched.cargo ? errors.cargo : undefined} fontFamily={questrial} />

                            {/* MATRÍCULA */}
                            <FieldLabel label="Matrícula funcional:" fontFamily={questrial} />
                            <TextInput
                                ref={matriculaRef}
                                style={[styles.input, { fontFamily: questrial }, errors.matricula && touched.matricula ? styles.inputError : null]}
                                placeholder="Sua matrícula funcional..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={matricula}
                                onChangeText={(text) => {
                                    setMatricula(text);
                                    if (touched.matricula)
                                        setErrors((p) => ({ ...p, matricula: validateMatricula(text) ?? undefined }));
                                }}
                                onBlur={() => handleBlur("matricula")}
                                autoCapitalize="none"
                                returnKeyType="next"
                                onSubmitEditing={() => senhaRef.current?.focus()}
                            />
                            <ErrorText message={touched.matricula ? errors.matricula : undefined} fontFamily={questrial} />

                            {/* SENHA */}
                            <FieldLabel label="Senha:" fontFamily={questrial} />
                            <View style={styles.passwordRow}>
                                <TextInput
                                    ref={senhaRef}
                                    style={[
                                        styles.input,
                                        styles.inputSenha,
                                        styles.passwordInput,
                                        { fontFamily: questrial },
                                        errors.senha && touched.senha ? styles.inputError : null,
                                    ]}
                                    placeholder="Sua senha..."
                                    placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                    value={senha}
                                    onChangeText={(text) => {
                                        setSenha(text);
                                        if (touched.senha) {
                                            setErrors((p) => ({
                                                ...p,
                                                senha: validateSenha(text) ?? undefined,
                                                ...(touched.confirmarSenha && confirmarSenha.length > 0
                                                    ? { confirmarSenha: validateConfirmarSenha(text, confirmarSenha) ?? undefined }
                                                    : {}),
                                            }));
                                        }
                                    }}
                                    onBlur={() => handleBlur("senha")}
                                    secureTextEntry={!showPassword}
                                    autoComplete="new-password"
                                    autoCorrect={false}
                                    textContentType="newPassword"
                                    returnKeyType="next"
                                    onSubmitEditing={() => confirmarRef.current?.focus()}
                                />
                                <TouchableOpacity
                                    style={styles.infoIcon}
                                    onPress={() => setPasswordInfoVisible(true)}
                                    hitSlop={{ top: 10, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                            <ErrorText message={touched.senha ? errors.senha : undefined} fontFamily={questrial} />

                            {/* CONFIRMAR SENHA */}
                            <FieldLabel label="Confirmar senha:" fontFamily={questrial} />
                            <View style={styles.passwordRow}>
                                <TextInput
                                    ref={confirmarRef}
                                    style={[
                                        styles.input,
                                        styles.inputSenha,
                                        styles.passwordInput,
                                        { fontFamily: questrial },
                                        errors.confirmarSenha && touched.confirmarSenha ? styles.inputError : null,
                                    ]}
                                    placeholder="Confirme sua senha..."
                                    placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                    value={confirmarSenha}
                                    onChangeText={(text) => {
                                        setConfirmarSenha(text);
                                        if (touched.confirmarSenha && text.length > 0) {
                                            setErrors((p) => ({
                                                ...p,
                                                confirmarSenha: validateConfirmarSenha(senha, text) ?? undefined,
                                            }));
                                        }
                                    }}
                                    onBlur={() => handleBlur("confirmarSenha")}
                                    secureTextEntry={!showPassword}
                                    autoComplete="password"
                                    autoCorrect={false}
                                    textContentType="password"
                                    returnKeyType="done"
                                    onSubmitEditing={handleRegister}
                                />
                                <TouchableOpacity
                                    style={styles.infoIcon}
                                    onPress={() => setPasswordInfoVisible(true)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                            <ErrorText message={touched.confirmarSenha ? errors.confirmarSenha : undefined} fontFamily={questrial} />

                            {/* MOSTRAR SENHA */}
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setShowPassword((v) => !v)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, showPassword && styles.checkboxChecked]}>
                                    {showPassword && <Ionicons name="checkmark" size={13} color="#fff" />}
                                </View>
                                <Text style={[styles.checkboxLabel, { fontFamily: questrial }]}>
                                    MOSTRAR SENHA
                                </Text>
                            </TouchableOpacity>

                            {/* BOTÃO CADASTRAR */}
                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleRegister}
                                activeOpacity={0.85}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#004d48" />
                                ) : (
                                    <Text style={[styles.buttonText, { fontFamily: questrial }]}>
                                        CADASTRAR
                                    </Text>
                                )}
                            </TouchableOpacity>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* MODAL — critérios de senha */}
                <Modal
                    visible={passwordInfoVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setPasswordInfoVisible(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setPasswordInfoVisible(false)}>
                        <Pressable style={styles.infoModal} onPress={(e) => e.stopPropagation()}>
                            <Text style={[styles.infoModalTitle, { fontFamily: questrial }]}>
                                Critérios da senha
                            </Text>
                            <View style={styles.modalDivider} />
                            {[
                                "Mínimo de 8 caracteres",
                                "Pelo menos 1 letra maiúscula",
                                "Pelo menos 1 número",
                                "Pelo menos 1 caractere especial (!@#$...)",
                            ].map((item, i) => (
                                <View key={i} style={styles.infoRow}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={18}
                                        color="#004d48"
                                        style={{ marginRight: 10 }}
                                    />
                                    <Text style={[styles.infoText, { fontFamily: questrial }]}>{item}</Text>
                                </View>
                            ))}
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setPasswordInfoVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>
                                    Entendi
                                </Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                <CustomAlert
                    visible={alertVisible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={handleAlertClose}
                    fontFamily={questrial}
                />

            </LinearGradient>
        </>
    );
}

const PRIMARY = "#004d48";
const BORDER_RADIUS = 50;

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gradient: { flex: 1 },
    backButton: {
        position: "absolute",
        top: 52,
        left: 20,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 36,
        paddingTop: Platform.OS === "android" ? 96 : 60,
        paddingBottom: 40,
        alignItems: "center",
    },
    logoContainer: { marginBottom: 10 },
    logoImage: { width: 180, height: 180 },
    title: {
        color: "#fff",
        fontSize: 19,
        fontWeight: "700",
        letterSpacing: 1.5,
        textAlign: "center",
        marginBottom: 28,
        lineHeight: 30,
    },
    formWrapper: { width: "100%" },
    fieldLabel: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
        marginTop: 10,
        marginLeft: 6,
        letterSpacing: 0.3,
    },
    input: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 54,
        paddingHorizontal: 20,
        fontSize: 15,
        color: "#6b7a7a",
        borderWidth: 1.5,
        borderColor: "transparent",
        marginBottom: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    inputError: {
        borderColor: "#ff6b6b",
        backgroundColor: "rgba(255, 255, 255, 0.92)",
    },
    inputSenha: { height: 46 },
    errorText: {
        color: "#ffe0e0",
        fontSize: 12,
        marginLeft: 8,
        marginBottom: 4,
        marginTop: 2,
    },
    inputWithIconWrapper: {
        width: "100%",
        position: "relative",
        marginBottom: 3,
    },
    inputWithIconPadding: {
        paddingRight: 52,
        marginBottom: 0,
    },
    infoIconAbsolute: {
        position: "absolute",
        right: 16,
        top: 15,
    },
    passwordRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 3,
    },
    passwordInput: {
        flex: 1,
        marginBottom: 0,
    },
    infoIcon: {
        marginLeft: 12,
        marginTop: -2,
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
        marginBottom: 24,
        marginLeft: 6,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: "rgba(255, 255, 255, 0.75)",
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    checkboxChecked: {
        backgroundColor: PRIMARY,
        borderColor: PRIMARY,
    },
    checkboxLabel: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
    },
    button: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: "#6b7a7a",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
    },
    modalDivider: {
        height: 1,
        backgroundColor: "#e0f2f1",
        marginBottom: 16,
    },
    modalButton: {
        backgroundColor: PRIMARY,
        borderRadius: BORDER_RADIUS,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
    },
    modalButtonText: {
        fontSize: 15,
        color: "#FFFFFF",
        fontWeight: "600",
        letterSpacing: 0.3,
    },
    infoModal: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 28,
        width: "100%",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 12,
    },
    infoModalTitle: {
        fontSize: 17,
        color: PRIMARY,
        textAlign: "center",
        marginBottom: 14,
        fontWeight: "600",
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    infoText: {
        fontSize: 14,
        color: "#555",
        flex: 1,
        lineHeight: 21,
    },
    infoTextMuted: {
        fontSize: 12,
        color: "#888",
        lineHeight: 18,
        fontStyle: "italic",
    },
});