import React, { useState } from "react";
import {
    View,
    Text,
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Stack, useRouter } from "expo-router";

// Captura a altura da tela para garantir que o conteúdo ocupe
// pelo menos toda área visível do dispositivo.
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Define o formato de cada perfil exibido na tela.
type ProfileType = {
    id: string;
    label: string;
    route: string;
    description: string;

};

const PROFILES: ProfileType[] = [
    {
        id: "comum",
        label:"Usuário Comum",
        route: "/cadatro-comum",
        description: "Registra observações visuais sobre a qualidade da água, como cor, odor e presença de lixo ou contaminantes. Ideal para cidadãos que querem contribuir com sua comunidade.",
    },
    {
        id: "colaborador",
        label: "Usuário Colaborador",
        route: "/cadastro-colaborador",
        description: "Vinculado a comunidades ou iniciativas locais, contribui com observações e registros contínuos no sistema. Atua como ponte entre a população e os especialistas.",
    },
    {
        id: "técnico",
        label: "Equipe Técnica",
        route: "/cadastro-tecnico",
        description: "Responsável por análises técnicas detalhadas, acompanhamento de dados e validações especializadas. Utiliza ferramentas avançadas de monitoramento",
        
    },
    {
        id: "gestor",
        label: "Usuário Gestor",
        route: "/cadastro-gestor",
        description: "Responsável pelo monitoramento geral, visualização de informações estratégicas e suporte à tomada de decisão em nível institucional ou municipal.",
    },
];

// Componente principal da tela de seleção de perfil. 
// Aqui ficam concentradas a navegação, o controle do modal
// e a renderização da estrutura central da interface.
export default function SelectUserType() {
    const router = useRouter();
    const [activeInfo, setActiveInfo] = useState<ProfileType | null>(null);

    // Carrega a fonte personalizada para o aplicativo.
    const [fontsLoaded] = useFonts({
        Questrial_400Regular,
    });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    return (
<>
<Stack.Screen options={{ headerShown: false }} />
  <SafeAreaView style={styles.safeArea}>
    <StatusBar
      barStyle="light-content"
      translucent
      backgroundColor="transparent"
    />

    <LinearGradient
      colors={["#004d48", "#3ff3e7"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />

    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      
    > 
      <View style={styles.logoSection}>
        <Image
          source={require("../assets/images/aquasense-logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
          tintColor="#FFFFFF"
        />

        <Text style={[styles.supportText, { fontFamily: questrial }]}>
          Selecione o perfil que melhor representa você
        </Text>
      </View>
        
      <View style={styles.profileSection}>
        {PROFILES.map((profile) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            fontFamily={questrial}
            onSelect={() => router.push(profile.route as any)}
            onInfo={() => setActiveInfo(profile)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { fontFamily: questrial }]}>
          Já tem uma conta?{" "}
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/login" as any)}
          activeOpacity={0.7}
        >
          <Text style={[styles.footerLink, { fontFamily: questrial }]}>
            Entrar
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Modal controlado pelo estado `activeInfo`.
    Quando um perfil é selecionado no ícone de informação,
    seu conteúdo é exibido aqui. */}
    <InfoModal
      profile={activeInfo}
      fontFamily={questrial}
      onClose={() => setActiveInfo(null)}
    />
  </SafeAreaView>
</>
    );
}

type ProfileRowProps = {
    profile: ProfileType;
    fontFamily?: string | undefined;
    onSelect: () => void;
    onInfo: () => void;
};

function ProfileRow({ profile, fontFamily, onSelect, onInfo }: ProfileRowProps) {
    return (
        <View style={styles.profileRow}>
            <TouchableOpacity
                style={styles.profileButton}
                onPress={onSelect}
                activeOpacity={0.82}
            >
                <Text style={[styles.profileButtonText, { fontFamily }]}>
                    {profile.label}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.infoIconButton}
                onPress={onInfo}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                activeOpacity={0.7}
            >
                <View style={styles.infoIconCircle}>
                    <Text style={styles.infoIconText}>i</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
}

type InfoModalProps = {
    profile: ProfileType | null;
    fontFamily?: string | undefined;
    onClose: () => void;
};

function InfoModal({ profile, fontFamily, onClose }: InfoModalProps) {
    return (
        <Modal
            visible={!!profile}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverLay} onPress={onClose}>
                <Pressable
                    style={styles.modalCard}
                    onPress={(e) => e.stopPropagation()}
                >
                    {profile && (
                        <>
                            <Text style={[styles.modalTitle, { fontFamily }]}>
                                {profile.label}
                            </Text>
                            <View style={styles.modalDivider} /> 
                            <Text style={[styles.modalDescription, { fontFamily }]}>
                                {profile.description}
                            </Text>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={onClose}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalButtonText, { fontFamily }]}>
                                    Entendi
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#004d48",
    },
    scrollContent: {
        flexGrow: 1,
        minHeight: SCREEN_HEIGHT,
        paddingHorizontal: 36,
        paddingTop: Platform.OS === "android" ? 56 : 44,
        paddingBottom: 48,
        justifyContent: "space-between",
    },
    logoSection: {
        alignItems: "center",
        paddingTop: 40,
        marginBottom: 12,
    },
    logoImage: {
        width: 300,
        height: 300,
        marginBottom: 0,
    },
    supportText: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.78)",
        textAlign: "center",
        letterSpacing: 0.3,
        lineHeight: 22,
        maxWidth: 260,
        marginTop: -20,
    },
    profileSection: {
        flex: 1,
        justifyContent: "center",
        gap: 14,
        paddingVertical: 20,
    },
    profileRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    profileButton: {
        width: "85%",
        alignSelf: "center",
        marginLeft: 20,
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: 50,
        paddingVertical: 17,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 6,
        elevation: 3,
    },
    profileButtonText: {
        fontSize: 15,
        color: "#6b7a7a",
        letterSpacing: 0.3,
    },
    infoIconButton: {
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 3,
    },
    infoIconCircle: {
        width: 18,
        height: 18,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "rgba(255, 255, 255, 0.80)",
        alignItems: "center",
        justifyContent: "center",
    },
    infoIconText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "700",
        fontStyle: "italic",
        lineHeight: 16,
        includeFontPadding: false,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 8,
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
    modalOverLay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
    },
    modalCard: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 12,
    },
    modalTitle: {
        fontSize: 17,
        color: "#004d48",
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
        fontSize: 15,
        color: "#555",
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 24,
    },
    modalButton: {
        backgroundColor: "#004d48",
        borderRadius: 50,
        paddingVertical: 14,
        alignItems: "center",

    },
    modalButtonText: {
        fontSize: 15,
        color: "#FFFFFF",
        fontWeight: "600",
        letterSpacing: 0.3,
    },
});








