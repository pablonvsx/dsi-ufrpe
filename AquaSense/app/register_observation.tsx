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
import { salvarObservacao } from '../services/firestore/observations';

// ── Opções padronizadas (mesmas do register_water_body) ──────────────────────
const COR_OPTIONS = ['Transparente', 'Esverdeada', 'Amarelada', 'Marrom', 'Escura', 'Outra'] as const;
const ODOR_OPTIONS = ['Sem odor', 'Cheiro leve', 'Cheiro forte', 'Cheiro químico'] as const;

type CorOption = (typeof COR_OPTIONS)[number] | null;
type OdorOption = (typeof ODOR_OPTIONS)[number] | null;
type YesNo = 'sim' | 'nao' | null;

// ── Tokens de cor ────────────────────────────────────────────────────────────
const PRIMARY = '#004d48';
const TEAL_MID = '#0d9080';
const SURFACE = '#F5F9F8';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED = '#6b7a7a';

type Step = 'select' | 'form';

interface WaterBody {
  id: string;       // sempre o documentId do Firestore — d.id
  name: string;
  municipio?: string;
  tipo?: string;
  cadastroValido: boolean;
}

interface FormState {
  cor: CorOption;
  corDesc: string;
  odor: OdorOption;
  odorDesc: string;
  animais: YesNo;
  animaisDesc: string;
  lixo: YesNo;
  lixoDesc: string;
}

