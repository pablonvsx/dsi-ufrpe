import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    FlatList,
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
import { sendVerificationEmail } from "@/services/emailService";
import { registerCommonUser, parseFirebaseAuthError } from "@/services/auth/register";
import {
    validateName,
    validateEmail,
    validateCity,
    validatePassword,
    validateConfirmPassword,
} from "@/utils/validators";
import { pernambucoCities } from "@/utils/pernambucoCities";

// ---------------------------------------------------------------------------
// NOTA SOBRE FONTE (para equipe):
// A fonte Questrial renderiza de forma diferente entre iOS e Android quando o
// texto está em CAPS LOCK — no Android os caracteres ficam mais condensados e
// o espaçamento entre letras varia. Isso é comportamento nativo do sistema de
// renderização de texto (Skia no Android vs CoreText no iOS) e não tem solução
// simples sem trocar a fonte. Por ora mantemos assim e deixamos documentado.
// ---------------------------------------------------------------------------

interface FormErrors {
    nome?: string;
    email?: string;
    cidade?: string;
    senha?: string;
    confirmSenha?: string;
}

// ---------------------------------------------------------------------------
// Modal customizado que substitui o Alert nativo
// O Alert padrão no Android é muito quadrado e visualmente inconsistente.
// Este componente mantém o visual do app nos dois sistemas.
// ---------------------------------------------------------------------------
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
                <Pressable
                    style={alertStyles.box}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Ícone */}
                    <View style={alertStyles.iconWrapper}>
                        <Ionicons name={iconName as any} size={48} color={iconColor} />
                    </View>

                    {/* Título */}
                    <Text style={[alertStyles.title, { fontFamily }]}>{title}</Text>

                    {/* Divisor */}
                    <View style={alertStyles.divider} />

                    {/* Mensagem */}
                    <Text style={[alertStyles.message, { fontFamily }]}>{message}</Text>

                    {/* Botão */}
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
    iconWrapper: {
        marginBottom: 14,
    },
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

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export default function RegisterCommon() {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [cidade, setCidade] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmSenha, setConfirmSenha] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);

    const [cityModalVisible, setCityModalVisible] = useState(false);
    const [passwordInfoVisible, setPasswordInfoVisible] = useState(false);
    const [citySearch, setCitySearch] = useState("");

    // Estados do CustomAlert (substitui Alert nativo)
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
    const senhaRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    function validateField(field: keyof FormErrors): string | null {
        switch (field) {
            case "nome":
                return validateName(nome);
            case "email":
                return validateEmail(email);
            case "cidade":
                return validateCity(cidade);
            case "senha":
                return validatePassword(senha);
            case "confirmSenha":
                return validateConfirmPassword(senha, confirmSenha);
            default:
                return null;
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
            cidade: validateCity(cidade) ?? undefined,
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
            await registerCommonUser({ nome, email, cidade, senha });
            await sendVerificationEmail({ nome, email });

            // Substituímos o Alert nativo pelo CustomAlert para uniformidade iOS/Android
            showAlert(
                "Cadastro realizado!",
                `Enviamos um e-mail de verificação para ${email}.\n\nVerifique sua caixa de entrada e confirme seu e-mail para acessar o AquaSense.`,
                "success",
                () => router.replace("/awaiting-verification")
            );
        } catch (err: any) {
            console.log("ERRO:", err?.code, err?.message);

            if (
                err?.message?.includes("TOO_MANY_ATTEMPTS_TRY_LATER") ||
                err?.code === "auth/too-many-requests"
            ) {
                showAlert(
                    "Muitas tentativas",
                    "O Firebase bloqueou temporariamente. Espere alguns minutos e tente novamente.",
                    "warning"
                );
            } else if (err?.code?.startsWith("auth/")) {
                showAlert("Erro no cadastro", parseFirebaseAuthError(err.code), "error");
            } else {
                showAlert(
                    "Erro no envio do e-mail",
                    err?.message ??
                        "O cadastro foi realizado, mas o e-mail de verificação não pôde ser enviado. Tente novamente.",
                    "warning"
                );
            }
        } finally {
            setLoading(false);
        }
    }

    const cities: string[] = Array.isArray(pernambucoCities) ? pernambucoCities : [];
    const filteredCities = cities.filter((c) =>
        c.toLowerCase().includes(citySearch.toLowerCase())
    );

    function selectCity(city: string) {
        setCidade(city);
        setErrors((prev) => ({ ...prev, cidade: undefined }));
        setCityModalVisible(false);
        setCitySearch("");
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
                <StatusBar
                    barStyle="light-content"
                    translucent
                    backgroundColor="transparent"
                />

                {/* ── BOTÃO DE VOLTAR ─────────────────────────────────────────────────
                    Necessário especialmente no Android, onde não existe o swipe-back
                    nativo como no iOS. Posicionado em absolute para não empurrar layout.
                ──────────────────────────────────────────────────────────────────── */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>

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
                                style={[
                                    styles.input,
                                    { fontFamily: questrial },
                                    errors.nome ? styles.inputError : null,
                                ]}
                                placeholder="Nome..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={nome}
                                onChangeText={(text) => {
                                    setNome(text);
                                    if (errors.nome) {
                                        setErrors((prev) => ({
                                            ...prev,
                                            nome: validateName(text) ?? undefined,
                                        }));
                                    }
                                }}
                                onBlur={() => handleBlur("nome")}
                                maxLength={80}
                                returnKeyType="next"
                                onSubmitEditing={() => emailRef.current?.focus()}
                            />
                            <ErrorText message={errors.nome} fontFamily={questrial} />

                            {/* EMAIL */}
                            <FieldLabel label="Seu Email:" fontFamily={questrial} />
                            <TextInput
                                ref={emailRef}
                                style={[
                                    styles.input,
                                    { fontFamily: questrial },
                                    errors.email ? styles.inputError : null,
                                ]}
                                placeholder="Email..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={email}
                                onBlur={() => handleBlur("email")}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onChangeText={(t) => {
                                    const sanitized = t.replace(/\s/g, "");
                                    setEmail(sanitized);
                                    if (errors.email) {
                                        setErrors((prev) => ({
                                            ...prev,
                                            email: validateEmail(sanitized) ?? undefined,
                                        }));
                                    }
                                }}
                                returnKeyType="next"
                                onSubmitEditing={() => senhaRef.current?.focus()}
                            />
                            <ErrorText message={errors.email} fontFamily={questrial} />

                            {/* CIDADE */}
                            <FieldLabel label="Cidade:" fontFamily={questrial} />
                            <TouchableOpacity
                                style={[
                                    styles.input,
                                    styles.selectRow,
                                    errors.cidade ? styles.inputError : null,
                                ]}
                                onPress={() => setCityModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.selectText,
                                        !cidade && styles.placeholderText,
                                        { fontFamily: questrial },
                                    ]}
                                >
                                    {cidade || "Selecione sua cidade..."}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={20}
                                    color="rgba(255,255,255,0.7)"
                                />
                            </TouchableOpacity>
                            <ErrorText message={errors.cidade} fontFamily={questrial} />

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
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={24}
                                        color="#FFFFFF"
                                    />
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
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={24}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </View>
                            <ErrorText message={errors.confirmSenha} fontFamily={questrial} />

                            {/* MOSTRAR SENHA */}
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setShowPassword((v) => !v)}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.checkbox,
                                        showPassword && styles.checkboxChecked,
                                    ]}
                                >
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
                                    <Text style={[styles.buttonText, { fontFamily: questrial }]}>
                                        CADASTRAR
                                    </Text>
                                )}
                            </TouchableOpacity>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* ── MODAL CIDADES ──────────────────────────────────────────────────── */}
                <Modal
                    visible={cityModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setCityModalVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setCityModalVisible(false)}
                    >
                        <Pressable
                            style={styles.cityModal}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text style={[styles.cityModalTitle, { fontFamily: questrial }]}>
                                Selecione a cidade
                            </Text>
                            <View style={styles.modalDivider} />
                            <TextInput
                                style={[styles.citySearch, { fontFamily: questrial }]}
                                placeholder="Buscar cidade..."
                                placeholderTextColor="#aaa"
                                value={citySearch}
                                onChangeText={setCitySearch}
                                autoFocus
                            />
                            <FlatList
                                data={filteredCities}
                                keyExtractor={(item) => item}
                                showsVerticalScrollIndicator
                                style={styles.cityList}
                                nestedScrollEnabled
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.cityItem}
                                        onPress={() => selectCity(item)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.cityItemText,
                                                { fontFamily: questrial },
                                            ]}
                                        >
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => (
                                    <View style={styles.citySeparator} />
                                )}
                                ListEmptyComponent={
                                    <Text style={[styles.emptyText, { fontFamily: questrial }]}>
                                        Nenhuma cidade encontrada
                                    </Text>
                                }
                            />
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setCityModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.modalCloseButtonText,
                                        { fontFamily: questrial },
                                    ]}
                                >
                                    Fechar
                                </Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* ── MODAL INFO SENHA ───────────────────────────────────────────────── */}
                <Modal
                    visible={passwordInfoVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setPasswordInfoVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setPasswordInfoVisible(false)}
                    >
                        <Pressable
                            style={styles.infoModal}
                            onPress={(e) => e.stopPropagation()}
                        >
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
                                    <Text style={[styles.infoText, { fontFamily: questrial }]}>
                                        {item}
                                    </Text>
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

                {/* ── CUSTOM ALERT (substitui Alert nativo — igual em iOS e Android) ─── */}
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

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
function FieldLabel({ label, fontFamily }: { label: string; fontFamily?: string }) {
    return <Text style={[styles.fieldLabel, { fontFamily }]}>{label}</Text>;
}

