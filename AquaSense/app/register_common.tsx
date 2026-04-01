import React, { useState, useRef } from 'react';
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
    Alert,
    StatusBar,
    Image,

} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { registerCommonUser, parseFirebaseAuthError } from "@/services/auth/register";
import {
    validateName,
    validateEmail, 
    validateCity,
    validatePassword,
    validateConfirmPassword,
} from "@/utils/validators";
import { pernambucoCities } from "@/utils/pernambucoCities";

// Types
interface FormErrors {
    nome?: string;
    email?: string;
    cidade?: string;
    senha?: string;
    confirmSenha?: string;
}
   
        
// Componentes 
export default function RegisterCommon() {
// Estados de formulário
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [cidade, setCidade] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmSenha, setConfirmSenha] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);

    // UI state
    const [cityModalVisible, setCityModalVisible] = useState(false);
    const [passwordInfoVisible, setPasswordInfoVisible] = useState(false);
    const [citySearch, setCitySearch] = useState("");

    const emailRef = useRef<TextInput>(null);
    const senhaRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    // Validação e registro
    function validateField(field: keyof FormErrors, value?: string): string | null {
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
            Alert.alert(
                "Cadastro realizado!",
                "Enviamos um e-mail de verificação para " + 
                email + 
                ".\n\nVerifique sua caixa de entrada e confirme seu e-mail para acessar o AquaSense.",
                [
                    {
                        text: "Entendi",
                        onPress: () => {
                         // navegar para o home do usuário comum 
                         // assim que o e-mail for verificado
                         router.back();   
                        }
                    },
                ]
            );
        } catch (err: any) {
            const code: string = err?.code ?? "";
            const message = parseFirebaseAuthError(code);
            Alert.alert("Erro no cadastro", message)
        }   finally {
            setLoading(false);
        }
    }
    
    // Seleção da cidade
    const filteredCities = pernambucoCities.filter((c) =>
    c.toLowerCase(). includes(citySearch.toLowerCase()));

    function selectCity(city: string) {
        setCidade(city);
        setErrors((prev) => ({ ...prev, cidade: undefined}));
        setCityModalVisible(false);
        setCitySearch("");   
    }

    return (
        <LinearGradient
            colors={["#0D5C52", "#0D8C78", "#12B899", "#4ED8C0" ]}
            locations={[0, 0.3, 0.65, 1]}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" />
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
                        <AquaSenseLogo />
                    </View>

                    <Text style={styles.tittle}> CADASTRE-SE NO {"\n"} AQUASENSE</Text>

                    <View style={styles.formWrapper}>
                        <FieldLabel label="Seu nome: " />
                        <TextInput
                            style={[styles.input, errors.nome ? styles.inputError : null]}
                            placeholder="Nome..."
                            placeholderTextColor="rgba(255, 255, 255, 0.78)"
                            value={nome}
                            onChangeText={setNome}
                            onBlur={() => handleBlur("nome")}
                            maxLength={80}
                            returnKeyType="next"
                            onSubmitEditing={() => emailRef.current?.focus()}
                        />
                        <ErrorText message={errors.nome} />


                        <FieldLabel label="Seu Email:" />
                        <TextInput
                            style={[styles.input, errors.email ? styles.inputError : null]}
                            placeholder="Email..."
                            placeholderTextColor="rgba(255, 255, 255, 0.78)"
                            value={email}
                            onBlur={() => handleBlur("email")}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onChangeText={(t) => setEmail(t.replace(/\s/g, ""))}
                            returnKeyType="next"
                            onSubmitEditing={() => senhaRef.current?.focus()}
                        />
                        <ErrorText message={errors.email} />
                        
                        <FieldLabel label="Cidade:" />
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
                                ]}
                            >
                                {cidade || "Selecione sua cidade..."}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="rgba(255, 255, 255, 0.78)" />
                        </TouchableOpacity>
                        <ErrorText message={errors.cidade} />

                        <FieldLabel label="Senha:" />
                        <View style={styles.passwordRow}>
                            <TextInput
                                ref={senhaRef}
                                style={[
                                    styles.input,
                                    styles.passwordInput,
                                    errors.senha ? styles.inputError : null,
                                ]}

                                placeholder="Senha..."
                                placeholderTextColor="rgba(255, 255, 255, 0.78)"
                                value={senha}
                                onChangeText={setSenha}
                                secureTextEntry={!showPassword}
                                onBlur={() => handleBlur("senha")}
                                onFocus={() => setPasswordInfoVisible(true)}
                                returnKeyType="next"
                                onSubmitEditing={() => confirmRef.current?.focus()}

                            />
                            <TouchableOpacity
                                style={styles.infoIcon}
                                onPress={() => setPasswordInfoVisible(true)}
                                hitSlop={{ top: 10, bottom: 8, left: 8, right: 8}}
                            >
                                <Ionicons
                                    name="information-circle-outline"
                                    size={22}
                                    color="rgba(255, 255, 255, 0.80)"
                                />
                            </TouchableOpacity>
                        </View>
                        <ErrorText message={errors.senha} />

                        <FieldLabel label="Confirme senha:" />
                        <View style={styles.passwordRow}>
                            <TextInput
                                ref={confirmRef}
                                style={[
                                    styles.input,
                                    styles.passwordInput,
                                    errors.confirmSenha ? styles.inputError : null,
                                ]}
                                placeholder="Confirme sua senha..."
                                placeholderTextColor="rgba(255, 255, 255, 0.78)"
                                value={confirmSenha}
                                onChangeText={setConfirmSenha}
                                secureTextEntry={!showPassword}
                                onBlur={() => handleBlur("confirmSenha")}
                                returnKeyType="done"
                            />
                            <TouchableOpacity
                                style={styles.infoIcon}
                                onPress={() => setPasswordInfoVisible(true)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8}}
                            >
                                <Ionicons
                                    name="information-circle-outline"
                                    size={22}
                                    color="rgba(255, 255, 255, 0.80)"
                                />
                            </TouchableOpacity>
                        </View>
                        <ErrorText message={errors.confirmSenha} />

                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setShowPassword((v) => !v)}
                            activeOpacity={0.7}
                        >
                            <View
                                style={[styles.checkbox, showPassword && styles.checkboxChecked]}
                            >
                                {showPassword && (
                                <Ionicons name="checkmark" size={13} color="#fff" />
                                )}
                            </View>
                            <Text style={styles.checkboxLabel}>Mostrar senha</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleRegister}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Cadastrar</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                visible={cityModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCityModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setCityModalVisible(false)}
                >
                    <View style={styles.cityModal}>
                        <Text style={styles.cityModalTitle}>Selecione a cidade</Text>
                        <TextInput
                            style={styles.citySearch}
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
                            indicatorStyle="black"
                            style={styles.cityList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.cityItem}
                                    onPress={() => selectCity(item)}
                                > 
                                    <Text style={styles.cityItemText} >{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={passwordInfoVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPasswordInfoVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setPasswordInfoVisible(false)}
                >
                    <View style={styles.infoModal}>
                        <View style={styles.infoModalHeader}>
                            <Ionicons name="lock-closed" size={20} color="#OD8C78" />
                            <Text style={styles.infoModalTitle}>Critérios da senha</Text>
                        </View>
                        {[
                            { icon: "checkmark-circle", text: "Mínimo de 8 caracteres" },
                            { icon: "checkmark-circle", text: "Pelo menos 1 letra maiúscula" },
                            { icon: "checkmark-circle", text: "Pelo menos 1 número" },
                            {
                                icon: "checkmarck-circle",
                                text: "Pelo menos 1 caractere especial (!@#$...)",
                            },

                        ].map((item, i) => (
                            <View key={i} style={styles.infoRow}>
                                <Ionicons
                                    name={item.icon as any}
                                    size={16}
                                    color="#0D8C78"
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={styles.infoText}>{item.text}</Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.infoClose}
                            onPress={() => setPasswordInfoVisible(false)}
                        >
                            <Text style={styles.infoCloseText}>Entendi</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </LinearGradient>
    );
}

                
            

                    


function FieldLabel({ label }: { label?: string }) {
    return <Text style={styles.fieldLabel}>{label}</Text>;
}

function ErrorText({ message }: {message?: string }) {
    if (!message) return null;
    return <Text style={styles.errorText}>{message}</Text>;

}

function AquaSenseLogo() {
    return (
        <View style={styles.logoWrapper}>
            <Image
                source={require("@assets/images/aquasense-logo.pnsg ")}
                style={styles.logoImage}
                resizeMode="contain"
            />
        </View>
    );
}

const TEAL = "#0D8C78";
const INPUT_BG = "rgba(255, 255, 255, 0.78)";
const BORDER_RADIUS = 25;

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gradient: { flex: 1 },

    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingBottom: 40,
        alignItems: "center",
    },

    logoContainer: { marginBottom: 10 },
    logoWrapper: { alignItems: "center" },
    logoIconOuter: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 2.5,
        borderColor: "rgba(255, 255, 255, 0.7)",
        alignItems: "center",
        justifyContent: "center",
    },
    logoIconInner: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.9)",
        borderTopWidth: 6,
        transform: [{ rotate: "45deg" }],
    },
    logoText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 3,
        marginTop: 5,
    },
    logoImage: {
        width: 300,
        height: 300,
        marginBottom: 0,
    },
    tittle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 1.5,
        textAlign: "center",
        marginTop: 4,
        marginBottom: 22,
        lineHeight: 26,
    },

    formWrapper: { width: "100%" },
    fieldLabel: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 4,
        marginLeft: 4,
        letterSpacing: 0.3,
    },

    input: {
        backgroundColor: INPUT_BG,
        borderRadius: BORDER_RADIUS,
        height: 46,
        paddingHorizontal: 18,
        fontSize: 14,
        color: "#1a2e2a",
        borderWidth: 1.5,
        borderColor: "transparent",
        marginBottom: 2,
    },

    inputError: {
        borderColor: "#ff6b6b",
        backgroundColor: "rgba(255, 107, 107, 0.96)",
    },
    errorText: {
        color: "#ffe0e0",
        fontSize: 11,
        marginLeft: 6,
        marginBottom: 6,
        marginTop: 1,
    },

    selectRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingRight: 14,
    },
    selectText: { fontSize: 14, color: "#1a2e2a", flex: 1 },
    placeholderText: { color: "#aac" },
    
    
    passwordRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 2,
    },
    passwordInput: {
        flex: 1,
        marginBottom: 0,
    },
    infoIcon: {
        marginLeft: 8,
        marginTop: -2,
    },

    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        marginBottom: 18,
        marginLeft: 4,
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
        backgroundColor: TEAL,
        borderColor: TEAL,
    },
    checkboxLabel: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },

    button: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        borderRadius: BORDER_RADIUS,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    buttonText: {
        color: TEAL,
        fontSize: 15,
        fontWeight: "700",
        letterSpacing: 2,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },

    cityModal: {
        backgroundColor: "#fff",
        borderRadius: 18,
        width: "100%",
        maxHeight: "70%",
        paddingTop: 18,
        overflow: "hidden",
    },
    cityModalTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1a2e2a",
        textAlign: "center",
        marginBottom: 10,
        paddingHorizontal: 16,
    },
    citySearch: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 20,
        backgroundColor: "#f2f2f2",
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 13,
        color: "#333",
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    cityList: { flex: 1},
    cityItem: {
        paddingVertical: 13,
        paddingHorizontal: 20,
    },
    cityItemText: { fontSize: 14, color: "#555" },
    citySeparator: { height: 1, backgroundColor: "#f0f0f0", marginLeft: 20 },

    infoModal: {
      backgroundColor: "#fff",
        borderRadius: 18,
        padding: 24,
        width: "100%",  
    },
    infoModalHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    infoModalTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1a2e2a",
        marginLeft: 8,
    },
    infoRow: {
       flexDirection: "row",
        alignItems: "center",
        marginBottom: 10, 
    },
    infoText: { fontSize: 13, color: "#444", flex: 1 },
    infoClose: {
        marginTop: 16,
        backgroundColor: TEAL,
        borderRadius: 20,
        paddingVertical: 10,
        alignItems: "center",
    },
    infoCloseText: { color: "#fff", fontWeight: "700", fontSize: 13 },

    

});


          
                        
                    

      