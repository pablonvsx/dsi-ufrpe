import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform, Animated, KeyboardAvoidingView,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

const PRIMARY = '#004d48';
const TEAL_MID = '#0d9080';
const SURFACE = '#F5F9F8';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED = '#6b7a7a';

type Step = 'select' | 'form';

interface WaterBody {
  id: string;
  name: string;
  municipio?: string;
  cadastroValido: boolean;
}

export default function ReportComplaint() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;

  const [step, setStep] = useState<Step>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<WaterBody | null>(null);
  
  const [waterBodies, setWaterBodies] = useState<WaterBody[]>([]);
  const [loadingBodies, setLoadingBodies] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [grau, setGrau] = useState<'Baixa' | 'Média' | 'Alta' | null>(null);
  const [descricao, setDescricao] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;

  // Carregando os corpos hídricos reais do Firestore 
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'corposHidricos'));
        const bodies: WaterBody[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().nome ?? 'Sem nome',
          municipio: d.data().municipio,
          cadastroValido: d.data().cadastroValido ?? false,
        }));
        setWaterBodies(bodies);
      } catch (e) {
        console.error('Erro ao carregar corpos hídricos:', e);
      } finally {
        setLoadingBodies(false);
      }
    })();
  }, []);


  useEffect(() => {
    fadeAnim.setValue(0); slideAnim.setValue(18);
    cardFade.setValue(0); cardSlide.setValue(24);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade,  { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, [step]);

  const filtered = waterBodies.filter((wb) =>
    wb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (wb.municipio ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleBack() {
    if (step === 'form') {
      setStep('select');
      setErrorMsg('');
    } else {
      router.back();
    }
  }

  // MOCK: Envio da Denúncia (Substituir depois pela integração real abaixo)
  async function handlePublish() {
    if (!titulo.trim() || !grau || !descricao.trim()) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }
    setErrorMsg('');
    setSaving(true);
    
    try {
      const userId = auth.currentUser?.uid ?? 'anonymous';
      
      // =========================================================================
      // TO DO: INTEGRAR COM O FIREBASE AQUI
      // Criar o arquivo @/services/firestore/complaints.ts com uma função:
      // export async function salvarDenuncia(dados: any) {
      //    return await addDoc(collection(db, 'denuncias'), { ...dados, data: serverTimestamp() });
      // }
      // E chamar ela aqui:
      // await salvarDenuncia({ corpoHidricoId: selected?.id, titulo, grau, descricao, userId });
      // =========================================================================
      
      // Simulando delay de rede para o Mock
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSuccessVisible(true);
    } catch (e) {
      console.error('Erro ao salvar denúncia:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>
        {/* ══ HEADER ══ */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { fontFamily: questrial }]}>Fazer denúncia</Text>
              <View style={styles.headerSpacer} />
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ FAIXA TEAL COM CURVA ══ */}
        <LinearGradient
          colors={['#0a6b5e', '#1fc8b4', '#3ff3e7']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.tealBand}
        >
          {step === 'select' && (
            <Animated.View style={[styles.searchWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Ionicons name="search-outline" size={18} color={TEXT_MUTED} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { fontFamily: questrial }]}
                placeholder="Buscar corpo hídrico..."
                placeholderTextColor={TEXT_MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {step === 'form' && (
            <Animated.View style={[styles.selectedBadgeWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <TouchableOpacity style={styles.selectedBadge} onPress={() => setStep('select')} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={18} color={TEAL_MID} />
                <Text style={[styles.selectedBadgeText, { fontFamily: questrial }]} numberOfLines={1}>{selected?.name}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={styles.waveWhite} />
        </LinearGradient>

        {/* ══ CONTEÚDO ══ */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.whiteBody} contentContainerStyle={styles.whiteBodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>
              
              {/* ── PASSO 1: BUSCAR RIO ── */}
              {step === 'select' && (
                <View>
                  {loadingBodies && <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />}
                  
                  {!loadingBodies && filtered.length > 0 && searchQuery.length > 0 && (
                    <View style={styles.listCard}>
                      {filtered.slice(0, 5).map((wb, idx) => (
                        <View key={wb.id}>
                          <TouchableOpacity style={styles.listItem} onPress={() => { setSelected(wb); setStep('form'); }} activeOpacity={0.7}>
                            <View style={styles.waterBodyIconCircle}>
                              <Ionicons name="water" size={16} color={TEAL_MID} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.listItemText, { fontFamily: questrial }]}>{wb.name}</Text>
                              {wb.municipio && <Text style={[styles.listItemSub, { fontFamily: questrial }]}>{wb.municipio}</Text>}
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
                          </TouchableOpacity>
                          {idx < Math.min(filtered.length, 5) - 1 && <View style={styles.listDivider} />}
                        </View>
                      ))}
                    </View>
                  )}

                  {!loadingBodies && (
                    <View style={styles.dividerContainer}>
                      <View style={styles.dividerLine} />
                      <Text style={[styles.dividerText, { fontFamily: questrial }]}>Ou</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  )}

                  {!loadingBodies && (
                    <TouchableOpacity style={styles.addButton} onPress={() => router.push('/register_water_body' as any)} activeOpacity={0.82}>
                      <Ionicons name="add" size={24} color={PRIMARY} style={{ marginRight: 8 }} />
                      <Text style={[styles.addButtonText, { fontFamily: questrial }]}>Adicionar novo corpo hídrico</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ── PASSO 2: FORMULÁRIO ── */}
              {step === 'form' && (
                <View>
                  {errorMsg ? <Text style={[styles.errorBanner, { fontFamily: questrial }]}>{errorMsg}</Text> : null}

                  <View style={styles.sectionCard}>
                    <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Título da denúncia</Text>
                    <View style={styles.sectionDivider} />
                    <TextInput
                      style={[styles.input, { fontFamily: questrial }]}
                      placeholder="Informe o título da denúncia..."
                      placeholderTextColor={TEXT_MUTED}
                      value={titulo}
                      onChangeText={setTitulo}
                    />
                  </View>

                  <View style={styles.sectionCard}>
                    <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Grau</Text>
                    <View style={styles.sectionDivider} />
                    <View style={styles.severityRow}>
                      {[
                        { label: 'Baixa', color: '#1fc8b4', val: 'Baixa' },
                        { label: 'Média', color: '#FFA000', val: 'Média' },
                        { label: 'Alta', color: '#E74C3C', val: 'Alta' }
                      ].map((item) => {
                        const active = grau === item.val;
                        return (
                          <TouchableOpacity key={item.val} style={styles.severityOption} onPress={() => setGrau(item.val as any)} activeOpacity={0.7}>
                            <View style={styles.severityCircleWrapper}>
                              {active ? (
                                <Ionicons name="checkmark-circle" size={24} color={item.color} />
                              ) : (
                                <View style={[styles.severityDot, { backgroundColor: item.color }]} />
                              )}
                            </View>
                            <Text style={[styles.severityText, { fontFamily: questrial, color: active ? PRIMARY : TEXT_MUTED, fontWeight: active ? '700' : '400' }]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.sectionCard}>
                    <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Descrição da denúncia</Text>
                    <View style={styles.sectionDivider} />
                    <TextInput
                      style={[styles.descInput, { fontFamily: questrial }]}
                      placeholder="Descreva detalhadamente o problema..."
                      placeholderTextColor={TEXT_MUTED}
                      value={descricao}
                      onChangeText={setDescricao}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity style={styles.publishButton} onPress={handlePublish} activeOpacity={0.85} disabled={saving}>
                    <LinearGradient colors={['#004d48', '#0d9080']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishGradient}>
                      {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.publishButtonText, { fontFamily: questrial }]}>Realizar denúncia</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ══ MODAL: SUCESSO ══ */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={44} color={PRIMARY} />
            </View>
            <Text style={[styles.successTitle, { fontFamily: questrial }]}>Denúncia registrada!</Text>
            <View style={styles.sectionDivider} />
            <Text style={[styles.successBody, { fontFamily: questrial }]}>
              Sua denúncia foi enviada com sucesso e será analisada pela equipe técnica.
            </Text>
            <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/(tabs)/home' as any)} activeOpacity={0.85}>
              <Text style={[styles.successBtnText, { fontFamily: questrial }]}>Voltar para a Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  headerGradient: {},
  headerSafeArea: { paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  headerSpacer: { width: 36 },

  tealBand: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 0, overflow: 'hidden' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 50, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },

  selectedBadgeWrapper: { marginBottom: 20, paddingHorizontal: 10 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 50, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  selectedBadgeText: { flex: 1, fontSize: 16, color: PRIMARY, fontWeight: '700', marginLeft: 8 },

  waveWhite: { height: 28, backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  whiteBody: { flex: 1, backgroundColor: SURFACE },
  whiteBodyContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },

  listCard: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  waterBodyIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(31,200,180,0.15)', alignItems: 'center', justifyContent: 'center' },
  listItemText: { fontSize: 15, color: '#333', fontWeight: '600' },
  listItemSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  listDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginLeft: 62 },

  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 10, paddingHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#D1E5E3" },
  dividerText: { marginHorizontal: 15, fontSize: 14, color: TEXT_MUTED },

  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderRadius: 50, height: 56, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, marginTop: 10 },
  addButtonText: { fontSize: 15, color: PRIMARY, fontWeight: "700" },

  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, color: PRIMARY, fontWeight: '700', marginBottom: 10 },
  sectionDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 14, width: '100%' },

  input: { backgroundColor: SURFACE, borderRadius: 12, height: 48, paddingHorizontal: 16, fontSize: 14, color: "#3d5a58" },
  descInput: { backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: "#3d5a58", minHeight: 100 },

  severityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  severityOption: { flexDirection: 'row', alignItems: 'center' },
  severityCircleWrapper: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  severityDot: { width: 14, height: 14, borderRadius: 7 },
  severityText: { fontSize: 14 },

  errorBanner: { backgroundColor: '#ffebee', color: '#c62828', padding: 12, borderRadius: 12, marginBottom: 14, textAlign: 'center', overflow: 'hidden' },

  publishButton: { borderRadius: 50, marginTop: 10, overflow: 'hidden', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 6 },
  publishGradient: { paddingVertical: 16, alignItems: 'center' },
  publishButtonText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.3 },

  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 28, alignItems: 'center' },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(63,243,231,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 14, textAlign: 'center' },
  successBody: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successBtn: { width: '100%', backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  successBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
});