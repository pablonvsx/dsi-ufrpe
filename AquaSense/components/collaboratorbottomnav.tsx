import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const PRIMARY = "#004d48";

export type CollaboratorTabKey = "home" | "mapa" | "painel" | "perfil";

interface CollaboratorBottomNavProps {
    activeTab?: CollaboratorTabKey;
    fontFamily?: string;
    /** Override the FAB action. Defaults to /manage_water_bodies_collaborator */
    onFabPress?: () => void;
}

export default function CollaboratorBottomNav({
    activeTab,
    fontFamily,
    onFabPress,
}: CollaboratorBottomNavProps) {
    const router = useRouter();

    function handleTabPress(tab: CollaboratorTabKey) {
        switch (tab) {
            case "home":
                router.replace("/home_collaborator_update" as any);
                break;
            case "mapa":
                router.push("/map" as any);
                break;
            case "painel":
                router.push("/community_panel" as any);
                break;
            case "perfil":
                router.push("/(tabs)/profile_collaborator" as any);
                break;
        }
    }

    function handleFab() {
        if (onFabPress) {
            onFabPress();
        } else {
            router.push("/manage_water_bodies_collaborator" as any);
        }
    }

    return (
        <SafeAreaView edges={["bottom"]} style={styles.navWrapper}>
            <View style={styles.navBar}>
                <NavItem
                    icon="home"
                    iconOutline="home-outline"
                    label="Home"
                    active={activeTab === "home"}
                    fontFamily={fontFamily}
                    onPress={() => handleTabPress("home")}
                />
                <NavItem
                    icon="map"
                    iconOutline="map-outline"
                    label="Mapa"
                    active={activeTab === "mapa"}
                    fontFamily={fontFamily}
                    onPress={() => handleTabPress("mapa")}
                />

                {/* FAB central */}
                <View style={styles.fabSpacer}>
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={handleFab}
                        activeOpacity={0.85}
                    >
                        <View style={styles.fabInner}>
                            <Ionicons name="add" size={32} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                <NavItem
                    icon="people"
                    iconOutline="people-outline"
                    label="Painel"
                    active={activeTab === "painel"}
                    fontFamily={fontFamily}
                    onPress={() => handleTabPress("painel")}
                />
                <NavItem
                    icon="person"
                    iconOutline="person-outline"
                    label="Perfil"
                    active={activeTab === "perfil"}
                    fontFamily={fontFamily}
                    onPress={() => handleTabPress("perfil")}
                />
            </View>
        </SafeAreaView>
    );
}

// ─── NavItem interno ──────────────────────────────────────────────────────────

function NavItem({
    icon,
    iconOutline,
    label,
    active,
    fontFamily,
    onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    label: string;
    active: boolean;
    fontFamily?: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
            <Ionicons
                name={active ? icon : iconOutline}
                size={24}
                color={active ? PRIMARY : "#b0c4c2"}
            />
            <Text
                style={[
                    styles.navLabel,
                    { fontFamily, color: active ? PRIMARY : "#b0c4c2" },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    navWrapper: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 12,
    },
    navBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 4 : 10,
        paddingHorizontal: 8,
    },
    navItem: {
        width: "20%",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 4,
    },
    navLabel: {
        fontSize: 12,
        marginTop: 3,
        letterSpacing: 0.1,
    },
    fabSpacer: {
        width: "20%",
        alignItems: "center",
        justifyContent: "center",
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginTop: -22,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    fabInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: PRIMARY,
        alignItems: "center",
        justifyContent: "center",
    },
});