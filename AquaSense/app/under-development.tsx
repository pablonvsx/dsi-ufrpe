import React from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Image,
    TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";

export default function UnderDevelopment() {
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    async function handleLogout() {
        await signOut(auth);
        router.replace("/login" as any);
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient
                colors={["#004d48", "#1a8c80", "#3ff3e7"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.container}
            >
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

                <View style={styles.content}>
                    <Image
                        source={require("../assets/images/aquasense-logo.png")}
                        style={styles.logo}
                        resizeMode="contain"
                        tintColor="#FFFFFF"
                    />

                    <View style={styles.iconWrapper}>
                        <Ionicons name="construct-outline" size={52} color="rgba(255,255,255,0.9)" />
                    </View>

                    <Text style={[styles.title, { fontFamily: questrial }]}>
                        Tela em desenvolvimento
                    </Text>

                    <View style={styles.divider} />

                    <Text style={[styles.subtitle, { fontFamily: questrial }]}>
                        Em breve, você poderá acessar os recursos específicos do seu perfil no AquaSense.
                    </Text>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleLogout}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.buttonText, { fontFamily: questrial }]}>
                            SAIR DA CONTA
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
    },
    content: {
        paddingHorizontal: 40,
        alignItems: "center",
    },
    logo: {
        width: 140,
        height: 140,
        marginBottom: 8,
    },
    iconWrapper: {
        marginBottom: 20,
    },
    title: {
        color: "#ffffff",
        fontSize: 22,
        fontWeight: "700",
        letterSpacing: 1,
        textAlign: "center",
        marginBottom: 20,
    },
    divider: {
        width: "60%",
        height: 1,
        backgroundColor: "rgba(255,255,255,0.3)",
        marginBottom: 20,
    },
    subtitle: {
        color: "rgba(255,255,255,0.85)",
        fontSize: 15,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 48,
    },
    button: {
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 50,
        height: 52,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: "#004d48",
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 1.5,
    },
});