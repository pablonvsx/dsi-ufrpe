import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    FlatList,
    TouchableOpacity,
    Modal,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Animated,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { getUnvalidatedWaterBodies, getValidatedWaterBodies, validateWaterBody, rejectWaterBody } from "@/services/firestore/water_bodies";
import { CorpoHidrico } from "@/types/water_bodies";

const PRIMARY = "#004d48";
const SUCCESS = "#1a8c80";
const DANGER = "#e05252";
const WARNING = "#e6a817";

export default function ManageWaterBodies() {
    const { userProfile } = useAuth();
    const router = useRouter();
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    const [waterBodies, setWaterBodies] = useState<CorpoHidrico[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBody, setSelectedBody] = useState<CorpoHidrico | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);

    const [validatedBodies, setValidatedBodies] = useState<CorpoHidrico[]>([]);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedEditBody, setSelectedEditBody] = useState<CorpoHidrico | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]).start();

        fetchWaterBodies();
    }, []);

    async function fetchWaterBodies() {
        setLoading(true);
        const bodies = await getUnvalidatedWaterBodies();
        setWaterBodies(bodies);
        setLoading(false);
    }

    async function fetchValidatedBodies() {
        const bodies = await getValidatedWaterBodies();
        setValidatedBodies(bodies);
    }

    async function handleValidate(bodyId: string) {
        if (!userProfile) return;
        
        setProcessingId(bodyId);
        try {
            await validateWaterBody(bodyId, userProfile.uid);
            setWaterBodies(prev => prev.filter(b => b.id !== bodyId));
            setSelectedBody(null);
            setModalVisible(false);
            Alert.alert("Sucesso", "Corpo hídrico validado com sucesso!");
        } catch (error) {
            Alert.alert("Erro", "Não foi possível validar o corpo hídrico.");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    }

    async function handleReject() {
        if (!userProfile || !selectedBody || !rejectReason.trim()) {
            Alert.alert("Erro", "Por favor, forneça um motivo para rejeitar.");
            return;
        }

        setProcessingId(selectedBody.id);
        try {
            await rejectWaterBody(selectedBody.id!, userProfile.uid, rejectReason);
            setWaterBodies(prev => prev.filter(b => b.id !== selectedBody.id));
            setSelectedBody(null);
            setModalVisible(false);
            setRejectReason("");
            Alert.alert("Sucesso", "Corpo hídrico rejeitado.");
        } catch (error) {
            Alert.alert("Erro", "Não foi possível rejeitar o corpo hídrico.");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    }

    function openModal(body: CorpoHidrico) {
        setSelectedBody(body);
        setRejectReason("");
        setModalVisible(true);
    }

    function closeModal() {
        setModalVisible(false);
        setSelectedBody(null);
        setRejectReason("");
    }

    function openEditModal() {
        fetchValidatedBodies();
        setEditModalVisible(true);
    }

    function closeEditModal() {
        setEditModalVisible(false);
        setSelectedEditBody(null);
    }

    const renderWaterBodyCard = ({ item }: { item: CorpoHidrico }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => openModal(item)}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                    <Ionicons name="water-outline" size={20} color={PRIMARY} />
                    <Text style={[styles.cardTitle, { fontFamily: questrial }]} numberOfLines={2}>
                        {item.nome}
                    </Text>
                </View>
                <View style={styles.typeBadge}>
                    <Text style={[styles.typeBadgeText, { fontFamily: questrial }]}>
                        {item.tipo}
                    </Text>
                </View>
            </View>

            <View style={styles.cardInfo}>
                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={14} color="#6b7a7a" />
                    <Text style={[styles.infoText, { fontFamily: questrial }]}>
                        {item.municipio}, {item.bioma}
                    </Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={14} color="#6b7a7a" />
                    <Text style={[styles.infoText, { fontFamily: questrial }]} numberOfLines={1}>
                        Criado por: {item.criadoPor}
                    </Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <Text style={[styles.tapText, { fontFamily: questrial }]}>
                    Toque para revisar
                </Text>
                <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
            </View>
        </TouchableOpacity>
    );

    const emptyComponent = (
        <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#1a8c80" />
            <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
                Nenhum corpo para validar
            </Text>
            <Text style={[styles.emptySubtitle, { fontFamily: questrial }]}>
                Todos os corpos hídricos foram validados ou rejeitados.
            </Text>
        </View>
    );

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <View style={styles.root}>

                {/* ══ HEADER ══ */}
                <LinearGradient colors={["#004d48", "#0a6b5e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradient}>
                    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
                        <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                                Gerenciar Corpos Hídricos
                            </Text>
                            <View style={{ width: 28 }} />
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ══ CONTEÚDO ══ */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={PRIMARY} />
                    </View>
                ) : (
                    <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
                        <TouchableOpacity
                            style={styles.editCard}
                            onPress={openEditModal}
                            activeOpacity={0.75}
                        >
                            <LinearGradient
                                colors={["#0d6b5f", "#004d48"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.editCardGradient}
                            >
                                <View style={styles.editCardContent}>
                                    <View style={styles.editCardIcon}>
                                        <Ionicons name="create-outline" size={28} color="#FFFFFF" />
                                    </View>
                                    <View style={styles.editCardText}>
                                        <Text style={[styles.editCardTitle, { fontFamily: questrial }]}>
                                            Ver Corpos Validados
                                        </Text>
                                        <Text style={[styles.editCardSubtitle, { fontFamily: questrial }]}>
                                            Editar corpos hídricos já aprovados
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        <FlatList
                            data={waterBodies}
                            renderItem={renderWaterBodyCard}
                            keyExtractor={item => item.id || ""}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={emptyComponent}
                            scrollIndicatorInsets={{ right: 1 }}
                        />
                    </Animated.View>
                )}

                {/* ══ MODAL DE DETALHES E VALIDAÇÃO ══ */}
                <Modal
                    visible={modalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={closeModal}
                >
                    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={28} color={PRIMARY} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                                Detalhes do Corpo Hídrico
                            </Text>
                            <View style={{ width: 28 }} />
                        </View>

                        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                            {selectedBody && (
                                <>
                                    {/* Informações básicas */}
                                    <View style={styles.section}>
                                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                            Informações Básicas
                                        </Text>
                                        <View style={styles.detailField}>
                                            <Text style={[styles.detailLabel, { fontFamily: questrial }]}>Nome</Text>
                                            <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                {selectedBody.nome}
                                            </Text>
                                        </View>
                                        <View style={styles.detailField}>
                                            <Text style={[styles.detailLabel, { fontFamily: questrial }]}>Tipo</Text>
                                            <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                {selectedBody.tipo}
                                            </Text>
                                        </View>
                                        {selectedBody.descricao && (
                                            <View style={styles.detailField}>
                                                <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                    Descrição
                                                </Text>
                                                <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                    {selectedBody.descricao}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Localização */}
                                    <View style={styles.section}>
                                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                            Localização
                                        </Text>
                                        <View style={styles.detailField}>
                                            <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                Coordenadas
                                            </Text>
                                            <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                {selectedBody.latitude.toFixed(6)}, {selectedBody.longitude.toFixed(6)}
                                            </Text>
                                        </View>
                                        <View style={styles.detailField}>
                                            <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                Município
                                            </Text>
                                            <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                {selectedBody.municipio}
                                            </Text>
                                        </View>
                                        <View style={styles.detailField}>
                                            <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                Bioma
                                            </Text>
                                            <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                {selectedBody.bioma}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Tipos de Uso */}
                                    <View style={styles.section}>
                                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                            Tipos de Uso
                                        </Text>
                                        {selectedBody.tiposDeUso.map((uso, idx) => (
                                            <View key={idx} style={styles.usoBadge}>
                                                <Text style={[styles.usoBadgeText, { fontFamily: questrial }]}>
                                                    {uso}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Observações visuais */}
                                    {selectedBody.observacoes && (
                                        <View style={styles.section}>
                                            <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                                Observações Visuais
                                            </Text>
                                            {selectedBody.observacoes.cor && (
                                                <View style={styles.detailField}>
                                                    <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                        Cor da Água
                                                    </Text>
                                                    <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                        {selectedBody.observacoes.cor}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedBody.observacoes.odor && (
                                                <View style={styles.detailField}>
                                                    <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                        Odor
                                                    </Text>
                                                    <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                        {selectedBody.observacoes.odor}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedBody.observacoes.presencaLixo && (
                                                <View style={styles.detailField}>
                                                    <Text style={[styles.detailLabel, { fontFamily: questrial }]}>
                                                        Presença de Lixo
                                                    </Text>
                                                    <Text style={[styles.detailValue, { fontFamily: questrial }]}>
                                                        {selectedBody.observacoes.presencaLixo}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Motivo de Rejeição */}
                                    <View style={styles.section}>
                                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                                            Rejeitar Cadastro
                                        </Text>
                                        <Text style={[styles.reasonLabel, { fontFamily: questrial }]}>
                                            Se necessário, indique o motivo da rejeição:
                                        </Text>
                                        <TextInput
                                            style={[styles.rejectReasonInput, { fontFamily: questrial }]}
                                            placeholder="Motivo da rejeição (ex: Dados incompletos, Localização incorreta, etc.)"
                                            placeholderTextColor="#ccc"
                                            multiline
                                            numberOfLines={3}
                                            value={rejectReason}
                                            onChangeText={setRejectReason}
                                            editable={!processingId}
                                        />
                                    </View>

                                    {/* Botões de Ação */}
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={[styles.rejectButton, processingId === selectedBody.id && styles.buttonDisabled]}
                                            onPress={() => handleReject()}
                                            disabled={processingId === selectedBody.id}
                                            activeOpacity={0.7}
                                        >
                                            {processingId === selectedBody.id ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                                                    <Text style={[styles.rejectButtonText, { fontFamily: questrial }]}>
                                                        REJEITAR
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.validateButton, processingId === selectedBody.id && styles.buttonDisabled]}
                                            onPress={() => handleValidate(selectedBody.id!)}
                                            disabled={processingId === selectedBody.id}
                                            activeOpacity={0.7}
                                        >
                                            {processingId === selectedBody.id ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                                                    <Text style={[styles.validateButtonText, { fontFamily: questrial }]}>
                                                        VALIDAR
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>

                {/* ══ MODAL DE EDIÇÃO DE CORPOS VALIDADOS ══ */}
                <Modal
                    visible={editModalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={closeEditModal}
                >
                    <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeEditModal}>
                                <Ionicons name="close" size={28} color={PRIMARY} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                                Corpos Validados
                            </Text>
                            <View style={{ width: 28 }} />
                        </View>

                        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                            {validatedBodies.length > 0 ? (
                                validatedBodies.map((body, index) => (
                                    <TouchableOpacity
                                        key={body.id}
                                        style={styles.validatedBodyCard}
                                        onPress={() => setSelectedEditBody(body)}
                                    >
                                        <View style={styles.validatedBodyHeader}>
                                            <View style={styles.validatedBodyTitleRow}>
                                                <Ionicons name="water" size={18} color={SUCCESS} />
                                                <Text style={[styles.validatedBodyTitle, { fontFamily: questrial }]} numberOfLines={2}>
                                                    {body.nome}
                                                </Text>
                                            </View>
                                            <View style={styles.validatedTypeBadge}>
                                                <Text style={[styles.validatedTypeBadgeText, { fontFamily: questrial }]}>
                                                    {body.tipo}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.validatedBodyInfo}>
                                            <View style={styles.validatedInfoRow}>
                                                <Ionicons name="location-outline" size={13} color="#6b7a7a" />
                                                <Text style={[styles.validatedInfoText, { fontFamily: questrial }]} numberOfLines={1}>
                                                    {body.municipio}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={styles.emptyEditContainer}>
                                    <Ionicons name="checkmark-done-outline" size={54} color="#bbb" />
                                    <Text style={[styles.emptyEditTitle, { fontFamily: questrial }]}>
                                        Nenhum corpo validado
                                    </Text>
                                    <Text style={[styles.emptyEditSubtitle, { fontFamily: questrial }]}>
                                        Não há corpos hídricos validados no momento.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>

            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F5F9F8" },
    headerGradient: {},
    headerSafeArea: { paddingBottom: 0 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", textAlign: "center", flex: 1 },
    body: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: { padding: 16, paddingBottom: 32 },
    card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    cardHeader: { marginBottom: 12 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: "#004d48", flex: 1 },
    typeBadge: { backgroundColor: "#e0f2f1", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    typeBadgeText: { fontSize: 11, color: "#004d48", fontWeight: "600" },
    cardInfo: { marginBottom: 10 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    infoText: { fontSize: 12, color: "#6b7a7a", flex: 1 },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e0f2f1" },
    tapText: { fontSize: 12, color: "#6b7a7a", fontWeight: "500" },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: "#004d48", marginTop: 16, textAlign: "center" },
    emptySubtitle: { fontSize: 14, color: "#6b7a7a", marginTop: 8, textAlign: "center" },
    modal: { flex: 1, backgroundColor: "#F5F9F8" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e0f2f1" },
    modalTitle: { fontSize: 18, fontWeight: "700", color: "#004d48", flex: 1, textAlign: "center" },
    modalContent: { flex: 1, padding: 16 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#004d48", marginBottom: 12 },
    detailField: { marginBottom: 12 },
    detailLabel: { fontSize: 12, color: "#6b7a7a", fontWeight: "600", marginBottom: 4 },
    detailValue: { fontSize: 14, color: "#1a1a1a", lineHeight: 20 },
    usoBadge: { backgroundColor: "#e0f2f1", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 8, alignSelf: "flex-start" },
    usoBadgeText: { fontSize: 13, color: "#004d48", fontWeight: "500" },
    reasonLabel: { fontSize: 13, color: "#6b7a7a", marginBottom: 8 },
    rejectReasonInput: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#d0d8d8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: "top", color: "#1a1a1a" },
    actionButtons: { flexDirection: "row", gap: 12, paddingVertical: 16 },
    rejectButton: { flex: 1, backgroundColor: DANGER, borderRadius: 10, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
    rejectButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    validateButton: { flex: 1, backgroundColor: SUCCESS, borderRadius: 10, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
    validateButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    buttonDisabled: { opacity: 0.6 },

    // Edit Card (Corpos Validados)
    editCard: { borderRadius: 14, overflow: "hidden", marginHorizontal: 16, marginTop: 12, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    editCardGradient: { paddingVertical: 18, paddingHorizontal: 16 },
    editCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
    editCardIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
    editCardText: { flex: 1 },
    editCardTitle: { fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 },
    editCardSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.85)" },

    // Validated Bodies Modal
    validatedBodyCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e0f2f1", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    validatedBodyHeader: { marginBottom: 8 },
    validatedBodyTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    validatedBodyTitle: { fontSize: 14, fontWeight: "700", color: "#004d48", flex: 1 },
    validatedTypeBadge: { backgroundColor: "rgba(26,140,128,0.12)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    validatedTypeBadgeText: { fontSize: 10, color: "#004d48", fontWeight: "600" },
    validatedBodyInfo: { marginTop: 8 },
    validatedInfoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    validatedInfoText: { fontSize: 11, color: "#6b7a7a", flex: 1 },
    emptyEditContainer: { paddingVertical: 60, alignItems: "center" },
    emptyEditTitle: { fontSize: 16, fontWeight: "700", color: "#6b7a7a", marginTop: 12, textAlign: "center" },
    emptyEditSubtitle: { fontSize: 13, color: "#b0c4c2", marginTop: 6, textAlign: "center" },
});
