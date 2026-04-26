// app/(tabs)/perfil.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack } from 'expo-router';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// ── Design tokens (espelham a Home) ──────────────────────────────────────────
const PRIMARY      = '#004d48';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png');

export default function PerfilScreen() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;

  const [loading, setLoading]         = useState(true);
  const [userData, setUserData]       = useState({ nome: '', cidade: '', uf: '', email: '' });
  const [rios, setRios]               = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState<{ total: number; rios: string[] }>({ total: 0, rios: [] });

  
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    return `${user.substring(0, 3)}****@${domain}`;
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user.uid);
      } else {
        setLoading(false);
        console.log('Nenhum usuário logado.');
      }
    });

    const fetchData = async (uid: string) => {
      try {
        // 1. Dados do usuário
        const userRef  = doc(db, 'usuarios', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserData({
            nome:   data.nome   || 'Usuário',
            cidade: data.cidade || 'Não informada',
            uf:     'PE',
            email:  data.email  || '',
          });
        }

        // 2. Corpos hídricos
        const qRios    = query(collection(db, 'corposHidricos'), where('uid', '==', uid));
        const riosSnap = await getDocs(qRios);
        setRios(riosSnap.docs.map(d => d.data().nome));

        // 3. Observações
        const qObs    = query(collection(db, 'observacoes'), where('uid', '==', uid));
        const obsSnap = await getDocs(qObs);
        const riosComObs = Array.from(new Set(obsSnap.docs.map(d => d.data().nomeRio)));
        setObservacoes({ total: obsSnap.size, rios: riosComObs });

      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    return () => unsubscribe();
  }, []);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={[styles.loadingText, { fontFamily: questrial }]}>Carregando perfil...</Text>
      </View>
    );
  }

  const initials    = userData.nome ? userData.nome.charAt(0).toUpperCase() : '?';
  const localizacao = `${userData.cidade} - ${userData.uf}`;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>

        {/* ══ HEADER ══ */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <LinearGradient
            colors={['#0d9080', '#1fc8b4', '#3ff3e7']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.tealOverlay}
          />

          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <Image
              source={logoImg}
              style={styles.headerLogo}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />

            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={[styles.avatarText, { fontFamily: questrial }]}>{initials}</Text>
              </View>
              <View style={styles.avatarInfo}>
                <Text style={[styles.headerName, { fontFamily: questrial }]} numberOfLines={1}>
                  {userData.nome}
                </Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" style={{ marginRight: 3 }} />
                  <Text style={[styles.headerLocation, { fontFamily: questrial }]}>{localizacao}</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>

          
          <View style={styles.waveWhite} />
        </LinearGradient>

        {/* ══ CONTEÚDO ══ */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Visão geral ── */}
          <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Visão geral</Text>

          {/* Card: Corpos hídricos */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="water" size={22} color={PRIMARY} />
              </View>
              <Text style={[styles.cardTitle, { fontFamily: questrial }]}>
                Corpos hídricos registrados
              </Text>
              <Text style={[styles.cardNumber, { fontFamily: questrial }]}>{rios.length}</Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardDetails}>
              {rios.length > 0 ? (
                rios.map((rio, index) => (
                  <View key={index} style={styles.detailRow}>
                    <Ionicons name="ellipse" size={6} color={PRIMARY} style={{ marginRight: 8, marginTop: 5 }} />
                    <Text style={[styles.detailItem, { fontFamily: questrial }]}>{rio}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.detailEmpty, { fontFamily: questrial }]}>
                  Nenhum corpo hídrico encontrado.
                </Text>
              )}
            </View>
          </View>

          {/* Card: Observações */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="create-outline" size={22} color={PRIMARY} />
              </View>
              <Text style={[styles.cardTitle, { fontFamily: questrial }]}>Observações feitas</Text>
              <Text style={[styles.cardNumber, { fontFamily: questrial }]}>{observacoes.total}</Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardDetails}>
              {observacoes.rios.length > 0 ? (
                observacoes.rios.map((rio, index) => (
                  <View key={index} style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color={PRIMARY} style={{ marginRight: 6 }} />
                    <Text style={[styles.detailItem, { fontFamily: questrial }]}>{rio}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.detailEmpty, { fontFamily: questrial }]}>
                  Nenhuma observação registrada.
                </Text>
              )}
            </View>
          </View>

          {/* ── Configurações da conta ── */}
          <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Configurações da conta</Text>

          <View style={styles.card}>
            {/* E-mail */}
            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <View style={styles.configIconCircle}>
                  <Ionicons name="mail-outline" size={16} color={PRIMARY} />
                </View>
                <View>
                  <Text style={[styles.configLabel, { fontFamily: questrial }]}>E-mail</Text>
                  <Text style={[styles.configValue, { fontFamily: questrial }]}>
                    {maskEmail(userData.email)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.8}>
                <LinearGradient
                  colors={['#004d48', '#0a6b5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.configBtn}
                >
                  <Text style={[styles.configBtnText, { fontFamily: questrial }]}>Editar e-mail</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.cardDivider} />

            {/* Senha */}
            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <View style={styles.configIconCircle}>
                  <Ionicons name="lock-closed-outline" size={16} color={PRIMARY} />
                </View>
                <View>
                  <Text style={[styles.configLabel, { fontFamily: questrial }]}>Senha</Text>
                  <Text style={[styles.configValue, { fontFamily: questrial }]}>••••••••</Text>
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.8}>
                <LinearGradient
                  colors={['#004d48', '#0a6b5e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.configBtn}
                >
                  <Text style={[styles.configBtnText, { fontFamily: questrial }]}>Alterar senha</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Botões de ação ── */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtnWrapper} activeOpacity={0.82}>
              <LinearGradient
                colors={['#004d48', '#0a6b5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtn}
              >
                <Ionicons name="pause-circle-outline" size={16} color="#FFFFFF" style={{ marginBottom: 4 }} />
                <Text style={[styles.actionBtnText, { fontFamily: questrial }]}>Desativar{'\n'}conta</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnWrapper} activeOpacity={0.82}>
              <LinearGradient
                colors={['#8b1a1a', '#c0392b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtn}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginBottom: 4 }} />
                <Text style={[styles.actionBtnText, { fontFamily: questrial }]}>Excluir{'\n'}conta</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SURFACE,
  },
  loadingText: { marginTop: 10, color: PRIMARY, fontSize: 14 },

  // Header
  headerGradient: { overflow: 'hidden' },
  tealOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  headerSafeArea: { paddingBottom: 0, zIndex: 1 },
  headerLogo: {
    width: 160,
    height: 100,
    alignSelf: 'center',
    marginTop: -30,
    marginBottom: 18,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, color: '#FFFFFF', fontWeight: '700' },
  avatarInfo: { flex: 1 },
  headerName: { fontSize: 22, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  headerLocation: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  waveWhite: {
    height: 28,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Body
  body: { flex: 1, backgroundColor: '#FFFFFF' },
  bodyContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    marginTop: 18,
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  // Card
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(63,243,231,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { flex: 1, fontSize: 15, color: PRIMARY, fontWeight: '600' },
  cardNumber: { fontSize: 26, fontWeight: '700', color: PRIMARY },
  cardDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginVertical: 12 },
  cardDetails: { paddingLeft: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  detailItem: { fontSize: 13, color: '#444', lineHeight: 19, flex: 1 },
  detailEmpty: { fontSize: 13, color: TEXT_MUTED, fontStyle: 'italic' },

  // Configurações
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  configLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  configIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(63,243,231,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 1 },
  configValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  configBtn: {
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  configBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },

  // Botões de ação
  actionRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  actionBtnWrapper: { flex: 1 },
  actionBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
  },
});