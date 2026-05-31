import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";

import { auth } from "@/config/firebase";
import {
  buscarAlertasDoUsuario,
  marcarAlertaComoLido,
  Alerta,
  NivelAlerta,
} from "@/services/firestore/alerts";

const PRIMARY = "#004d48";
const SURFACE = "#F5F9F8";
const TEXT_MUTED = "#6b7a7a";

function formatarTempo(timestamp: any): string {
  if (!timestamp) return "Agora";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHoras < 24) return `Há ${diffHoras}h`;
  if (diffDias === 1) return "Há 1 dia";

  return `Há ${diffDias} dias`;
}

export default function AlertsScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [alerts, setAlerts] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAlertas();
  }, []);

  async function carregarAlertas() {
    setLoading(true);

    try {
      const uid = auth.currentUser?.uid;

      if (!uid) {
        setAlerts([]);
        return;
      }

      const dados = await buscarAlertasDoUsuario(uid);
      setAlerts(dados);
    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePressAlert(alerta: Alerta) {
    try {
      const uid = auth.currentUser?.uid;

      if (!uid) return;

      const jaLido = alerta.lidoPor?.includes(uid);

      if (!jaLido) {
        await marcarAlertaComoLido(alerta.id, uid);

        setAlerts((prev) =>
          prev.map((item) =>
            item.id === alerta.id
              ? {
                  ...item,
                  lidoPor: [...(item.lidoPor ?? []), uid],
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error("Erro ao marcar alerta como lido:", error);
    }
  }

  function getSeverityStyle(severity: NivelAlerta) {
    switch (severity) {
      case "Crítico":
        return {
          icon: "notifications",
          iconColor: "#d32f2f",
          bgIcon: "#ffebee",
          bgBadge: "#ffcdd2",
          textBadge: "#c62828",
        };

      case "Atenção":
        return {
          icon: "warning",
          iconColor: "#f57c00",
          bgIcon: "#fff3e0",
          bgBadge: "#ffe0b2",
          textBadge: "#e65100",
        };

      case "Informativo":
        return {
          icon: "information-circle",
          iconColor: "#1976d2",
          bgIcon: "#e3f2fd",
          bgBadge: "#bbdefb",
          textBadge: "#0d47a1",
        };

      default:
        return {
          icon: "notifications",
          iconColor: PRIMARY,
          bgIcon: "#e0f2f1",
          bgBadge: "#b2dfdb",
          textBadge: PRIMARY,
        };
    }
  }

  const uid = auth.currentUser?.uid;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={["#004d48", "#0a6b5e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
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

            <View style={styles.headerTextWrapper}>
              <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                Alertas
              </Text>
              <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                Acompanhe notificações importantes sobre corpos hídricos.
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

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color={PRIMARY} size="large" />
            <Text style={[styles.loadingText, { fontFamily: questrial }]}>
              Carregando alertas...
            </Text>
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-outline" size={34} color={PRIMARY} />
            </View>
            <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
              Nenhum alerta no momento
            </Text>
            <Text style={[styles.emptyText, { fontFamily: questrial }]}>
              Quando houver mudanças importantes ou alertas críticos, eles aparecerão aqui.
            </Text>
          </View>
        ) : (
          alerts.map((alerta) => {
            const severityStyle = getSeverityStyle(alerta.nivel);
            const lido = uid ? alerta.lidoPor?.includes(uid) : false;

            return (
              <TouchableOpacity
                key={alerta.id}
                style={[
                  styles.alertCard,
                  !lido && styles.alertCardUnread,
                ]}
                activeOpacity={0.82}
                onPress={() => handlePressAlert(alerta)}
              >
                <View style={styles.alertHeader}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: severityStyle.bgIcon },
                    ]}
                  >
                    <Ionicons
                      name={severityStyle.icon as any}
                      size={24}
                      color={severityStyle.iconColor}
                    />
                  </View>

                  <View style={styles.alertHeaderTexts}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.alertCardTitle,
                          { fontFamily: questrial },
                        ]}
                        numberOfLines={1}
                      >
                        {alerta.titulo}
                      </Text>

                      {!lido && <View style={styles.unreadDot} />}
                    </View>

                    <Text
                      style={[
                        styles.alertWaterBody,
                        { fontFamily: questrial },
                      ]}
                      numberOfLines={1}
                    >
                      {alerta.corpoHidricoNome ?? "Alerta geral"}
                    </Text>
                  </View>

                  <Text style={[styles.timeAgo, { fontFamily: questrial }]}>
                    {formatarTempo(alerta.criadoEm)}
                  </Text>
                </View>

                <View style={styles.badgesRow}>
                  <View
                    style={[
                      styles.severityBadge,
                      { backgroundColor: severityStyle.bgBadge },
                    ]}
                  >
                    <View
                      style={[
                        styles.severityDot,
                        { backgroundColor: severityStyle.iconColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.severityBadgeText,
                        {
                          fontFamily: questrial,
                          color: severityStyle.textBadge,
                        },
                      ]}
                    >
                      {alerta.nivel}
                    </Text>
                  </View>

                  <View style={styles.tipoBadge}>
                    <Ionicons
                      name={alerta.tipo === "global" ? "globe-outline" : "person-outline"}
                      size={12}
                      color={PRIMARY}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.tipoBadgeText, { fontFamily: questrial }]}>
                      {alerta.tipo === "global" ? "Global" : "Pessoal"}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.alertDescription, { fontFamily: questrial }]}>
                  {alerta.mensagem}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.navBarWrapper}>
        <View style={styles.navBar}>
          <NavBarItem
            icon="home"
            iconOutline="home-outline"
            label="Home"
            active={false}
            fontFamily={questrial}
            onPress={() => router.replace("/home_collaborator_update" as any)}
          />

          <NavBarItem
            icon="map"
            iconOutline="map-outline"
            label="Mapa"
            active={false}
            fontFamily={questrial}
            onPress={() => router.replace("/map" as any)}
          />

          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => router.push("/register_water_body" as any)}
            activeOpacity={0.85}
          >
            <View style={styles.fabInner}>
              <Ionicons name="add" size={32} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <NavBarItem
            icon="people"
            iconOutline="people-outline"
            label="Painel"
            active={false}
            fontFamily={questrial}
            onPress={() => router.replace("/community_panel" as any)}
          />

          <NavBarItem
            icon="person"
            iconOutline="person-outline"
            label="Perfil"
            active={false}
            fontFamily={questrial}
            onPress={() => router.replace("/profile" as any)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function NavBarItem({
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
          {
            fontFamily,
            color: active ? PRIMARY : "#b0c4c2",
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  headerSafeArea: {
    paddingTop: Platform.OS === "android" ? 40 : 10,
    paddingBottom: 18,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  headerTextWrapper: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    marginTop: 4,
    lineHeight: 18,
  },

  headerLogo: {
    width: 44,
    height: 44,
  },

  body: {
    flex: 1,
  },

  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 110,
  },

  loadingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },

  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },

  emptyWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },

  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#e6f4f1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 18,
    color: PRIMARY,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 21,
  },

  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },

  alertCardUnread: {
    borderColor: "#0a6b5e",
    borderWidth: 1.3,
  },

  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  alertHeaderTexts: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  alertCardTitle: {
    fontSize: 13,
    color: "#444",
    flex: 1,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e53935",
  },

  alertWaterBody: {
    fontSize: 17,
    color: "#333",
    fontWeight: "700",
    marginTop: 2,
  },

  timeAgo: {
    fontSize: 11,
    color: TEXT_MUTED,
    alignSelf: "flex-start",
    marginLeft: 6,
  },

  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },

  severityDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 6,
  },

  severityBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  tipoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f4f1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
  },

  tipoBadgeText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "700",
  },

  alertDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },

  navBarWrapper: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 4 : 10,
    paddingHorizontal: 8,
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },

  navLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.1,
  },

  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 16,
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