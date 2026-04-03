import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Pressable,
    Platform,
    Image,
    Dimensions,
    KeyboardAvoidingView
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Stack, useRouter } from "expo-router";
import { db } from "../config/firebase"; 
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";

// Importa o ícone de informação para o modal de ajuda
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function registerTechnician() {
    const router = useRouter();

    // Estados para os campos do cadastro
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [codigoEquipe, setCodigoEquipe] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);

    const questrialFont = 'Questrial_400Regular';

    const handleRegister = async () => {
        if (senha !== confirmarSenha) {
            alert("As senhas não coincidem!");
            return;
        }
        console.log("Tentativa de cadastro:", { nome, email, codigoEquipe, senha });
        // Conexão com o Firebase 
        try {
            const equipesRef = collection(db, "equipesTecnicas");
            const q = query(equipesRef, where("codigoConvite", "==", codigoEquipe));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Código de equipe inválido! Verifique com seu gestor.");
                return;
            }

            const equipeDados = querySnapshot.docs[0].data();
            const equipeID = querySnapshot.docs[0].id; 

            await addDoc(collection(db, "usuarios"), {
                nome: nome,
                email: email.toLowerCase().trim(),
                equipeID: equipeID,
                cidade: equipeDados.cidade,    
                tipoUsuario: "técnico",
                statusConta: "ativa",
                dataCriacao: serverTimestamp(),
            });

            alert(`Bem-vindo à equipe de ${equipeDados.cidade}!`);
            
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao processar o cadastro.");
        }
    }

    const [modalVisivel, setModalVisivel] = useState(false);
    const [conteudoModal, setConteudoModal] = useState("");

    const abrirAjuda = (mensagem: string) => {
        setConteudoModal(mensagem);
        setModalVisivel(true);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ 
                headerShown: true, 
                title: "", 
                headerTintColor: "#fff",
                headerTransparent: true, 
            }} />
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} 
            ></KeyboardAvoidingView>
            
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

            <LinearGradient
                colors={["#004d48", "#3ff3e7"]}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled" 
                showsVerticalScrollIndicator={false}
            >
                {/* Logo Section */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require("../assets/images/aquasense-logo.png")}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>

                {/* Título Section */}
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { fontFamily: questrialFont }]}>
                        CADASTRE-SE NO
                    </Text>
                    <Text style={[styles.title, { fontFamily: questrialFont, marginTop: -5 }]}>
                        AQUASENSE
                    </Text>
                </View>

                {/* Formulário Section */}
                <View style={styles.formContainer}>
                    
                    {/* Campo Nome */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Seu nome:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nome..."
                        placeholderTextColor="rgba(107, 122, 122, 0.5)"
                        value={nome}
                        onChangeText={setNome}
                        textContentType="name"
                        autoComplete="name"
                        autoCapitalize="words"
                    />

                    {/* Campo Email */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Seu Email:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Email..."
                        placeholderTextColor="rgba(107, 122, 122, 0.5)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        textContentType="emailAddress"
                        autoComplete="email"
                    />

                    {/* Elemento de quebra para o iOS */}
                    <View style={{ height: 0, opacity: 0 }}>
                        <TextInput textContentType="none" />
                    </View>

                    {/* Campo Código da Equipe */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Código da equipe:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Código da equipe..."
                        placeholderTextColor="rgba(107, 122, 122, 0.5)"
                        value={codigoEquipe}
                        onChangeText={setCodigoEquipe}
                        autoComplete="one-time-code" 
                        textContentType="oneTimeCode"      
                        importantForAutofill="no"    
                        autoCorrect={false}          
                        spellCheck={false}
                        keyboardType="ascii-capable"
                    />

                    {/* Campo Senha */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Senha:</Text>
                    <View style={styles.inputWithIconContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Sua senha..."
                            placeholderTextColor="rgba(107, 122, 122, 0.5)"
                            value={senha}
                            onChangeText={setSenha}
                            secureTextEntry={!mostrarSenha}
                            autoComplete="off"
                            importantForAutofill="no"
                            autoCorrect={false}
                            spellCheck={false}
                            textContentType="oneTimeCode"

                        />
                        <TouchableOpacity 
                            style={styles.iconInside} 
                            onPress={() => abrirAjuda("Sua senha deve ter pelo menos 8 caracteres, incluindo:\n\n" + "• Letra maiúscula e minúscula\n" + "• Um caractere especial (!@#$) \n" + "• Um número (0-9)")}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#004d48" />
                        </TouchableOpacity>
                    </View>

                    {/* Campo Confirmar Senha */}
                    <Text style={[styles.label, { fontFamily: questrialFont, textTransform: 'capitalize' }]}>CONFIRMAR Senha:</Text>
                    <View style={styles.inputWithIconContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Confirme sua senha..."
                            placeholderTextColor="rgba(107, 122, 122, 0.5)"
                            value={confirmarSenha}
                            onChangeText={setConfirmarSenha}
                            secureTextEntry={!mostrarSenha} 
                        />
                         <TouchableOpacity 
                            style={styles.iconInside} 
                            onPress={() => abrirAjuda("Certifique-se de que a senha digitada aqui seja idêntica à senha anterior para garantir que você possa acessar sua conta no futuro.")}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#004d48" />
                        </TouchableOpacity>
                    </View>

                    {/* Opção Mostrar Senha */}
                    <TouchableOpacity 
                        style={styles.showPasswordContainer} 
                        onPress={() => setMostrarSenha(!mostrarSenha)}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name={mostrarSenha ? "checkbox-outline" : "square-outline"} 
                            size={20} 
                            color="#fff" 
                        />
                        <Text style={[styles.showPasswordText, { fontFamily: questrialFont }]}>
                            MOSTRAR SENHA
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Botão Cadastrar Section */}
                <View style={styles.footerContainer}>
                    <TouchableOpacity 
                        style={styles.cadastrarButton} 
                        onPress={handleRegister}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.buttonText, { fontFamily: questrialFont }]}>
                            CADASTRAR
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisivel}
                onRequestClose={() => setModalVisivel(false)}
            >
                <Pressable 
                    style={styles.modalOverlay} 
                    onPress={() => setModalVisivel(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={[styles.modalText, { fontFamily: questrialFont }]}>
                            {conteudoModal}
                        </Text>
                        <TouchableOpacity 
                            style={styles.modalButton} 
                            onPress={() => setModalVisivel(false)}
                        >
                            <Text style={[styles.modalButtonText, { fontFamily: questrialFont }]}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    ); 
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#004d48" },
    scrollContent: { 
        flexGrow: 1, 
        justifyContent: "flex-start", 
        paddingHorizontal: 40, 
        paddingBottom: 40, 
        paddingTop: Platform.OS === 'android' ? 40 : 20, 
    },
    logoContainer: {
        alignItems: "center",
        marginBottom: 10, 
    },
    logoImage: {
        width: 150, 
        height: 150, 
    },
    titleContainer: {
        alignItems: "center",
        marginBottom: 30,
    },
    title: { 
        fontSize: 22, 
        color: "#fff", 
        textAlign: "center",
        lineHeight: 28,
    },
    formContainer: {
        flex: 1,
        gap: 10, 
    },
    label: { 
        color: "#fff", 
        marginBottom: 3, 
        fontSize: 14, 
        marginLeft: 2, 
    },
    input: {
        backgroundColor: "#fff",
        borderRadius: 50,
        paddingVertical: Platform.OS === 'android' ? 12 : 15,
        paddingHorizontal: 20,
        paddingRight: 50, 
        color: "#6b7a7a",
        fontSize: 15,
        width: '100%', 
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    inputWithIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative', 
        width: '100%',
    },
    iconInside: {
        position: 'absolute',
        right: 15, 
        top: Platform.OS === 'android' ? 12 : 15, 
    },
    showPasswordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
        marginLeft: 15,
    },
    showPasswordText: {
        color: "#fff",
        fontSize: 12,
        marginLeft: 8,
        textTransform: 'uppercase',
    },
    footerContainer: {
        alignItems: 'center',
        marginTop: 30,
    },
    cadastrarButton: {
        backgroundColor: "#fff",
        borderRadius: 50,
        paddingVertical: 18,
        paddingHorizontal: 60, 
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: { 
        color: "#004d48",
        fontWeight: "bold", 
        fontSize: 16,
        textTransform: 'uppercase',
    },

    modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    },

    modalContent: {
        width: "80%",
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 25,
        alignItems: "center",
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },

    modalText: {
        fontSize: 16,
        color: "#004d48",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 22,
    },

    modalButton: {
        backgroundColor: "#004d48",
        paddingVertical: 10,
        paddingHorizontal: 30,
        borderRadius: 25,
    },
    modalButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
    },
});
