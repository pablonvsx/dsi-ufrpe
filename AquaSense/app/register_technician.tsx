import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    Image,
    Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";

import { registerTechnician, parseFirebaseAuthError } from "@/services/auth/register";
import { sendVerificationEmail } from "@/services/emailService";
import {
    validateName,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
} from "@/utils/validators";

interface FormErrors {
    nome?: string;
    email?: string;
    codigoEquipe?: string;
    senha?: string;
    confirmSenha?: string;
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

export default function RegisterTechnician() {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [codigoEquipe, setCodigoEquipe] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmSenha, setConfirmSenha] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);

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
    const codigoEquipeRef = useRef<TextInput>(null);
    const senhaRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    function validateField(field: keyof FormErrors): string | null {
        switch (field) {
            case "nome": return validateName(nome);
            case "email": return validateEmail(email);
            case "codigoEquipe": return codigoEquipe.trim().length < 3 ? "Informe um código válido" : null;
            case "senha": return validatePassword(senha);
            case "confirmSenha": return validateConfirmPassword(senha, confirmSenha);
            default: return null;
        }
    }

    function handleBlur(field: keyof FormErrors) {
        const error = validateField(field);
        setErrors((prev) => ({ ...prev, [field]: error ?? undefined }));
    }

    function validateAll(): boolean {
        const newErrors: FormErrors = {
            nome: validateName(nome) ?? undefined,
            email: validateEmail(email) ?? undefined,
            codigoEquipe: codigoEquipe.trim().length < 3 ? "Informe o código da sua equipe" : undefined,
            senha: validatePassword(senha) ?? undefined,
            confirmSenha: validateConfirmPassword(senha, confirmSenha) ?? undefined,
        };
        setErrors(newErrors);
        return !Object.values(newErrors).some(Boolean);
    }

    async function handleRegister() {
        if (!validateAll()) return;

        setLoading(true);
        try {
            await registerTechnician({ nome, email, senha, codigoEquipe });
            await sendVerificationEmail({ nome, email });

            showAlert(
                "Cadastro realizado!",
                `Enviamos um e-mail de verificação para ${email}.\n\nVerifique sua caixa de entrada e confirme seu e-mail para acessar o AquaSense.`,
                "success",
                () => router.replace("/awaiting-verification" as any)
            );
        } catch (err: any) {
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
                style={styles.gradient}
            >
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
                            CADASTRO DE{"\n"}TÉCNICO AQUASENSE
                        </Text>

                        <View style={styles.formWrapper}>
                            {/* NOME */}
                            <FieldLabel label="Seu nome completo:" fontFamily={questrial} />
                            <TextInput
                                style={[styles.input, { fontFamily: questrial }, errors.nome && styles.inputError]}
                                placeholder="Nome..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={nome}
                                onChangeText={setNome}
                                onBlur={() => handleBlur("nome")}
                                returnKeyType="next"
                                onSubmitEditing={() => emailRef.current?.focus()}
                            />
                            <ErrorText message={errors.nome} fontFamily={questrial} />

                            {/* EMAIL */}
                            <FieldLabel label="E-mail profissional:" fontFamily={questrial} />
                            <TextInput
                                ref={emailRef}
                                style={[styles.input, { fontFamily: questrial }, errors.email && styles.inputError]}
                                placeholder="Email..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={email}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onBlur={() => handleBlur("email")}
                                onChangeText={(t) => setEmail(t.replace(/\s/g, ""))}
                                returnKeyType="next"
                                onSubmitEditing={() => codigoEquipeRef.current?.focus()}
                            />
                            <ErrorText message={errors.email} fontFamily={questrial} />

                            {/* CÓDIGO DA EQUIPE */}
                            <FieldLabel label="Código da Equipe:" fontFamily={questrial} />
                            <TextInput
                                ref={codigoEquipeRef}
                                style={[styles.input, { fontFamily: questrial }, errors.codigoEquipe && styles.inputError]}
                                placeholder="Ex: EQ-01"
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={codigoEquipe}
                                onChangeText={setCodigoEquipe}
                                autoCapitalize="characters"
                                onBlur={() => handleBlur("codigoEquipe")}
                                returnKeyType="next"
                                onSubmitEditing={() => senhaRef.current?.focus()}
                            />
                            <ErrorText message={errors.codigoEquipe} fontFamily={questrial} />

                            {/* SENHA */}
                            <FieldLabel label="Senha:" fontFamily={questrial} />
                            <View style={styles.passwordRow}>
                                <TextInput
                                    ref={senhaRef}
                                    style={[
                                        styles.input,
                                        styles.passwordInput,
                                        { fontFamily: questrial },
                                        errors.senha ? styles.inputError : null,
                                    ]}
                                    placeholder="Sua senha..."
                                    placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                    value={senha}
                                    onChangeText={(text) => {
                                        setSenha(text);
                                        if (errors.senha || errors.confirmSenha) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                senha: validatePassword(text) ?? undefined,
                                                confirmSenha:
                                                    confirmSenha.length > 0
                                                        ? validateConfirmPassword(text, confirmSenha) ?? undefined
                                                        : prev.confirmSenha,
                                            }));
                                        }
                                    }}
                                    secureTextEntry={!showPassword}
                                    onBlur={() => handleBlur("senha")}
                                    returnKeyType="next"
                                    onSubmitEditing={() => confirmRef.current?.focus()}
                                />
                                <TouchableOpacity
                                    style={styles.infoIcon}
                                    onPress={() => setPasswordInfoVisible(true)}
                                    hitSlop={{ top: 10, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="information-circle-outline" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                            <ErrorText message={errors.senha} fontFamily={questrial} />

                            {/* CONFIRMAR SENHA */}
                            <FieldLabel label="Confirme senha:" fontFamily={questrial} />
                            <View style={styles.passwordRow}>
                                <TextInput
                                    ref={confirmRef}
                                    style={[
                                        styles.input,
                                        styles.passwordInput,
                                        { fontFamily: questrial },
                                        errors.confirmSenha ? styles.inputError : null,
                                    ]}
                                    placeholder="Confirme sua senha..."
                                    placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                    value={confirmSenha}
                                    onChangeText={(text) => {
                                        setConfirmSenha(text);
                                        if (errors.confirmSenha) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                confirmSenha:
                                                    validateConfirmPassword(senha, text) ?? undefined,
                                            }));
                                        }
                                    }}
                                    secureTextEntry={!showPassword}
                                    onBlur={() => handleBlur("confirmSenha")}
                                    returnKeyType="done"
                                />
                                <TouchableOpacity
                                    style={styles.infoIcon}
                                    onPress={() => setPasswordInfoVisible(true)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="information-circle-outline" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                            <ErrorText message={errors.confirmSenha} fontFamily={questrial} />

                            {/* MOSTRAR SENHA */}
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setShowPassword((v) => !v)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, showPassword && styles.checkboxChecked]}>
                                    {showPassword && (
                                        <Ionicons name="checkmark" size={13} color="#fff" />
                                    )}
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
                                    <Text style={[styles.buttonText, { fontFamily: questrial }]}>CADASTRAR</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* MODAL INFO SENHA */}
                <Modal visible={passwordInfoVisible} transparent animationType="fade">
                    <Pressable style={styles.modalOverlay} onPress={() => setPasswordInfoVisible(false)}>
                        <Pressable style={styles.infoModal} onPress={(e) => e.stopPropagation()}>
                            <Text style={[styles.infoModalTitle, { fontFamily: questrial }]}>Critérios da senha</Text>
                            <View style={styles.modalDivider} />
                            {["Mínimo 8 caracteres", "1 Letra maiúscula", "1 Número", "1 Caractere especial"].map((item, i) => (
                                <View key={i} style={styles.infoRow}>
                                    <Ionicons name="checkmark-circle" size={16} color="#004d48" style={{ marginRight: 10 }} />
                                    <Text style={[styles.infoText, { fontFamily: questrial }]}>{item}</Text>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.modalButton} onPress={() => setPasswordInfoVisible(false)}>
                                <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>Entendi</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* CUSTOM ALERT */}
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

function FieldLabel({ label, fontFamily }: { label: string; fontFamily?: string }) {
    return <Text style={[styles.fieldLabel, { fontFamily }]}>{label}</Text>;
}

function ErrorText({ message, fontFamily }: { message?: string; fontFamily?: string }) {
    if (!message) return null;
    return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

const PRIMARY = "#004d48";
const BORDER_RADIUS = 50;

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gradient: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 36,
        paddingTop: Platform.OS === "android" ? 48 : 60,
        paddingBottom: 40,
        alignItems: "center",
    },
    logoContainer: { marginBottom: 8 },
    logoImage: { width: 180, height: 180 },
    title: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
        letterSpacing: 1.5,
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 26,
    },
    formWrapper: { width: "100%" },
    fieldLabel: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 5,
        marginLeft: 6,
    },
    input: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 50,
        paddingHorizontal: 20,
        fontSize: 14,
        color: "#6b7a7a",
        borderWidth: 1.5,
        borderColor: "transparent",
        marginBottom: 2,
    },
    inputError: { borderColor: "#ff6b6b" },
    errorText: { color: "#ffe0e0", fontSize: 11, marginLeft: 8, marginBottom: 6 },
    passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
    passwordInput: { flex: 1, marginBottom: 0 },
    infoIcon: { marginLeft: 10, marginTop: -2 },
    checkboxRow: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 20, marginLeft: 6 },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: "rgba(255, 255, 255, 0.75)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    checkboxLabel: { color: "rgba(255, 255, 255, 0.9)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
    button: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
    },
    buttonText: { color: "#6b7a7a", fontSize: 15, fontWeight: "700", letterSpacing: 2 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
    modalDivider: { height: 1, backgroundColor: "#e0f2f1", marginBottom: 16 },
    infoModal: { backgroundColor: "#fff", borderRadius: 20, padding: 28, width: "100%" },
    infoModalTitle: { fontSize: 17, color: PRIMARY, textAlign: "center", marginBottom: 14, fontWeight: "600" },
    infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    infoText: { fontSize: 13, color: "#555", flex: 1 },
    modalButton: { backgroundColor: PRIMARY, borderRadius: BORDER_RADIUS, paddingVertical: 14, alignItems: "center", marginTop: 8 },
    modalButtonText: { color: "#FFFFFF", fontWeight: "600" },
});