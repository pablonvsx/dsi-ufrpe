import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Image } from "react-native";

const PRIMARY = "#004d48";

export default function MyContributions() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>
                {/* ══ HEADER ══ */}
                <LinearGradient
                    colors={["#004d48", "#0a6b5e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <View style={styles.headerRow}>
                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={() => router.back()}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View style={styles.headerTitleWrapper}>
                                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                                    Minhas contribuições
                                </Text>
                                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                                    Acompanhe aqui todas as suas medições e observações enviadas.
                                </Text>
                            </View>
                            <Image
                                source={require("../../assets/images/aquasense.png")}
                                style={styles.headerLogo}
                                resizeMode="contain"
                                tintColor="#FFFFFF"
                            />
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ BARRA DE BUSCA ══ */}
                <View style={styles.searchWrapper}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color="#6b7a7a" style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.searchInput, { fontFamily: questrial }]}
                            placeholder="Buscar contribuições"
                            placeholderTextColor="#aaa"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
                        <Ionicons name="options-outline" size={18} color={PRIMARY} />
                        <Text style={[styles.filterText, { fontFamily: questrial }]}>Filtrar</Text>
                    </TouchableOpacity>
                </View>

                {/* Conteúdo virá nos próximos commits */}
                <View style={styles.body} />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F9F8" },
    headerGradient: {},
    headerSafeArea: { paddingBottom: 16 },
    headerRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 10, gap: 12 },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center", justifyContent: "center",
        marginTop: 4,
    },
    headerTitleWrapper: { flex: 1 },
    headerTitle: { fontSize: 20, color: "#FFFFFF", fontWeight: "700", letterSpacing: 0.2 },
    headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, lineHeight: 18 },
    headerLogo: { width: 44, height: 44 },
    searchWrapper: {
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1, borderBottomColor: "#e0f2f1",
    },
    searchBar: {
        flex: 1, flexDirection: "row", alignItems: "center",
        backgroundColor: "#F5F9F8", borderRadius: 50,
        paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: "#e0f2f1",
    },
    searchInput: { flex: 1, fontSize: 14, color: "#333" },
    filterBtn: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "#e0f2f1", borderRadius: 50,
        paddingHorizontal: 14, paddingVertical: 10,
    },
    filterText: { fontSize: 13, color: PRIMARY, fontWeight: "600" },
    body: { flex: 1 },
});