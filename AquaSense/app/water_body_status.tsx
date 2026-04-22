/**
 * Tela exibida imediatamente após o cadastro de um corpo hídrico.
 * Mostra o nome, o selo "Pendente" e a mensagem de revisão pelo gestor.
 *
 * Rota esperada: /water_body_status
 * Parâmetros: nome (string), id (string)
 */
import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";

const PRIMARY = "#004d48";

export default function WaterBodyStatus() {
    const router = useRouter();
    const { nome, id } = useLocalSearchParams<{ nome?: string; id?: string }>();

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const nomeExibido = nome ?? "Corpo hídrico";

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>
                {/* HEADER */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafe}>
                        <View style={styles.headerRow}>
                            {/* Botão fechar (X) no canto direito, como no protótipo */}
                            <View style={{ width: 36 }} />
                            <View style={styles.headerLogoRow}>
                                <Ionicons name="water" size={18} color="rgba(255,255,255,0.85)" />
                                <Text style={[styles.headerAppName, { fontFamily: questrial }]}>
                                    AQUASENSE
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => router.replace("/(tabs)" as any)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <View style={styles.closeCircle}>
                                    <Ionicons name="close" size={16} color={PRIMARY} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ONDA */}
                <LinearGradient
                    colors={["#0d9080", "#1fc8b4", "#3ff3e7"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.tealBand}
                >
                    <View style={styles.waveWhite} />
                </LinearGradient>

                {/* CONTEÚDO */}
                <SafeAreaView edges={["bottom"]} style={styles.content}>
                    {/* Card principal */}
                    <View style={styles.mainCard}>
                        {/* Nome + Selo Pendente */}
                        <View style={styles.nameRow}>
                            <Text
                                style={[styles.nomeTxt, { fontFamily: questrial }]}
                                numberOfLines={2}
                            >
                                {nomeExibido}
                            </Text>
                            <View style={styles.badge}>
                                <Text style={[styles.badgeTxt, { fontFamily: questrial }]}>
                                    Pendente
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Ícone + Mensagem */}
                        <View style={styles.statusBlock}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="time-outline" size={32} color={PRIMARY} />
                            </View>
                            <Text style={[styles.statusMsg, { fontFamily: questrial }]}>
                                Registro do corpo hídrico pendente de validação. O gestor irá revisar as informações e validá-las em breve.
                            </Text>
                        </View>
                    </View>

                    {/* Botão voltar para Home */}
                    <TouchableOpacity
                        style={styles.homeBtn}
                        onPress={() => router.replace("/(tabs)" as any)}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={["#004d48", "#0d9080"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.homeBtnGradient}
                        >
                            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
                            <Text style={[styles.homeBtnTxt, { fontFamily: questrial }]}>
                                Ir para a Home
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F9F8" },

    header: {},
    headerSafe: { paddingBottom: 14 },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    headerLogoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    headerAppName: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 15,
        fontWeight: "700",
        letterSpacing: 1.5,
    },
    closeCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.92)",
        alignItems: "center",
        justifyContent: "center",
    },

    tealBand: { paddingTop: 12, paddingBottom: 0, overflow: "hidden" },
    waveWhite: {
        height: 22,
        backgroundColor: "#F5F9F8",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
    },

    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },

    mainCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 22,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
        marginBottom: 20,
    },

    nameRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
    },

    nomeTxt: {
        flex: 1,
        fontSize: 19,
        fontWeight: "700",
        color: PRIMARY,
        lineHeight: 26,
    },

    badge: {
        backgroundColor: "#fff8e1",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: "#ffe082",
        alignSelf: "flex-start",
        marginTop: 2,
    },
    badgeTxt: {
        fontSize: 12,
        fontWeight: "700",
        color: "#f9a825",
        letterSpacing: 0.3,
    },

    divider: { height: 1, backgroundColor: "#e0f2f1", marginBottom: 18 },

    statusBlock: {
        alignItems: "center",
        gap: 16,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(63,243,231,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    statusMsg: {
        fontSize: 14,
        color: "#6b7a7a",
        textAlign: "center",
        lineHeight: 22,
    },

    homeBtn: {
        borderRadius: 50,
        overflow: "hidden",
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 6,
    },
    homeBtnGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 16,
    },
    homeBtnTxt: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
        letterSpacing: 0.4,
    },
});