function ErrorText({ message, fontFamily }: { message?: string; fontFamily?: string }) {
    if (!message) return null;
    return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const PRIMARY = "#004d48";
const BORDER_RADIUS = 50;

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gradient: { flex: 1 },

    // ── Botão de voltar ──────────────────────────────────────────────────────
    // position: absolute para não afetar o layout do ScrollView.
    // O paddingTop compensa a StatusBar em Android (translucent).
    backButton: {
        position: "absolute",
        top: Platform.OS === "android" ? 52 : 60,
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
        // Aumentamos o paddingTop para dar espaço ao botão de voltar
        paddingTop: Platform.OS === "android" ? 96 : 104,
        paddingBottom: 40,
        alignItems: "center",
    },

    logoContainer: { marginBottom: 10 },

    logoImage: {
        width: 180,
        height: 180,
    },

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

    errorText: {
        color: "#ffe0e0",
        fontSize: 12,
        marginLeft: 8,
        marginBottom: 4,
        marginTop: 2,
    },

    selectRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingRight: 16,
    },

    selectText: {
        fontSize: 15,
        color: "#6b7a7a",
        flex: 1,
    },

    placeholderText: {
        color: "rgba(107, 122, 122, 0.6)",
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

    cityModal: {
        backgroundColor: "#fff",
        borderRadius: 20,
        width: "100%",
        maxHeight: "72%",
        paddingTop: 22,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 12,
    },

    cityModalTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: PRIMARY,
        textAlign: "center",
        marginBottom: 14,
        paddingHorizontal: 20,
    },

    citySearch: {
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 20,
        backgroundColor: "#f4f4f4",
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        color: "#333",
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },

    cityList: {
        flexGrow: 0,
        height: 280,
    },

    cityItem: {
        paddingVertical: 15,
        paddingHorizontal: 22,
    },

    cityItemText: {
        fontSize: 15,
        color: "#555",
    },

    citySeparator: {
        height: 1,
        backgroundColor: "#f0f0f0",
        marginLeft: 22,
    },

    emptyText: {
        textAlign: "center",
        color: "#aaa",
        fontSize: 14,
        paddingVertical: 20,
    },

    modalCloseButton: {
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 18,
        backgroundColor: PRIMARY,
        borderRadius: BORDER_RADIUS,
        paddingVertical: 14,
        alignItems: "center",
    },

    modalCloseButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 15,
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
        alignItems: "center",
        marginBottom: 12,
    },

    infoText: {
        fontSize: 14,
        color: "#555",
        flex: 1,
        lineHeight: 21,
    },
});
