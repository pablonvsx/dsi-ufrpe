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
const INACTIVE = "#b0c4c2";

export type ManagerTabKey = "home" | "validacoes" | "dashboard" | "mapa" | "perfil";

interface ManagerBottomNavProps {
    activeTab?: ManagerTabKey;
    fontFamily?: string;
}

export default function ManagerBottomNav({ activeTab, fontFamily }: ManagerBottomNavProps) {
    const router = useRouter();

    function handleTabPress(tab: ManagerTabKey) {
        switch (tab) {
            case "home":
                router.replace("/(tabs)/home_manager" as any);
                break;
            case "validacoes":
                router.push("/(tabs)/manage_water_bodies" as any);
                break;
            case "dashboard":
                router.replace("/(tabs)/home_manager" as any);
                break;
            case "mapa":
                router.push("/(tabs)/map_manager" as any);                
                break;
            case "perfil":
                router.push("/(tabs)/profile" as any);
                break;
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
                    icon="checkbox"
                    iconOutline="checkbox-outline"
                    label="Validações"
                    active={activeTab === "validacoes"}
                    fontFamily={fontFamily}
                    onPress={() => handleTabPress("validacoes")}
                />

                {/* Dashboard FAB central */}
                <View style={styles.fabSpacer}>
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => handleTabPress("dashboard")}
                        activeOpacity={0.85}
                    >
                        <View style={styles.fabInner}>
                            <Ionicons name="bar-chart" size={22} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.fabLabel, fontFamily ? { fontFamily } : undefined]}>
                        Dashboard
                    </Text>
                </View>

                <NavItem
                    icon="map"
                    iconOutline="map-outline"
                    label="Mapa"
                    active={activeTab === "mapa"}
                    fontFamily={fontFamily}
                    onPress={() => handleTabPress("mapa")}
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
                color={active ? PRIMARY : INACTIVE}
            />
            <Text
                style={[
                    styles.navLabel,
                    { fontFamily, color: active ? PRIMARY : INACTIVE },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

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
        fontSize: 11,
        marginTop: 3,
        letterSpacing: 0.1,
    },
    fabSpacer: {
        width: "20%",
        alignItems: "center",
        justifyContent: "center",
    },
    fab: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginTop: -20,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    fabInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: PRIMARY,
        alignItems: "center",
        justifyContent: "center",
    },
    fabLabel: {
        fontSize: 11,
        marginTop: 3,
        color: PRIMARY,
        fontWeight: "600",
        letterSpacing: 0.1,
    },
});
