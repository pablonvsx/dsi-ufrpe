import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    Image,
    ScrollView,
    Modal,
    Pressable,
    Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "@/services/emailService";
import { auth, db } from "@/config/firebase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // ── Modal de erro (substitui Alert.alert) ──────────────────────────────
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorModalTitle, setErrorModalTitle] = useState("");
    const [errorModalMessage, setErrorModalMessage] = useState("");

    function showError(title: string, message: string) {
        setErrorModalTitle(title);
        setErrorModalMessage(message);
        setErrorModalVisible(true);
    }
    // ───────────────────────────────────────────────────────────────────────

    const [forgotModalVisible, setForgotModalVisible] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);

    const senhaRef = useRef<TextInput>(null);

    const logoFade = useRef(new Animated.Value(0)).current;
    const logoTranslate = useRef(new Animated.Value(18)).current;
    const formFade = useRef(new Animated.Value(0)).current;
    const formTranslate = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(logoFade, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(logoTranslate, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]).start();

        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(formFade, { toValue: 1, duration: 900, useNativeDriver: true }),
                Animated.timing(formTranslate, { toValue: 0, duration: 900, useNativeDriver: true }),
            ]).start();
        }, 150);

        return () => clearTimeout(timer);
    }, [logoFade, logoTranslate, formFade, formTranslate]);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    async function handleLogin() {
        const emailTrimmed = email.trim();

        if (!emailTrimmed || !senha) {
            // ── era: Alert.alert("Campos obrigatórios", "...") ──
            showError(
                "Campos obrigatórios",
                "Preencha o e-mail e a senha para continuar."
            );
            return;
        }

        setLoading(true);
        try {
            const credential = await signInWithEmailAndPassword(auth, emailTrimmed, senha);
            const user = credential.user;

            await user.reload();

            if (!user.emailVerified) {
                await auth.signOut();
                // ── era: Alert.alert("E-mail não verificado", "...") ──
                showError(
                    "E-mail não verificado",
                    "Você precisa verificar seu e-mail antes de acessar o AquaSense.\n\nAcesse sua caixa de entrada e clique no link de confirmação que enviamos."
                );
                return;
            }

            const docSnap = await getDoc(doc(db, "usuarios", user.uid));
            const userData = docSnap.exists() ? docSnap.data() : null;
            const tipoUsuario = userData?.tipoUsuario ?? "comum";

            if (tipoUsuario === "comum") {
                const jaViuTutorial = userData?.hasSeenTutorial === true;
                router.replace(jaViuTutorial ? "/(tabs)" : "/(tabs)?tutorial=1" as any);
            } else {
                // colaborador, tecnico, gestor
                router.replace("/under-development" as any);
            }

        } catch (err: any) {
            const msg = parseLoginError(err?.code, email.trim());
            // ── era: Alert.alert("Erro ao entrar", msg) ──
            showError("Erro ao entrar", msg);
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotPassword() {
        const emailTrimmed = forgotEmail.trim();

        if (!emailTrimmed) {
            // ── era: Alert.alert("Campo obrigatório", "...") ──
            showError("Campo obrigatório", "Informe seu e-mail para continuar.");
            return;
        }

        setForgotLoading(true);
        try {
            await sendPasswordResetEmail({ email: emailTrimmed });
            setForgotSent(true);
        } catch (err: any) {
            const msg = parseForgotError(err?.code);
            // ── era: Alert.alert("Erro", msg) ──
            showError("Erro", msg);
        } finally {
            setForgotLoading(false);
        }
    }

    function handleCloseForgotModal() {
        setForgotModalVisible(false);
        setForgotEmail("");
        setForgotSent(false);
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

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Animated.View
                            style={{
                                opacity: logoFade,
                                transform: [{ translateY: logoTranslate }],
                            }}
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
                                CONECTE-SE AO{"\n"}AQUASENSE
                            </Text>
                        </Animated.View>

                        <Animated.View
                            style={{
                                opacity: formFade,
                                transform: [{ translateY: formTranslate }],
                                width: "100%",
                            }}
                        >
                            <View style={styles.formWrapper}>
                                <FieldLabel label="Seu Email:" fontFamily={questrial} />
                                <TextInput
                                    style={[styles.input, { fontFamily: questrial }]}
                                    placeholder="Email..."
                                    placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                    value={email}
                                    onChangeText={(t) => setEmail(t.replace(/\s/g, ""))}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => senhaRef.current?.focus()}
                                />

                                <FieldLabel label="Senha:" fontFamily={questrial} />
                                <TextInput
                                    ref={senhaRef}
                                    style={[styles.input, { fontFamily: questrial }]}
                                    placeholder="Sua senha..."
                                    placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                    value={senha}
                                    onChangeText={setSenha}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                />

                                <TouchableOpacity
                                    style={styles.forgotButton}
                                    onPress={() => {
                                        if (email.trim()) setForgotEmail(email.trim());
                                        setForgotModalVisible(true);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.forgotText, { fontFamily: questrial }]}>
                                        Esqueceu a senha?
                                    </Text>
                                </TouchableOpacity>

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

                                <TouchableOpacity
                                    style={styles.button}
                                    onPress={handleLogin}
                                    activeOpacity={0.85}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#004d48" />
                                    ) : (
                                        <Text style={[styles.buttonText, { fontFamily: questrial }]}>
                                            CONECTAR
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.footer}>
                                <Text style={[styles.footerText, { fontFamily: questrial }]}>
                                    Não tem conta?{" "}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => router.push("/select_user_type" as any)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.footerLink, { fontFamily: questrial }]}>
                                        Cadastre-se
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* ── MODAL DE ERRO (substitui Alert.alert) ─────────────────────────── */}
                <Modal
                    visible={errorModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setErrorModalVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setErrorModalVisible(false)}
                    >
                        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                            <Ionicons
                                name="alert-circle-outline"
                                size={48}
                                color="#004d48"
                                style={{ alignSelf: "center", marginBottom: 16 }}
                            />
                            <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                                {errorModalTitle}
                            </Text>
                            <View style={styles.modalDivider} />
                            <Text style={[styles.modalDescription, { fontFamily: questrial }]}>
                                {errorModalMessage}
                            </Text>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setErrorModalVisible(false)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>
                                    Entendi
                                </Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>
                {/* ─────────────────────────────────────────────────────────────────── */}

                {/* MODAL ESQUECI A SENHA */}
                <Modal
                    visible={forgotModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={handleCloseForgotModal}
                >
                    <Pressable style={styles.modalOverlay} onPress={handleCloseForgotModal}>
                        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                            {forgotSent ? (
                                <>
                                    <Ionicons
                                        name="mail-outline"
                                        size={48}
                                        color="#004d48"
                                        style={{ alignSelf: "center", marginBottom: 16 }}
                                    />
                                    <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                                        E-mail enviado!
                                    </Text>
                                    <View style={styles.modalDivider} />
                                    <Text style={[styles.modalDescription, { fontFamily: questrial }]}>
                                        Enviamos um link de redefinição para{"\n"}
                                        <Text style={{ fontWeight: "700", color: "#004d48" }}>
                                            {forgotEmail.trim()}
                                        </Text>
                                        {"\n\n"}Verifique sua caixa de entrada e siga as instruções.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.modalButton}
                                        onPress={handleCloseForgotModal}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>
                                            Entendi
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                                        Recuperar senha
                                    </Text>
                                    <View style={styles.modalDivider} />
                                    <Text style={[styles.modalDescription, { fontFamily: questrial }]}>
                                        Informe seu e-mail cadastrado e enviaremos um link para você redefinir sua senha.
                                    </Text>
                                    <TextInput
                                        style={[styles.modalInput, { fontFamily: questrial }]}
                                        placeholder="Seu e-mail..."
                                        placeholderTextColor="#aaa"
                                        value={forgotEmail}
                                        onChangeText={(t) => setForgotEmail(t.replace(/\s/g, ""))}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoFocus
                                    />
                                    <TouchableOpacity
                                        style={styles.modalButton}
                                        onPress={handleForgotPassword}
                                        activeOpacity={0.85}
                                        disabled={forgotLoading}
                                    >
                                        {forgotLoading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>
                                                ENVIAR LINK
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalCancelButton}
                                        onPress={handleCloseForgotModal}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.modalCancelText, { fontFamily: questrial }]}>
                                            Cancelar
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </Pressable>
                    </Pressable>
                </Modal>

            </LinearGradient>
        </>
    );
}

