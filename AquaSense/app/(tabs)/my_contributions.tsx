import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    TextInput,
    Image,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";

const PRIMARY = "#004d48";

const CONTRIBUICOES_MOCK = [
    { id: "1", titulo: "Medição simples - Canal do Fragoso", corpo: "Canal do Fragoso", detalhe: "pH: 6.8 · Turbidez: Baixa · Temp.: 26°C", data: "08/05/2025", hora: "16:30", status: "Validada", statusBg: "#e6f4f1", statusColor: "#1a8c80", icon: "flask-outline", iconBg: "rgba(26,140,128,0.12)", iconColor: "#1a8c80" },
    { id: "2", titulo: "Observação - Presença de resíduos", corpo: "Canal do Fragoso", detalhe: "Resíduos sólidos nas margens", data: "08/05/2025", hora: "10:15", status: "Pendente", statusBg: "#fff8e1", statusColor: "#e6a817", icon: "leaf-outline", iconBg: "rgba(230,168,23,0.12)", iconColor: "#e6a817" },
    { id: "3", titulo: "Denúncia - Esgoto irregular", corpo: "Canal do Fragoso", detalhe: "Ponto de descarte identificado", data: "06/05/2025", hora: "14:20", status: "Em análise", statusBg: "#fdecea", statusColor: "#e05252", icon: "megaphone-outline", iconBg: "rgba(224,82,82,0.12)", iconColor: "#e05252" },
];

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

                {/* ══ FILTROS ══ */}
                <View style={styles.filtersWrapper}>
                    {["Todas", "Validadas", "Pendentes", "Em análise", "Rascunhos"].map((filtro) => (
                        <TouchableOpacity
                            key={filtro}
                            style={[styles.filterChip, filtro === "Todas" && styles.filterChipActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { fontFamily: questrial },
                                filtro === "Todas" && styles.filterChipTextActive,
                            ]}>
                                {filtro}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ══ LISTA ══ */}
                <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.resultados, { fontFamily: questrial }]}>Resultados: 0 contribuições</Text>

                    {CONTRIBUICOES_MOCK.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.82}>
                            <View style={styles.cardLeft}>
                                <View style={[styles.cardIconCircle, { backgroundColor: item.iconBg }]}>
                                    <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                                </View>
                                <View style={styles.cardInfo}>
                                    <Text style={[styles.cardTitle, { fontFamily: questrial }]} numberOfLines={1}>
                                        {item.titulo}
                                    </Text>
                                    <Text style={[styles.cardSub, { fontFamily: questrial }]} numberOfLines={1}>
                                        {item.corpo} · {item.detalhe}
                                    </Text>
                                    <Text style={[styles.cardData, { fontFamily: questrial }]}>
                                        {item.data} · {item.hora}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.cardRight}>
                                <View style={[styles.statusPill, { backgroundColor: item.statusBg }]}>
                                    <Text style={[styles.statusText, { fontFamily: questrial, color: item.statusColor }]}>
                                        {item.status}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#aaa" style={{ marginTop: 8 }} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
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
    filtersWrapper: {
        flexDirection: "row", gap: 8, paddingHorizontal: 20,
        paddingVertical: 12, backgroundColor: "#FFFFFF",
        borderBottomWidth: 1, borderBottomColor: "#e0f2f1",
    },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 50, backgroundColor: "#F5F9F8",
        borderWidth: 1, borderColor: "#e0f2f1",
    },
    filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    filterChipText: { fontSize: 12, color: "#6b7a7a", fontWeight: "600" },
    filterChipTextActive: { color: "#FFFFFF" },
    body: { flex: 1 },
    bodyContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    resultados: { fontSize: 13, color: "#6b7a7a", marginBottom: 12, fontWeight: "600" },
    card: {
        backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14,
        marginBottom: 12, flexDirection: "row", alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
    cardIconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 14, color: "#1a1a1a", fontWeight: "700", marginBottom: 3 },
    cardSub: { fontSize: 12, color: "#6b7a7a", marginBottom: 3 },
    cardData: { fontSize: 11, color: "#aaa" },
    cardRight: { alignItems: "flex-end" },
    statusPill: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 11, fontWeight: "700" },
});