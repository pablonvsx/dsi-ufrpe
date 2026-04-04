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
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function registerGestor() {
    const router = useRouter();

    // Estados dos campos de cadastro
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [orgao, setOrgao] = useState("");       // órgão/instituição do gestor
    const [cargo, setCargo] = useState("");        // ex: Secretário, Coordenador
    const [matricula, setMatricula] = useState(""); // matrícula funcional
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);

    // Estados do modal de ajuda 
    const [modalVisivel, setModalVisivel] = useState(false);
    const [conteudoModal, setConteudoModal] = useState("");

    const questrialFont = "Questrial_400Regular";

    const abrirAjuda = (mensagem: string) => {
        setConteudoModal(mensagem);
        setModalVisivel(true);
    };

// Função Cadastro 
    const handleRegister = async () => {

        //validaçoes básicas antes de tentar salvar
        if (!nome || !email || !orgao || !orgao || !matricula || !senha) { 
            alert("Preencha todos os campos!");
            return; 
        }
    if (senha !== confirmarSenha) {
        alert("As senhas não coincidem!");
        return;
    }
  
    if (senha.length < 6) {
    alert("A senha deve ter pelo menos 6 caracteres");
    return;
    }

    // Tenta salvar no Firestore
    try {
        //addDoc cria um novo documento na coleção "usuarios"
        await addDoc(collection(db, "usuarios"), {
            nome: nome,
            email: email.toLowerCase().trim(),
            orgao: orgao.trim(),
            cargo: cargo.trim(),
            matricula: matricula.trim(),
            tipoUsuario: "gestor", //fixo - identifica o perfil
            statusConta: "ativa",
            dataCriacao: serverTimestamp(), // Firebase anota a hora do servidor
        });
    
    alert("Cadastro realizado com sucesso!");
    router.back(); //volta para a tela anterior após cadastrar

    }catch (error) {
        console.error("Erro ao salvar:", error);
    }
};

// Interface

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
            />

            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

            {/* Gradiente de fundo — mesmo padrão do projeto */}
            <LinearGradient
                colors={["#004d48", "#3ff3e7"]}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require("../assets/images/aquasense-logo.png")}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>

                {/* Título */}
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { fontFamily: questrialFont }]}>
                        CADASTRE-SE NO
                    </Text>
                    <Text style={[styles.title, { fontFamily: questrialFont, marginTop: -5 }]}>
                        AQUASENSE
                    </Text>
                </View>

                {/* Formulário */}
                <View style={styles.formContainer}>

                    {/* Nome */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Seu nome:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nome completo..."
                        placeholderTextColor="rgba(107, 122, 122, 0.5)"
                        value={nome}
                        onChangeText={setNome}
                        autoCapitalize="words"
                    />

                    {/* Email */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Seu email institucional:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="email@orgao.gov.br..."
                        placeholderTextColor="rgba(107, 122, 122, 0.5)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    {/* Órgão */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Órgão / Instituição:</Text>
                    <View style={styles.inputWithIconContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Secretaria de Recursos Hídricos..."
                            placeholderTextColor="rgba(107, 122, 122, 0.5)"
                            value={orgao}
                            onChangeText={setOrgao}
                            autoCapitalize="words"
                        />
                        <TouchableOpacity
                            style={styles.iconInside}
                            onPress={() => abrirAjuda("Informe o nome completo do órgão ou instituição pública ao qual você está vinculado.")}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#004d48" />
                        </TouchableOpacity>
                    </View>

                    {/* Cargo */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Cargo:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: Coordenador de Recursos Hídricos..."
                        placeholderTextColor="rgba(107, 122, 122, 0.5)"
                        value={cargo}
                        onChangeText={setCargo}
                        autoCapitalize="words"
                    />

                    {/* Matrícula */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Matrícula funcional:</Text>
                    <View style={styles.inputWithIconContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Sua matrícula funcional..."
                            placeholderTextColor="rgba(107, 122, 122, 0.5)"
                            value={matricula}
                            onChangeText={setMatricula}
                            autoCapitalize="none"
                            keyboardType="default"
                        />
                        <TouchableOpacity
                            style={styles.iconInside}
                            onPress={() => abrirAjuda("Informe sua matrícula funcional ou outro identificador institucional fornecido pelo seu órgão.")}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#004d48" />
                        </TouchableOpacity>
                    </View>

                    {/* Senha */}
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
                            textContentType="oneTimeCode"
                        />
                        <TouchableOpacity
                            style={styles.iconInside}
                            onPress={() => abrirAjuda("Sua senha deve ter pelo menos 6 caracteres.")}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#004d48" />
                        </TouchableOpacity>
                    </View>

                    {/* Confirmar Senha */}
                    <Text style={[styles.label, { fontFamily: questrialFont }]}>Confirmar senha:</Text>
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
                            onPress={() => abrirAjuda("Digite a mesma senha do campo anterior para confirmação.")}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#004d48" />
                        </TouchableOpacity>
                    </View>

                    {/* Mostrar/ocultar senha */}
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

                {/* Botão Cadastrar */}
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

            {/* Modal de ajuda */}
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
        paddingTop: Platform.OS === "android" ? 40 : 20,
    },
    logoContainer: { alignItems: "center", marginBottom: 10 },
    logoImage: { width: 150, height: 150 },
    titleContainer: { alignItems: "center", marginBottom: 30 },
    title: {
        fontSize: 22,
        color: "#fff",
        textAlign: "center",
        lineHeight: 28,
    },
    formContainer: { flex: 1, gap: 10 },
    label: { color: "#fff", marginBottom: 3, fontSize: 14, marginLeft: 2 },
    input: {
        backgroundColor: "#fff",
        borderRadius: 50,
        paddingVertical: Platform.OS === "android" ? 12 : 15,
        paddingHorizontal: 20,
        paddingRight: 50,
        color: "#6b7a7a",
        fontSize: 15,
        width: "100%",
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    inputWithIconContainer: {
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
        width: "100%",
    },
    iconInside: {
        position: "absolute",
        right: 15,
        top: Platform.OS === "android" ? 12 : 15,
    },
    showPasswordContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 10,
        marginLeft: 15,
    },
    showPasswordText: {
        color: "#fff",
        fontSize: 12,
        marginLeft: 8,
        textTransform: "uppercase",
    },
    footerContainer: { alignItems: "center", marginTop: 30 },
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
        textTransform: "uppercase",
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
    modalButtonText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
});