function FieldLabel({ label, fontFamily }: { label: string; fontFamily?: string }) {
    return <Text style={[styles.fieldLabel, { fontFamily }]}>{label}</Text>;
}

function parseLoginError(code?: string, emailInput?: string): string {
    switch (code) {
        case "auth/user-not-found":
            return `O e-mail${emailInput ? ` "${emailInput}"` : ""} não está cadastrado. Cadastre-se para continuar.`;
        case "auth/wrong-password":
            return "Senha incorreta. Verifique e tente novamente.";
        case "auth/invalid-credential":
            return "E-mail ou senha incorretos. Verifique os dados ou cadastre-se caso não tenha conta.";
        case "auth/invalid-email":
            return "O e-mail informado não é válido.";
        case "auth/user-disabled":
            return "Esta conta foi desativada. Entre em contato com o suporte.";
        case "auth/too-many-requests":
            return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
        case "auth/network-request-failed":
            return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
        default:
            return "Não foi possível entrar. Tente novamente.";
    }
}

function parseForgotError(code?: string): string {
    switch (code) {
        case "auth/user-not-found":
            return "Nenhuma conta encontrada com este e-mail.";
        case "auth/invalid-email":
            return "O e-mail informado não é válido.";
        case "auth/too-many-requests":
            return "Muitas tentativas. Aguarde alguns minutos.";
        case "auth/network-request-failed":
            return "Sem conexão com a internet. Verifique sua rede.";
        default:
            return "Não foi possível enviar o e-mail. Tente novamente.";
    }
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
        justifyContent: "center",
    },
    logoContainer: { marginBottom: 8 },
    logoImage: { width: 180, height: 180 },
    title: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
        letterSpacing: 1.5,
        textAlign: "center",
        marginBottom: 32,
        lineHeight: 26,
    },
    formWrapper: { width: "100%" },
    fieldLabel: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 5,
        marginLeft: 6,
        letterSpacing: 0.3,
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
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    forgotButton: {
        alignSelf: "flex-end",
        marginTop: -6,
        marginBottom: 18,
        marginRight: 6,
        paddingVertical: 4,
    },
    forgotText: {
        fontSize: 12,
        color: "rgba(255, 255, 255, 0.75)",
        textDecorationLine: "underline",
        letterSpacing: 0.2,
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
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
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },
    button: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 52,
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
        fontSize: 15,
        fontWeight: "700",
        letterSpacing: 2,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 28,
    },
    footerText: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.72)",
    },
    footerLink: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
        textDecorationLine: "underline",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
    },
    modalCard: {
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
    modalTitle: {
        fontSize: 17,
        color: PRIMARY,
        textAlign: "center",
        marginBottom: 14,
        fontWeight: "600",
    },
    modalDivider: {
        height: 1,
        backgroundColor: "#e0f2f1",
        marginBottom: 16,
    },
    modalDescription: {
        fontSize: 14,
        color: "#555",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 20,
    },
    modalInput: {
        backgroundColor: "#f4f4f4",
        borderRadius: BORDER_RADIUS,
        height: 48,
        paddingHorizontal: 20,
        fontSize: 14,
        color: "#333",
        borderWidth: 1,
        borderColor: "#e0e0e0",
        marginBottom: 16,
    },
    modalButton: {
        backgroundColor: PRIMARY,
        borderRadius: BORDER_RADIUS,
        paddingVertical: 14,
        alignItems: "center",
    },
    modalButtonText: {
        fontSize: 14,
        color: "#fff",
        fontWeight: "700",
        letterSpacing: 1,
    },
    modalCancelButton: {
        paddingVertical: 12,
        alignItems: "center",
    },
    modalCancelText: {
        fontSize: 13,
        color: "#888",
        textDecorationLine: "underline",
    },
});