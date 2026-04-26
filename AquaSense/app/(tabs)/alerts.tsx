// ARQUIVO: app/(tabs)/alerts.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Platform, Image, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';


const PRIMARY = '#004d48';
const SURFACE = '#F5F9F8';
const TEXT_MUTED = '#6b7a7a';

// Tipos do Mock
type AlertSeverity = 'Crítico' | 'Atenção' | 'Informativo';

interface AlertItem {
  id: string;
  title: string;
  waterBody: string;
  timeAgo: string;
  severity: AlertSeverity;
  description: string;
}

export default function AlertsScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;
  
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  // MOCK: Busca de Alertas (Substituir pela integração real abaixo)
  useEffect(() => {
    // =========================================================================
    // TO DO: INTEGRAR COM O FIREBASE AQUI
    // Substituir este setTimeout por uma busca real na coleção de alertas
    // Exemplo:
    // const snap = await getDocs(collection(db, 'alertas'));
    // setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    // =========================================================================
    setTimeout(() => {
      setAlerts([
        {
          id: '1',
          title: 'Alerta crítico',
          waterBody: 'Rio Capibaribe',
          timeAgo: 'Há 1 hora',
          severity: 'Crítico',
          description: 'Devido a altas taxas de poluição, recomenda-se evitar qualquer contato direto.',
        },
        {
          id: '2',
          title: 'Aviso de atenção',
          waterBody: 'Canal do Fragoso',
          timeAgo: 'Há 5 horas',
          severity: 'Atenção',
          description: 'Nível da água subiu consideravelmente após as chuvas recentes. Risco leve de transbordamento.',
        },
        {
          id: '3',
          title: 'Atualização',
          waterBody: 'Açude de Apipucos',
          timeAgo: 'Há 1 dia',
          severity: 'Informativo',
          description: 'A equipe técnica validou as últimas observações. Qualidade da água classificada como regular.',
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case 'Crítico': return { icon: 'notifications', iconColor: '#d32f2f', bgIcon: '#ffebee', bgBadge: '#ffcdd2', textBadge: '#c62828' };
      case 'Atenção': return { icon: 'warning', iconColor: '#f57c00', bgIcon: '#fff3e0', bgBadge: '#ffe0b2', textBadge: '#e65100' };
      case 'Informativo': return { icon: 'information-circle', iconColor: '#1976d2', bgIcon: '#e3f2fd', bgBadge: '#bbdefb', textBadge: '#0d47a1' };
      default: return { icon: 'notifications', iconColor: PRIMARY, bgIcon: '#e0f2f1', bgBadge: '#b2dfdb', textBadge: PRIMARY };
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ══ HEADER ══ */}
      <LinearGradient colors={['#004d48', '#0a6b5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/aquasense-name.png')} // Ajuste o caminho se necessário
              style={styles.headerLogo}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ══ FAIXA TEAL COM CURVA E TÍTULO ══ */}
      <LinearGradient colors={['#0a6b5e', '#1fc8b4', '#3ff3e7']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
        <View style={styles.titleContainer}>
          <Text style={[styles.pageTitle, { fontFamily: questrial }]}>Alertas</Text>
        </View>
        <View style={styles.waveWhite} />
      </LinearGradient>

      {/* ══ FEED DE ALERTAS ══ */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 40 }} />
        ) : (
          alerts.map((alert) => {
            const stylesSeverity = getSeverityStyle(alert.severity);
            return (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: stylesSeverity.bgIcon }]}>
                    <Ionicons name={stylesSeverity.icon as any} size={26} color={stylesSeverity.iconColor} />
                  </View>
                  <View style={styles.alertHeaderTexts}>
                    <Text style={[styles.alertCardTitle, { fontFamily: questrial }]}>{alert.title}</Text>
                    <Text style={[styles.alertWaterBody, { fontFamily: questrial }]} numberOfLines={1}>{alert.waterBody}</Text>
                  </View>
                  <Text style={[styles.timeAgo, { fontFamily: questrial }]}>{alert.timeAgo}</Text>
                </View>

                <View style={[styles.severityBadge, { backgroundColor: stylesSeverity.bgBadge }]}>
                  <View style={[styles.severityDot, { backgroundColor: stylesSeverity.iconColor }]} />
                  <Text style={[styles.severityBadgeText, { fontFamily: questrial, color: stylesSeverity.textBadge }]}>
                    {alert.severity}
                  </Text>
                </View>

                <Text style={[styles.alertDescription, { fontFamily: questrial }]}>
                  {alert.description}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ══ NAVBAR INFERIOR (Mesmo da Home) ══ */}
      <SafeAreaView edges={["bottom"]} style={styles.navBarWrapper}>
        <View style={styles.navBar}>
          <NavBarItem icon="home" iconOutline="home-outline" label="Home" active={false} fontFamily={questrial} onPress={() => router.replace('/home' as any)} />
          <NavBarItem icon="map" iconOutline="map-outline" label="Mapa" active={false} fontFamily={questrial} onPress={() => router.replace('/map' as any)} />
          <TouchableOpacity style={styles.fabButton} onPress={() => router.push('/register_water_body' as any)} activeOpacity={0.85}>
            <View style={styles.fabInner}><Ionicons name="add" size={32} color="#FFFFFF" /></View>
          </TouchableOpacity>
          <NavBarItem icon="notifications" iconOutline="notifications-outline" label="Alertas" active={true} fontFamily={questrial} onPress={() => {}} />
          <NavBarItem icon="person" iconOutline="person-outline" label="Perfil" active={false} fontFamily={questrial} onPress={() => router.replace('/profile' as any)} />
        </View>
      </SafeAreaView>
    </View>
  );
}


function NavBarItem({ icon, iconOutline, label, active, fontFamily, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  label: string; active: boolean; fontFamily?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={active ? icon : iconOutline} size={24} color={active ? PRIMARY : "#b0c4c2"} />
      <Text style={[styles.navLabel, { fontFamily, color: active ? PRIMARY : "#b0c4c2" }]}>{label}</Text>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },
  
  headerSafeArea: { paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 10 },
  logoContainer: { alignItems: 'center' },
  headerLogo: { height: 26, width: 160 },

  titleContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10 },
  pageTitle: { fontSize: 26, fontWeight: '700', color: '#FFFFFF' }, // CORRIGIDO PARA BRANCO!
  waveWhite: { height: 28, backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 100 }, // Aumentado padding bottom por conta da Navbar sobreposta

  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  alertHeaderTexts: { flex: 1 },
  alertCardTitle: { fontSize: 13, color: '#444' },
  alertWaterBody: { fontSize: 18, color: '#333', fontWeight: '700', marginTop: 2 },
  timeAgo: { fontSize: 12, color: TEXT_MUTED, alignSelf: 'flex-start' },

  severityBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, marginBottom: 12 },
  severityDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  severityBadgeText: { fontSize: 12, fontWeight: '700' },

  alertDescription: { fontSize: 14, color: '#555', lineHeight: 20 },

  // Navbar Styles
  navBarWrapper: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 22, borderTopRightRadius: 22, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 12, position: 'absolute', bottom: 0, left: 0, right: 0 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 4 : 10, paddingHorizontal: 8 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navLabel: { fontSize: 10, marginTop: 3, letterSpacing: 0.1 },
  fabButton: { width: 56, height: 56, borderRadius: 28, marginBottom: 16, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 10, elevation: 8 },
  fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
});