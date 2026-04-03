import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    StatusBar,
    Pressable,
    Platform,
    Image,
    Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Stack, useRouter } from "expo-router";

type ProfileType = {
    id: string;
    label: string;
    route: string;
    description: string;
};

const PROFILES: ProfileType[] = [
    {
        id: "comum",
        label: "Usuário Comum",
        route: "/register_common",
        description:
            "Registra observações visuais sobre a qualidade da água, como cor, odor e presença de lixo ou contaminantes. Ideal para cidadãos que querem contribuir com sua comunidade.",
    },
    {
        id: "colaborador",
        label: "Usuário Colaborador",
        route: "/register_collaborator",
        description:
            "Vinculado a comunidades ou iniciativas locais, contribui com observações e registros contínuos no sistema. Atua como ponte entre a população e os especialistas.",
    },
    {
        id: "técnico",
        label: "Equipe Técnica",
        route: "/register_technician",
        description:
            "Responsável por análises técnicas detalhadas, acompanhamento de dados e validações especializadas. Utiliza ferramentas avançadas de monitoramento",
    },
    {
        id: "gestor",
        label: "Usuário Gestor",
        route: "/register_manager",
        description:
            "Responsável pelo monitoramento geral, visualização de informações estratégicas e suporte à tomada de decisão em nível institucional ou municipal.",
    },
];

export default function SelectUserType() {
    const router = useRouter();
    const [activeInfo, setActiveInfo] = useState<ProfileType | null>(null);

    // Animação de entrada dos botões (slide + fade)
    const headerfadeAnim = useRef(new Animated.Value(0)).current;
    const headertranslateAnim = useRef(new Animated.Value(-20)).current;

    
    

    useEffect(() => {
        // Entrada dos elementos
        Animated.parallel([
            Animated.timing(headerfadeAnim, {
                toValue: 1,
                duration: 700,
                useNativeDriver: true,
            }),
            Animated.timing(headertranslateAnim, {
                toValue: 0,
                duration: 700,
                useNativeDriver: true,
            }),
        ]).start();

    }, [headerfadeAnim, headertranslateAnim]);

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
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo com animação de escala/respiração */}
                    <Animated.View
                        style={[
                            styles.logoSection,
                            {
                                opacity: headerfadeAnim,
                                transform: [{ translateY: headertranslateAnim }],
                            },
                            
                        ]}
                    >
                        <Image
                            source={require("../assets/images/aquasense-logo.png")}
                            style={styles.logoImage}
                            resizeMode="contain"
                            tintColor="#FFFFFF"
                        />

                        <Text style={[styles.supportText, { fontFamily: questrial }]}>
                            Selecione o perfil que melhor representa você
                        </Text>
                    </Animated.View>

                    {/* Botões com animação de entrada (fade + slide-up) */}
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
    scrollView: {
        flex: 1,
    },

    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 36,
        paddingTop: Platform.OS === "android" ? 40 : 20,
        paddingBottom: 24,
        justifyContent: "center",
    },
    logoSection: {
        alignItems: "center",
        paddingTop: 10,
        marginBottom: 10,
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
        marginTop: -10,
    },
    profileSection: {
        justifyContent: "center",
        gap: 12,
        paddingVertical: 15,
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
        shadowOpacity: 0.1,
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
