import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Animated,
    TouchableOpacity,
    FlatList,
    Modal,
    Alert,
    ActivityIndicator,
    TextInput,
    Switch,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { getCollaborators, updateUserStatus } from "@/services/firestore/users";
import { UsuarioColaborador } from "@/types";

const PRIMARY = "#004d48";
const SUCCESS = "#22c55e";
const WARNING = "#f59e0b";

export default function ManageCollaborators() {
    const router = useRouter();
    const { userProfile } = useAuth();
    const [collaborators, setCollaborators] = useState<UsuarioColaborador[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedCollaborator, setSelectedCollaborator] = useState<UsuarioColaborador | null>(null);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();

        fetchCollaborators();
    }, []);

    const fetchCollaborators = async () => {
        try {
            setLoading(true);
            const data = await getCollaborators();
            setCollaborators(data);
        } catch (error) {
            console.error("Erro ao buscar colaboradores:", error);
            Alert.alert("Erro", "Não foi possível carregar os colaboradores");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (userId: string, newStatus: "ativa" | "inativa") => {
        try {
            setUpdatingUserId(userId);
            await updateUserStatus(userId, newStatus);
            
            setCollaborators(prev =>
                prev.map(col =>
                    col.uid === userId ? { ...col, statusConta: newStatus } : col
                )
            );
            
            Alert.alert(
                "Sucesso",
                `Colaborador ${newStatus === "ativa" ? "ativado" : "desativado"} com sucesso!`
            );
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            Alert.alert("Erro", "Não foi possível atualizar o status do colaborador");
        } finally {
            setUpdatingUserId(null);
        }
    };

    const openDetailModal = (collaborator: UsuarioColaborador) => {
        setSelectedCollaborator(collaborator);
        setModalVisible(true);
    };

    const closeDetailModal = () => {
        setModalVisible(false);
        setSelectedCollaborator(null);
    };

    const renderCollaboratorCard = ({ item }: { item: UsuarioColaborador }) => (
        <TouchableOpacity
            onPress={() => openDetailModal(item)}
            style={styles.collaboratorCard}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                        {item.nome.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.collaboratorName}>{item.nome}</Text>
                    <Text style={styles.collaboratorEmail}>{item.email}</Text>
                    <Text style={styles.collaboratorOrganization}>{item.organizacao}</Text>
                </View>
                <View style={styles.statusContainer}>
                    <View
                        style={[
                            styles.statusBadge,
                            item.statusConta === "ativa"
                                ? styles.statusActive
                                : styles.statusInactive,
                        ]}
                    >
                        <Ionicons
                            name={item.statusConta === "ativa" ? "checkmark-circle" : "close-circle"}
                            size={16}
                            color="#FFFFFF"
                        />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={PRIMARY} />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: "Colaboradores",
                    headerStyle: { backgroundColor: PRIMARY },
                    headerTintColor: "#FFFFFF",
                    headerTitleStyle: { fontSize: 16, fontWeight: "700" },
                }}
            />
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
            <SafeAreaView style={styles.container} edges={["bottom"]}>
                <Animated.View
                    style={[
                        styles.content,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {collaborators.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={64} color="#b0c4c2" />
                            <Text style={styles.emptyTitle}>Nenhum colaborador cadastrado</Text>
                            <Text style={styles.emptySubtitle}>
                                Novos colaboradores aparecerão aqui quando forem registrados
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={collaborators}
                            renderItem={renderCollaboratorCard}
                            keyExtractor={(item) => item.uid}
                            contentContainerStyle={styles.listContent}
                            scrollEnabled={true}
                        />
                    )}
                </Animated.View>

                {/* Modal de Detalhes */}
                <Modal
                    visible={modalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={closeDetailModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            {selectedCollaborator && (
                                <ScrollView
                                    style={styles.detailScroll}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Header */}
                                    <View style={styles.detailHeader}>
                                        <TouchableOpacity onPress={closeDetailModal}>
                                            <Ionicons
                                                name="close-outline"
                                                size={28}
                                                color={PRIMARY}
                                            />
                                        </TouchableOpacity>
                                        <Text style={styles.detailTitle}>Detalhes do Colaborador</Text>
                                        <View style={{ width: 28 }} />
                                    </View>

                                    {/* Avatar Grande */}
                                    <View style={styles.detailAvatarContainer}>
                                        <View style={styles.detailAvatar}>
                                            <Text style={styles.detailAvatarText}>
                                                {selectedCollaborator.nome.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.detailName}>{selectedCollaborator.nome}</Text>
                                        <Text style={styles.detailEmail}>{selectedCollaborator.email}</Text>
                                    </View>

                                    {/* Informações */}
                                    <View style={styles.infoSection}>
                                        <Text style={styles.sectionTitle}>Informações</Text>

                                        <View style={styles.infoRow}>
                                            <Text style={styles.infoLabel}>Email</Text>
                                            <Text style={styles.infoValue}>{selectedCollaborator.email}</Text>
                                        </View>

                                        <View style={styles.infoRow}>
                                            <Text style={styles.infoLabel}>Organização</Text>
                                            <Text style={styles.infoValue}>{selectedCollaborator.organizacao}</Text>
                                        </View>

                                        <View style={styles.infoRow}>
                                            <Text style={styles.infoLabel}>Cidade</Text>
                                            <Text style={styles.infoValue}>{selectedCollaborator.cidade}</Text>
                                        </View>

                                        <View style={styles.infoRow}>
                                            <Text style={styles.infoLabel}>Data de Criação</Text>
                                            <Text style={styles.infoValue}>
                                                {selectedCollaborator.dataCriacao
                                                    ? new Date(selectedCollaborator.dataCriacao.toDate()).toLocaleDateString()
                                                    : "N/A"}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Status */}
                                    <View style={styles.statusSection}>
                                        <Text style={styles.sectionTitle}>Status da Conta</Text>

                                        <View style={styles.statusToggle}>
                                            <View>
                                                <Text style={styles.toggleLabel}>Conta Ativa</Text>
                                                <Text style={styles.toggleDescription}>
                                                    {selectedCollaborator.statusConta === "ativa"
                                                        ? "Colaborador pode acessar o sistema"
                                                        : "Colaborador não pode acessar o sistema"}
                                                </Text>
                                            </View>
                                            <Switch
                                                value={selectedCollaborator.statusConta === "ativa"}
                                                onValueChange={(newValue) => {
                                                    const newStatus = newValue ? "ativa" : "inativa";
                                                    handleStatusChange(selectedCollaborator.uid, newStatus);
                                                }}
                                                disabled={updatingUserId === selectedCollaborator.uid}
                                                trackColor={{ false: "#d1d5db", true: "#86efac" }}
                                                thumbColor={selectedCollaborator.statusConta === "ativa" ? SUCCESS : "#f3f4f6"}
                                            />
                                        </View>
                                    </View>

                                    {/* Ações */}
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={styles.buttonCancel}
                                            onPress={closeDetailModal}
                                        >
                                            <Text style={styles.buttonCancelText}>Fechar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F9F8" },
    centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F9F8" },
    content: { flex: 1 },
    listContent: { paddingVertical: 12, paddingHorizontal: 16 },

    // Colaborador Card
    collaboratorCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#e0f2f1",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: PRIMARY,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
    cardInfo: { flex: 1 },
    collaboratorName: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 2 },
    collaboratorEmail: { fontSize: 11, color: "#6b7a7a", marginBottom: 2 },
    collaboratorOrganization: { fontSize: 10, color: "#9ca3a3", fontStyle: "italic" },
    statusContainer: { justifyContent: "center", alignItems: "center" },
    statusBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    statusActive: { backgroundColor: SUCCESS },
    statusInactive: { backgroundColor: "#ef4444" },

    // Empty State
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: "#6b7a7a", marginTop: 16, textAlign: "center" },
    emptySubtitle: { fontSize: 13, color: "#b0c4c2", marginTop: 8, textAlign: "center" },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "90%",
        paddingBottom: 20,
    },
    detailScroll: { paddingHorizontal: 20 },
    detailHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 16,
        paddingTop: 20,
    },
    detailTitle: { fontSize: 16, fontWeight: "700", color: PRIMARY },

    // Avatar Grande
    detailAvatarContainer: { alignItems: "center", marginVertical: 20 },
    detailAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: PRIMARY,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    detailAvatarText: { fontSize: 36, fontWeight: "700", color: "#FFFFFF" },
    detailName: { fontSize: 18, fontWeight: "700", color: PRIMARY },
    detailEmail: { fontSize: 12, color: "#6b7a7a", marginTop: 4 },

    // Seções
    infoSection: { marginBottom: 24 },
    statusSection: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 12 },
    infoRow: {
        backgroundColor: "#f9fafb",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 8,
    },
    infoLabel: { fontSize: 11, color: "#9ca3a3", fontWeight: "600", marginBottom: 2 },
    infoValue: { fontSize: 13, color: PRIMARY, fontWeight: "600" },

    // Toggle
    statusToggle: {
        backgroundColor: "#f0f9f8",
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    toggleLabel: { fontSize: 13, fontWeight: "700", color: PRIMARY, marginBottom: 2 },
    toggleDescription: { fontSize: 11, color: "#9ca3a3" },

    // Botões
    actionButtons: { gap: 10, marginTop: 20 },
    buttonCancel: {
        backgroundColor: "#e5e7eb",
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    buttonCancelText: { fontSize: 14, fontWeight: "700", color: "#6b7a7a" },
});
