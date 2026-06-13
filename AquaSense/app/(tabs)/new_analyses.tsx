import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#1B4A42',
  bgLight: '#F5F7F6',
  card: '#FFFFFF',
  primaryBtn: '#1B4A42',
  border: '#E2E8E6',
  placeholder: '#9DB5B0',
  label: '#6B8C87',
  value: '#1A2E2B',
  unit: '#9DB5B0',
  iconTeal: '#2A7A6A',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisParams {
  ph: string;
  od: string;
  dbo: string;
  nitrato: string;
  amonia: string;
  nitrogenio: string;
  tipoCorpo: string;
  ortofosfato: string;
  temperatura: string;
}

const EMPTY_PARAMS: AnalysisParams = {
  ph: '', od: '', dbo: '', nitrato: '', amonia: '',
  nitrogenio: '', tipoCorpo: '', ortofosfato: '', temperatura: '',
};

// Campos mínimos para enviar (não rascunho)
const REQUIRED: Array<{ key: keyof AnalysisParams; label: string }> = [
  { key: 'ph',        label: 'pH' },
  { key: 'od',        label: 'Oxigênio Dissolvido' },
  { key: 'dbo',       label: 'DBO' },
  { key: 'tipoCorpo', label: 'Tipo de corpo hídrico' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Constrói o array parametros no formato que mapDoc/buildParametros espera */
function buildParametros(p: AnalysisParams) {
  const entries: Array<{ label: string; icon: string; value: string; severity?: string }> = [];

  if (p.ph) {
    const ph = parseNum(p.ph)!;
    entries.push({
      label: 'pH', icon: 'flask-outline',
      value: ph.toFixed(1),
      severity: ph < 6 || ph > 8.5 ? 'critico' : 'normal',
    });
  }
  if (p.od)          entries.push({ label: 'OD',               icon: 'water-outline',       value: `${parseNum(p.od)} mg/L` });
  if (p.dbo)         entries.push({ label: 'DBO',              icon: 'pulse-outline',        value: `${parseNum(p.dbo)} mg/L` });
  if (p.nitrato)     entries.push({ label: 'Nitrato',          icon: 'flask-outline',        value: `${parseNum(p.nitrato)} mg/L` });
  if (p.amonia)      entries.push({ label: 'Amônia',           icon: 'flask-outline',        value: `${parseNum(p.amonia)} mg/L` });
  if (p.nitrogenio)  entries.push({ label: 'Nitrogênio Total', icon: 'flask-outline',        value: `${parseNum(p.nitrogenio)} mg/L` });
  if (p.ortofosfato) entries.push({ label: 'Ortofosfato',      icon: 'flask-outline',        value: `${parseNum(p.ortofosfato)} mg/L` });
  if (p.temperatura) {
    const t = parseNum(p.temperatura)!;
    entries.push({
      label: 'Temperatura', icon: 'thermometer-outline',
      value: `${t.toFixed(1)} °C`,
      severity: t < 15 || t > 35 ? 'atencao' : 'normal',
    });
  }

  return entries;
}

function validate(params: AnalysisParams): string | null {
  for (const { key, label } of REQUIRED) {
    if (!params[key]?.trim()) return `O campo "${label}" é obrigatório.`;
  }
  return null;
}

// ─── Firestore save ───────────────────────────────────────────────────────────
async function saveToFirestore(
  params: AnalysisParams,
  obs: string,
  isDraft: boolean,
) {
  const user = auth.currentUser;

  const payload = {
    // ── Identificação (compatível com mapDoc) ──
    status: isDraft ? 'rascunho' : 'pendente',
    origem: 'completa',

    // ── Colaborador ──
    usuarioId:   user?.uid   ?? null,
    usuarioNome: user?.displayName ?? user?.email ?? 'Não informado',

    // ── Corpo hídrico ──
    // Em produção: receber via props/navigation.params
    corpoHidricoNome: 'Canal do Fragoso - Olinda/PE',
    corpoHidricoId:   null,
    cidade:  'Olinda',
    estado:  'PE',

    // ── Parâmetros individuais (para buildParametros ler campos soltos) ──
    pH:          parseNum(params.ph),
    temperatura: parseNum(params.temperatura),
    turbidez:    null,

    // ── Parâmetros estruturados (lidos diretamente por mapDoc) ──
    parametros: buildParametros(params),

    // ── Campos extras da análise completa ──
    od:          parseNum(params.od),
    dbo:         parseNum(params.dbo),
    nitrato:     parseNum(params.nitrato),
    amonia:      parseNum(params.amonia),
    nitrogenioTotal: parseNum(params.nitrogenio),
    tipoCorpoHidrico: params.tipoCorpo || null,
    ortofosfato: parseNum(params.ortofosfato),

    // ── Tipo de coleta ──
    tipo: 'completa',

    // ── Observações ──
    observacao: obs.trim() || null,

    // ── Timestamps (compatível com detectDate) ──
    dataCriacao:    serverTimestamp(),
    dataAtualizacao: serverTimestamp(),
  };

  await addDoc(collection(db, 'coletaCompleta'), payload);
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function InfoCard({
  icon, label, value, flex, dropdown,
}: {
  icon: string; label: string; value: string; flex?: number; dropdown?: boolean;
}) {
  return (
    <View style={[s.infoCard, flex ? { flex } : {}]}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
      {dropdown && <Text style={s.chevron}>⌄</Text>}
    </View>
  );
}

function ParamRow({
  icon, name, unit, placeholder, value, onChange, isDropdown, disabled,
}: {
  icon: string; name: string; unit: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  isDropdown?: boolean; disabled?: boolean;
}) {
  return (
    <View style={s.paramRow}>
      <Text style={s.paramIcon}>{icon}</Text>
      <View style={s.paramMeta}>
        <Text style={s.paramName}>{name}</Text>
        <Text style={s.paramUnit}>Unidade: {unit}</Text>
      </View>
      {isDropdown ? (
        <TouchableOpacity style={s.paramDropdown} disabled={disabled}>
          <Text style={s.paramDropdownText}>{value || placeholder}</Text>
          <Text style={s.chevron}>⌄</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.paramInputWrap}>
          <TextInput
            style={[s.paramInput, disabled && { opacity: 0.5 }]}
            placeholder={`Ex.: ${placeholder}`}
            placeholderTextColor={C.placeholder}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
          <Text style={s.paramUnitRight}>{unit}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NovaAnaliseHidrica() {
  const [params, setParams] = useState<AnalysisParams>(EMPTY_PARAMS);
  const [obs, setObs]       = useState('');
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);

  const set = (key: keyof AnalysisParams) => (v: string) =>
    setParams(prev => ({ ...prev, [key]: v }));

  const isBusy = saving !== null;

  async function handleDraft() {
    setSaving('draft');
    try {
      await saveToFirestore(params, obs, true);
      Alert.alert('Rascunho salvo', 'Você pode continuar depois.');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar o rascunho.');
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmit() {
    const error = validate(params);
    if (error) { Alert.alert('Campo obrigatório', error); return; }

    setSaving('submit');
    try {
      await saveToFirestore(params, obs, false);
      Alert.alert('Análise enviada', 'A análise foi registrada com status pendente.', [
        { text: 'OK', onPress: () => { setParams(EMPTY_PARAMS); setObs(''); } },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível enviar a análise.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.breadcrumb}>Análises Técnicas</Text>
          <View style={s.logoPlaceholder}>
            <Text style={s.logoText}>⟡</Text>
          </View>
        </View>
        <Text style={s.headerTitle}>Nova Análise Hídrica</Text>
        <Text style={s.headerSubtitle}>Preencha os dados da amostra coletada</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Informações da Coleta */}
        <View style={s.card}>
          <SectionTitle>Informações da coleta</SectionTitle>
          <View style={s.infoRow}>
            <InfoCard icon="📅" label="Data da coleta" value="23/05/2025" flex={1} />
            <View style={{ width: 10 }} />
            <InfoCard icon="🕐" label="Hora da coleta" value="10:30" flex={1} />
          </View>
          <View style={{ marginTop: 10 }}>
            <InfoCard icon="👤" label="Responsável" value="João Pedro" dropdown />
          </View>
          <View style={{ marginTop: 10 }}>
            <InfoCard icon="📍" label="Local da coleta" value="Canal do Fragoso - Olinda/PE" />
          </View>
        </View>

        {/* Parâmetros */}
        <View style={[s.card, { marginTop: 12 }]}>
          <SectionTitle>Parâmetros analisados</SectionTitle>
          <ParamRow icon="💧"   name="pH"                      unit="-"    placeholder="6,5"  value={params.ph}          onChange={set('ph')}          disabled={isBusy} />
          <ParamRow icon="⊙"    name="Oxigênio Dissolvido (OD)" unit="mg/L" placeholder="5,2"  value={params.od}          onChange={set('od')}          disabled={isBusy} />
          <ParamRow icon="〰"   name="DBO"                      unit="mg/L" placeholder="3,0"  value={params.dbo}         onChange={set('dbo')}         disabled={isBusy} />
          <ParamRow icon="NO₃⁻" name="Nitrato"                  unit="mg/L" placeholder="2,1"  value={params.nitrato}     onChange={set('nitrato')}     disabled={isBusy} />
          <ParamRow icon="NH₃"  name="Amônia"                   unit="mg/L" placeholder="0,15" value={params.amonia}      onChange={set('amonia')}      disabled={isBusy} />
          <ParamRow icon="Ⓝ"   name="Nitrogênio Total"          unit="mg/L" placeholder="3,8"  value={params.nitrogenio}  onChange={set('nitrogenio')}  disabled={isBusy} />
          <ParamRow icon="≋"    name="Tipo de corpo hídrico"     unit=""     placeholder="Selecione o tipo" value={params.tipoCorpo} onChange={set('tipoCorpo')} isDropdown disabled={isBusy} />
          <ParamRow icon="PO₄³⁻" name="Ortofosfato"             unit="mg/L" placeholder="0,07" value={params.ortofosfato} onChange={set('ortofosfato')} disabled={isBusy} />
          <ParamRow icon="🌡"   name="Temperatura"               unit="°C"   placeholder="28,4" value={params.temperatura} onChange={set('temperatura')} disabled={isBusy} />
        </View>

        {/* Observações */}
        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={s.obsLabel}>Observações (opcional)</Text>
          <TextInput
            style={s.obsInput}
            multiline
            numberOfLines={4}
            placeholder="Adicione informações adicionais sobre a coleta ou condições da amostra..."
            placeholderTextColor={C.placeholder}
            value={obs}
            onChangeText={setObs}
            maxLength={250}
            textAlignVertical="top"
            editable={!isBusy}
          />
          <Text style={s.obsCount}>{obs.length}/250</Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btnOutline, isBusy && { opacity: 0.6 }]}
          onPress={handleDraft}
          disabled={isBusy}
        >
          {saving === 'draft'
            ? <ActivityIndicator size="small" color={C.primaryBtn} />
            : <Text style={s.btnOutlineText}>📋  Salvar rascunho</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnFilled, isBusy && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isBusy}
        >
          {saving === 'submit'
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.btnFilledText}>✓  Salvar análise</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles (inalterados) ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.bg },
  header:          { backgroundColor: C.bg, paddingHorizontal: 20, paddingBottom: 20, paddingTop: Platform.OS === 'android' ? 16 : 4 },
  headerTop:       { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backBtn:         { marginRight: 8, padding: 4 },
  backArrow:       { color: '#fff', fontSize: 20, fontWeight: '300' },
  breadcrumb:      { color: 'rgba(255,255,255,0.75)', fontSize: 13, flex: 1 },
  logoPlaceholder: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  logoText:        { color: '#fff', fontSize: 18 },
  headerTitle:     { color: '#FFFFFF', fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginBottom: 4 },
  headerSubtitle:  { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  scroll:          { flex: 1, backgroundColor: C.bgLight, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  scrollContent:   { padding: 16 },
  card:            { backgroundColor: C.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: C.value, marginBottom: 14 },
  infoRow:         { flexDirection: 'row' },
  infoCard:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  infoIcon:        { fontSize: 16 },
  infoLabel:       { fontSize: 10, color: C.label, marginBottom: 1 },
  infoValue:       { fontSize: 13, fontWeight: '600', color: C.value },
  chevron:         { color: C.label, fontSize: 18, lineHeight: 20 },
  paramRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  paramIcon:       { width: 32, textAlign: 'center', fontSize: 13, color: C.iconTeal, fontWeight: '600' },
  paramMeta:       { flex: 1 },
  paramName:       { fontSize: 13, fontWeight: '600', color: C.value },
  paramUnit:       { fontSize: 11, color: C.label, marginTop: 1 },
  paramInputWrap:  { flexDirection: 'row', alignItems: 'center', flex: 1.1, justifyContent: 'flex-end', gap: 4 },
  paramInput:      { flex: 1, textAlign: 'right', fontSize: 13, color: C.value, paddingVertical: 0, minWidth: 60 },
  paramUnitRight:  { fontSize: 12, color: C.unit, minWidth: 30 },
  paramDropdown:   { flexDirection: 'row', alignItems: 'center', flex: 1.1, justifyContent: 'flex-end', gap: 4 },
  paramDropdownText: { fontSize: 13, color: C.placeholder },
  obsLabel:        { fontSize: 14, fontWeight: '600', color: C.value, marginBottom: 10 },
  obsInput:        { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 13, color: C.value, minHeight: 90 },
  obsCount:        { textAlign: 'right', fontSize: 11, color: C.label, marginTop: 6 },
  footer:          { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  btnOutline:      { flex: 1, borderWidth: 1.5, borderColor: C.primaryBtn, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText:  { color: C.primaryBtn, fontWeight: '600', fontSize: 14 },
  btnFilled:       { flex: 1, backgroundColor: C.primaryBtn, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnFilledText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});