interface FormErrors {
  cor?: string;
  odor?: string;
  animais?: string;
  animaisDesc?: string;
  lixo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterObservation() {
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

  const [form, setForm] = useState<FormState>({
    cor: null, corDesc: '',
    odor: null, odorDesc: '',
    animais: null, animaisDesc: '',
    lixo: null, lixoDesc: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Animações
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;

  // ── Carrega corpos hídricos do Firestore ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'corposHidricos'));
        const bodies: WaterBody[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            // IMPORTANTE: id = d.id (documentId real do Firestore).
            // Nunca usar data.id ou qualquer campo interno do documento,
            // pois é este id que será gravado em observacoes.corpoHidricoId
            // e depois usado em buscarObservacoesPorCorpo().
            id: d.id,
            name: data.nome ?? 'Sem nome',
            municipio: data.municipio,
            tipo: data.tipo,
            cadastroValido: data.cadastroValido ?? false,
          };
        });
        bodies.sort((a, b) => {
          if (a.cadastroValido !== b.cadastroValido) return a.cadastroValido ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
        setWaterBodies(bodies);
      } catch (e) {
        console.error('[RegisterObservation] Erro ao carregar corpos hídricos:', e);
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
  const noResults = searchQuery.trim().length > 0 && filtered.length === 0;

  function handleBack() {
    if (step === 'form') setStep('select');
    else router.back();
  }

  // ── Validação ────────────────────────────────────────────────────────────
  function validateForm(): boolean {
    const e: FormErrors = {};

    if (!form.cor) e.cor = 'Selecione a cor observada.';
    if (!form.odor) e.odor = 'Selecione o odor observado.';
    if (!form.animais) e.animais = 'Informe se havia animais.';
    if (form.animais === 'sim' && !form.animaisDesc.trim())
      e.animaisDesc = 'Descreva os animais observados.';
    if (!form.lixo) e.lixo = 'Informe se havia lixo.';

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Envio ────────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!selected) return;
    if (!validateForm()) return;

    setSaving(true);
    try {
      const userId = auth.currentUser?.uid ?? 'anonymous';
      await salvarObservacao({
        corpoHidricoId: selected.id,
        criadoPor: userId,
        cor: form.cor,
        corDesc: form.corDesc,
        odor: form.odor,
        odorDesc: form.odorDesc,
        animais: form.animais,
        animaisDesc: form.animaisDesc,
        lixo: form.lixo,
        lixoDesc: form.lixoDesc,
      });
      setSuccessVisible(true);
    } catch (e) {
      console.error('[RegisterObservation] Erro ao salvar observação:', e);
    } finally {
      setSaving(false);
    }
  }

  function handleSuccessConfirm() {
    setSuccessVisible(false);
    router.replace('/(tabs)/map' as any);
  }

  // ─────────────────────────────────────────────────────────────────────────
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
              <Text style={[styles.headerTitle, { fontFamily: questrial, color: '#FFFFFF' }]}>
                Registrar observação
              </Text>
              <View style={styles.headerSpacer} />
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ FAIXA TEAL ══ */}
        <LinearGradient
          colors={['#0d9080', '#1fc8b4', '#3ff3e7']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.tealBand}
        >
          {step === 'select' ? (
            <Animated.View style={[styles.searchWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Ionicons name="search-outline" size={18} color={TEXT_MUTED} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { fontFamily: questrial }]}
                placeholder="Buscar corpo hídrico..."
                placeholderTextColor={TEXT_MUTED}
                value={searchQuery}
                onChangeText={(t) => { setSearchQuery(t); setSelected(null); }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSelected(null); }}>
                  <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              )}
            </Animated.View>
          ) : (
            <Animated.View style={[styles.selectedBadge, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Ionicons name="water" size={20} color={TEAL_MID} />
              <Text style={[styles.selectedBadgeText, { fontFamily: questrial }]}>{selected?.name}</Text>
              {!selected?.cadastroValido && (
                <View style={styles.pendenteBadge}>
                  <Text style={[styles.pendenteText, { fontFamily: questrial }]}>Pendente</Text>
                </View>
              )}
            </Animated.View>
          )}
          <View style={styles.waveWhite} />
        </LinearGradient>

        {/* ══ CONTEÚDO ══ */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {step === 'select' ? (
            <SelectStep
              filtered={filtered}
              noResults={noResults}
              searchQuery={searchQuery}
              selected={selected}
              loading={loadingBodies}
              onSelect={(wb) => setSelected(wb)}
              onRegisterNew={() => router.push('/register_water_body' as any)}
              onNext={() => { if (selected) setStep('form'); }}
              questrial={questrial}
              cardFade={cardFade}
              cardSlide={cardSlide}
            />
          ) : (
            <FormStep
              form={form}
              setForm={setForm}
              errors={errors}
              setErrors={setErrors}
              onPublish={handlePublish}
              saving={saving}
              questrial={questrial}
              cardFade={cardFade}
              cardSlide={cardSlide}
            />
          )}
        </KeyboardAvoidingView>
      </View>

      {/* ══ MODAL: SUCESSO ══ */}
      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={handleSuccessConfirm}>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={44} color={PRIMARY} />
            </View>
            <Text style={[styles.successTitle, { fontFamily: questrial }]}>Registro realizado!</Text>
            <View style={styles.successDivider} />
            <Text style={[styles.successBody, { fontFamily: questrial }]}>
              Sua observação foi salva com sucesso. Você já pode visualizar esse registro no mapa ao abrir os detalhes do corpo hídrico.
            </Text>
            <TouchableOpacity style={styles.successBtn} onPress={handleSuccessConfirm} activeOpacity={0.85}>
              <Text style={[styles.successBtnText, { fontFamily: questrial }]}>Ver no mapa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Seleção de corpo hídrico
// ─────────────────────────────────────────────────────────────────────────────
function SelectStep({
  filtered, noResults, searchQuery, selected, loading,
  onSelect, onRegisterNew, onNext, questrial, cardFade, cardSlide,
}: {
  filtered: WaterBody[]; noResults: boolean; searchQuery: string;
  selected: WaterBody | null; loading: boolean;
  onSelect: (wb: WaterBody) => void; onRegisterNew: () => void; onNext: () => void;
  questrial?: string; cardFade: Animated.Value; cardSlide: Animated.Value;
}) {
  const isEnabled = selected !== null;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.whiteBody}
        contentContainerStyle={styles.whiteBodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>
          {loading && (
            <View style={styles.emptyHint}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={[styles.emptyHintText, { fontFamily: questrial }]}>Carregando corpos hídricos...</Text>
            </View>
          )}

          {!loading && filtered.length > 0 && (
            <View style={styles.listCard}>
              {filtered.map((wb, idx) => {
                const isSelected = selected?.id === wb.id;
                return (
                  <React.Fragment key={wb.id}>
                    <TouchableOpacity
                      style={[styles.listItem, isSelected && styles.listItemSelected]}
                      onPress={() => onSelect(wb)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.waterBodyIconCircle, isSelected && styles.waterBodyIconCircleActive]}>
                        <Ionicons name="water" size={16} color={isSelected ? '#FFFFFF' : TEAL_MID} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listItemText, { fontFamily: questrial }, isSelected && styles.listItemTextSelected]}>
                          {wb.name}
                        </Text>
                        {wb.municipio ? (
                          <Text style={[styles.listItemSub, { fontFamily: questrial }]}>{wb.municipio}</Text>
                        ) : null}
                      </View>
                      {!wb.cadastroValido && (
                        <View style={styles.pendenteBadgeSm}>
                          <Ionicons name="time-outline" size={10} color="#f9a825" />
                        </View>
                      )}
                      <Ionicons name={isSelected ? 'checkmark-circle' : 'chevron-forward'} size={18} color={isSelected ? PRIMARY : TEXT_MUTED} />
                    </TouchableOpacity>
                    {idx < filtered.length - 1 && <View style={styles.listDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          )}

          {!loading && noResults && (
            <View style={styles.noResultsCard}>
              <View style={styles.noResultsIconCircle}>
                <Ionicons name="search-outline" size={24} color={TEAL_MID} />
              </View>
              <Text style={[styles.noResultsTitle, { fontFamily: questrial }]}>Corpo hídrico não encontrado</Text>
              <Text style={[styles.noResultsDesc, { fontFamily: questrial }]}>
                "{searchQuery}" não está cadastrado no sistema.
              </Text>
              <TouchableOpacity style={styles.noResultsButton} onPress={onRegisterNew} activeOpacity={0.82}>
                <Ionicons name="add-circle-outline" size={18} color={PRIMARY} style={{ marginRight: 6 }} />
                <Text style={[styles.noResultsButtonText, { fontFamily: questrial }]}>Cadastrar novo corpo hídrico</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !noResults && filtered.length === 0 && searchQuery.trim().length === 0 && (
            <View style={styles.emptyHint}>
              <Ionicons name="water-outline" size={36} color={BORDER_LIGHT} />
              <Text style={[styles.emptyHintText, { fontFamily: questrial }]}>Digite para pesquisar um corpo hídrico</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, !isEnabled && styles.primaryButtonDisabled]}
          onPress={onNext}
          activeOpacity={isEnabled ? 0.85 : 1}
          disabled={!isEnabled}
        >
          <Text style={[styles.primaryButtonText, { fontFamily: questrial }, !isEnabled && styles.primaryButtonTextDisabled]}>
            Registrar observação
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Formulário de observação
// ─────────────────────────────────────────────────────────────────────────────
function FormStep({
  form, setForm, errors, setErrors, onPublish, saving, questrial, cardFade, cardSlide,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  onPublish: () => void;
  saving: boolean;
  questrial?: string;
  cardFade: Animated.Value;
  cardSlide: Animated.Value;
}) {
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((p) => ({ ...p, [key]: undefined }));
  }

  return (
    <ScrollView
      style={styles.whiteBody}
      contentContainerStyle={[styles.whiteBodyContent, { paddingBottom: 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>

        {/* ── COR ── */}
        <SectionCard title="Cor *" questrial={questrial}>
          <RadioGroup
            options={[...COR_OPTIONS]}
            selected={form.cor}
            onSelect={(v) => update('cor', v as CorOption)}
            questrial={questrial}
            columns={3}
          />
          {errors.cor && <ErrorMsg message={errors.cor} fontFamily={questrial} />}
          <DescriptionInput
            value={form.corDesc}
            onChange={(v) => update('corDesc', v)}
            placeholder="Descreva melhor a cor observada..."
            questrial={questrial}
          />
        </SectionCard>

        {/* ── ODOR ── */}
        <SectionCard title="Odor *" questrial={questrial}>
          <RadioGroup
            options={[...ODOR_OPTIONS]}
            selected={form.odor}
            onSelect={(v) => update('odor', v as OdorOption)}
            questrial={questrial}
            columns={2}
          />
          {errors.odor && <ErrorMsg message={errors.odor} fontFamily={questrial} />}
          <DescriptionInput
            value={form.odorDesc}
            onChange={(v) => update('odorDesc', v)}
            placeholder="Descreva melhor o odor observado..."
            questrial={questrial}
          />
        </SectionCard>

        {/* ── ANIMAIS ── */}
        <SectionCard title="Presença de animais *" questrial={questrial}>
          <YesNoToggle
            value={form.animais}
            onChange={(v) => {
              update('animais', v);
              if (v === 'nao') update('animaisDesc', '');
            }}
            questrial={questrial}
          />
          {errors.animais && <ErrorMsg message={errors.animais} fontFamily={questrial} />}
          {form.animais === 'sim' && (
            <>
              <View style={styles.subLabelRow}>
                <Ionicons name="paw-outline" size={16} color={TEAL_MID} style={{ marginRight: 6 }} />
                <Text style={[styles.subLabel, { fontFamily: questrial }]}>Quais animais você observou?</Text>
              </View>
              <DescriptionInput
                value={form.animaisDesc}
                onChange={(v) => update('animaisDesc', v)}
                placeholder="Descreva melhor os animais observados..."
                questrial={questrial}
              />
              {errors.animaisDesc && <ErrorMsg message={errors.animaisDesc} fontFamily={questrial} />}
            </>
          )}
        </SectionCard>

        {/* ── LIXO ── */}
        <SectionCard title="Presença de lixo *" questrial={questrial}>
          <YesNoToggle
            value={form.lixo}
            onChange={(v) => {
              update('lixo', v);
              if (v === 'nao') update('lixoDesc', '');
            }}
            questrial={questrial}
          />
          {errors.lixo && <ErrorMsg message={errors.lixo} fontFamily={questrial} />}
          {form.lixo === 'sim' && (
            <>
              <View style={styles.subLabelRow}>
                <Ionicons name="trash-outline" size={16} color={TEAL_MID} style={{ marginRight: 6 }} />
                <Text style={[styles.subLabel, { fontFamily: questrial }]}>O que você observou?</Text>
              </View>
              <DescriptionInput
                value={form.lixoDesc}
                onChange={(v) => update('lixoDesc', v)}
                placeholder="Descreva melhor a presença de lixo observada..."
                questrial={questrial}
              />
            </>
          )}
        </SectionCard>

        <Text style={[styles.requiredNote, { fontFamily: questrial }]}>* Campos obrigatórios</Text>

        <TouchableOpacity style={styles.publishButton} onPress={onPublish} activeOpacity={0.85} disabled={saving}>
          <LinearGradient
            colors={['#004d48', '#0d9080']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.publishGradient}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={[styles.publishButtonText, { fontFamily: questrial }]}>Publicar registro</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ title, questrial, children }: { title: string; questrial?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>{title}</Text>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );
}

function RadioGroup({ options, selected, onSelect, questrial, columns = 2 }: {
  options: string[]; selected: string | null; onSelect: (v: string) => void;
  questrial?: string; columns?: number;
}) {
  const rows: string[][] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
  return (
    <View style={{ marginBottom: 10 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.radioRow}>
          {row.map((opt) => {
            const active = selected === opt;
            return (
              <TouchableOpacity key={opt} style={styles.radioItem} onPress={() => onSelect(opt)} activeOpacity={0.7}>
                <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.radioLabel, { fontFamily: questrial }, active && styles.radioLabelActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function YesNoToggle({ value, onChange, questrial }: {
  value: YesNo; onChange: (v: 'sim' | 'nao') => void; questrial?: string;
}) {
  return (
    <View style={styles.yesNoWrapper}>
      {(['sim', 'nao'] as const).map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.yesNoButton, active && styles.yesNoButtonActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[styles.yesNoText, { fontFamily: questrial }, active && styles.yesNoTextActive]}>
              {opt === 'sim' ? 'Sim' : 'Não'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DescriptionInput({ value, onChange, placeholder, questrial }: {
  value: string; onChange: (v: string) => void; placeholder: string; questrial?: string;
}) {
  return (
    <TextInput
      style={[styles.descInput, { fontFamily: questrial }]}
      placeholder={placeholder}
      placeholderTextColor={TEXT_MUTED}
      value={value}
      onChangeText={onChange}
      multiline
      numberOfLines={2}
      textAlignVertical="top"
    />
  );
}

function ErrorMsg({ message, fontFamily }: { message?: string; fontFamily?: string }) {
  if (!message) return null;
  return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  headerGradient: {},
  headerSafeArea: { paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  headerSpacer: { width: 36 },

  tealBand: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 0, overflow: 'hidden' },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 50, paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 50, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  selectedBadgeText: { flex: 1, fontSize: 15, color: PRIMARY, fontWeight: '600' },
  pendenteBadge: {
    backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffe082',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  pendenteText: { fontSize: 10, color: '#f9a825', fontWeight: '700' },
  pendenteBadgeSm: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff8e1',
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  },
  waveWhite: { height: 28, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  whiteBody: { flex: 1, backgroundColor: '#FFFFFF' },
  whiteBodyContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },

  listCard: {
    backgroundColor: SURFACE, borderRadius: 20, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  listItemSelected: { backgroundColor: 'rgba(63,243,231,0.10)' },
  waterBodyIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(31,200,180,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  waterBodyIconCircleActive: { backgroundColor: TEAL_MID },
  listItemText: { fontSize: 15, color: '#333', fontWeight: '600' },
  listItemSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  listItemTextSelected: { color: PRIMARY },
  listDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginLeft: 62 },

  noResultsCard: {
    backgroundColor: SURFACE, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
  },
  noResultsIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(63,243,231,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  noResultsTitle: { fontSize: 16, color: PRIMARY, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  noResultsDesc: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', marginBottom: 18, lineHeight: 20 },
  noResultsButton: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 50,
    paddingVertical: 10, paddingHorizontal: 18,
  },
  noResultsButtonText: { fontSize: 13, color: PRIMARY, fontWeight: '600' },

  emptyHint: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyHintText: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center' },

  footerContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: BORDER_LIGHT,
  },
  primaryButton: {
    backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 16, alignItems: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  primaryButtonDisabled: { backgroundColor: '#c8d6d5', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.3 },
  primaryButtonTextDisabled: { color: '#8fafad' },

  sectionCard: {
    backgroundColor: SURFACE, borderRadius: 20, padding: 20, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  sectionTitle: { fontSize: 16, color: PRIMARY, fontWeight: '700', marginBottom: 10 },
  sectionDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginBottom: 14 },

  radioRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 8 },
  radioItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 90 },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#b0c4c2',
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleActive: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  radioLabel: { fontSize: 13, color: '#555' },
  radioLabelActive: { color: PRIMARY, fontWeight: '600' },

  yesNoWrapper: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  yesNoButton: { flex: 1, borderRadius: 50, paddingVertical: 10, alignItems: 'center', backgroundColor: '#E8F4F2' },
  yesNoButtonActive: { backgroundColor: PRIMARY },
  yesNoText: { fontSize: 14, color: TEXT_MUTED, fontWeight: '600' },
  yesNoTextActive: { color: '#FFFFFF' },

  subLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  subLabel: { fontSize: 13, color: TEAL_MID, fontWeight: '600' },

  descInput: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#444',
    minHeight: 48, textAlignVertical: 'top',
  },

  errorText: { fontSize: 11, color: '#e57373', marginTop: 4, marginBottom: 4, marginLeft: 2 },
  requiredNote: { fontSize: 11, color: TEXT_MUTED, marginBottom: 12, marginLeft: 4 },

  publishButton: {
    borderRadius: 50, marginTop: 6, overflow: 'hidden',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 6,
  },
  publishGradient: { paddingVertical: 16, alignItems: 'center' },
  publishButtonText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.3 },

  // Sucesso
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  successCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  successIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(63,243,231,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, marginBottom: 14, textAlign: 'center' },
  successDivider: { height: 1, backgroundColor: BORDER_LIGHT, width: '100%', marginBottom: 14 },
  successBody: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successBtn: { width: '100%', backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  successBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
});