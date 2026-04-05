import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";
import { syncUserVerificationStatus } from "@/services/auth/register";

export default function AwaitingVerification() {
    const [checking, setChecking] = useState(false);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    async function handleCheckVerification() {
        setChecking(true);
        try {
            const isVerified = await syncUserVerificationStatus();

            if (isVerified) {
                // E-mail confirmado — vai para a tela principal
                router.replace("/login" as any); 
            } else {
                Alert.alert(
                    "E-mail ainda não verificado",
                    "Verifique sua caixa de entrada (e a pasta de spam) e clique no link que enviamos."
                );
            }
        } catch (err: any) {
            Alert.alert("Erro", err.message ?? "Não foi possível verificar. Tente novamente.");
        } finally {
            setChecking(false);
        }
    }

    async function handleLogout() {
        await signOut(auth);
        router.replace("/login" as any); // troca pela sua rota de login
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
                    <Ionicons name="mail-outline" size={72} color="rgba(255,255,255,0.9)" />

                    <Text style={[styles.title, { fontFamily: questrial }]}>
                        Verifique seu e-mail
                    </Text>

                    <Text style={[styles.subtitle, { fontFamily: questrial }]}>
                        Enviamos um link de confirmação para o seu e-mail.
                        Clique no link e depois volte aqui.
                    </Text>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleCheckVerification}
                        activeOpacity={0.85}
                        disabled={checking}
                    >
                        {checking ? (
                            <ActivityIndicator color="#004d48" />
                        ) : (
                            <Text style={[styles.primaryButtonText, { fontFamily: questrial }]}>
                                JÁ VERIFIQUEI MEU E-MAIL
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleLogout}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.secondaryButtonText, { fontFamily: questrial }]}>
                            Voltar para o login
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
    title: {
        color: "#ffffff",
        fontSize: 22,
        fontWeight: "700",
        letterSpacing: 1,
        textAlign: "center",
        marginTop: 24,
        marginBottom: 16,
    },
    subtitle: {
        color: "rgba(255,255,255,0.85)",
        fontSize: 15,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 40,
    },
    primaryButton: {
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 50,
        height: 52,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: "#004d48",
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 1.5,
    },
    secondaryButton: {
        paddingVertical: 12,
    },
    secondaryButtonText: {
        color: "rgba(255,255,255,0.75)",
        fontSize: 14,
        textDecorationLine: "underline",
    },
});