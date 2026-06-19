import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { useAuth } from '@/contexts/auth-context';
import {
  getTechnicianHistory,
  TechnicalAnalysisItem,
} from '@/services/firestore/technicalAnalyses';
import TechnicalBottomNav from '@/components/technicalbottomnavbar';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const PRIMARY      = '#004d48';
const PRIMARY_MID  = '#2D6A5A';
const ORANGE       = '#E87D3E';
const AMBER        = '#C49A00';
const RED          = '#E53935';
const GREY         = '#9E9E9E';
const BG           = '#F4F7F5';
const CARD         = '#FFFFFF';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';

// ─── Constantes ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const DONE_STATUSES    = new Set(['concluido', 'aprovado', 'analisado', 'validado', 'revisado']);
const PENDING_STATUSES = new Set(['pendente', 'pendente_validacao', 'aguardando_analise', 'em_analise']);

// ─── Tipos ───────────────────────────────────────────────────────────────────
type HistoryTab = 'todas' | 'realizadas' | 'encaminhadas' | 'pendentes' | 'arquivadas';
type RiskLevel  = 'CRÍTICO' | 'ATENÇÃO' | 'NORMAL' | 'SEM DADOS';

const TABS: { key: HistoryTab; label: string }[] = [
  { key: 'todas',        label: 'Todas'              },
  { key: 'realizadas',   label: 'Análises realizadas' },
  { key: 'encaminhadas', label: 'Encaminhadas'        },
  { key: 'pendentes',    label: 'Pendentes'           },
  { key: 'arquivadas',   label: 'Arquivadas'          },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHistoryTab(val: unknown): HistoryTab {
  const valid: HistoryTab[] = ['todas', 'realizadas', 'encaminhadas', 'pendentes', 'arquivadas'];
  return valid.includes(val as HistoryTab) ? (val as HistoryTab) : 'todas';
}

function resolveRisk(item: TechnicalAnalysisItem): RiskLevel {
  const c = item.classificacao ?? '';
  const n = item.nivelRisco    ?? '';
  if (c === 'critica'  || n === 'critico') return 'CRÍTICO';
  if (c === 'atencao'  || n === 'alto')    return 'ATENÇÃO';
  if (c === 'normal'   || n === 'baixo' || n === 'medio') return 'NORMAL';
  return 'SEM DADOS';
}

function resolveAction(risk: RiskLevel): string {
  if (risk === 'CRÍTICO') return 'Encaminhado ao gestor';
  if (risk === 'ATENÇÃO') return 'Monitoramento contínuo';
  if (risk === 'NORMAL')  return 'Sem encaminhamento';
  return 'Aguardando dados';
}

function resolveType(item: TechnicalAnalysisItem): string {
  const tipo = (item._raw as any)?.tipo ?? (item._raw as any)?.tipoRegistro ?? '';
  if (tipo === 'reclassificacao') return 'Reclassificação';
  if (item.origem === 'medicao')    return 'Medição simples';
  if (item.origem === 'observacao') return 'Observação';
  if (item.origem === 'denuncia')   return 'Denúncia';
  return 'Análise técnica';
}

function resolveLocation(item: TechnicalAnalysisItem): string {
  const city  = item.municipio ?? item.cidade ?? '';
  const state = item.estado ?? 'PE';
  return city ? `${city} - ${state}` : state;
}

function riskColor(risk: RiskLevel): string {
  if (risk === 'CRÍTICO') return RED;
  if (risk === 'ATENÇÃO') return ORANGE;
  if (risk === 'NORMAL')  return PRIMARY_MID;
  return GREY;
}

function riskBadge(risk: RiskLevel): { bg: string; text: string; border: string } {
  if (risk === 'CRÍTICO') return { bg: '#FFF0E6', text: ORANGE,     border: '#F9C89E' };
  if (risk === 'ATENÇÃO') return { bg: '#FFFCE6', text: AMBER,      border: '#F0E080' };
  if (risk === 'NORMAL')  return { bg: '#E8F5E9', text: '#2E7D32',  border: '#A5D6A7' };
  return                           { bg: '#F5F5F5', text: '#616161',  border: '#BDBDBD' };
}

function filterByTab(
  items: TechnicalAnalysisItem[],
  tab: HistoryTab,
): TechnicalAnalysisItem[] {
  if (tab === 'todas') return items;
  if (tab === 'pendentes')
    return items.filter(i => PENDING_STATUSES.has(i.status));
  if (tab === 'arquivadas')
    return items.filter(i => i.status === 'rejeitado' || (i.status as string) === 'arquivado');
  if (tab === 'encaminhadas')
    return items.filter(i => resolveRisk(i) === 'CRÍTICO');
  if (tab === 'realizadas')
    return items.filter(i => DONE_STATUSES.has(i.status));
  return items;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps { tab: HistoryTab; hasSearch: boolean; fontFamily?: string }

const EmptyState: React.FC<EmptyStateProps> = ({ tab, hasSearch, fontFamily }) => {
  const labels: Record<HistoryTab, string> = {
    todas:        'análises',
    realizadas:   'análises realizadas',
    encaminhadas: 'análises encaminhadas',
    pendentes:    'análises pendentes',
    arquivadas:   'análises arquivadas',
  };

  const title = hasSearch ? 'Nenhum resultado' : 'Sem registros';
  const desc  = hasSearch
    ? 'Nenhum item corresponde à busca. Tente outros termos.'
    : tab === 'todas'
      ? 'Você ainda não possui análises no histórico.\nComece registrando sua primeira análise.'
      : `Não há ${labels[tab]} registradas no momento.`;

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="document-text-outline" size={40} color={PRIMARY_MID} />
      </View>
      <Text style={[styles.emptyTitle, fontFamily ? { fontFamily } : undefined]}>{title}</Text>
      <Text style={[styles.emptyDesc,  fontFamily ? { fontFamily } : undefined]}>{desc}</Text>
    </View>
  );
};

// ─── Item de histórico ────────────────────────────────────────────────────────

interface HistoryItemProps {
  item:      TechnicalAnalysisItem;
  onPress:   (id: string) => void;
  fontFamily?: string;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ item, onPress, fontFamily }) => {
  const risk     = resolveRisk(item);
  const action   = resolveAction(risk);
  const type     = resolveType(item);
  const location = resolveLocation(item);
  const badge    = riskBadge(risk);
  const iconColor = riskColor(risk);
  const date     = formatDate(item.dataCriacao);
  const time     = formatTime(item.dataCriacao);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.id)}
      activeOpacity={0.75}
    >
      {/* ícone droplet */}
      <View style={[styles.itemIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name="water" size={20} color={iconColor} />
      </View>

      {/* corpo */}
      <View style={styles.itemBody}>
        <Text style={[styles.itemName, fontFamily ? { fontFamily } : undefined]} numberOfLines={1}>
          {item.corpoHidricoNome}
        </Text>
        <Text style={[styles.itemLocation, fontFamily ? { fontFamily } : undefined]}>
          {location}
        </Text>
        <View style={styles.itemMetaRow}>
          <Text style={[styles.itemType, fontFamily ? { fontFamily } : undefined]}>{type}</Text>
          <View style={styles.metaDot} />
          <Ionicons name="calendar-outline" size={11} color={TEXT_MUTED} />
          <Text style={[styles.itemDate, fontFamily ? { fontFamily } : undefined]}>
            {' '}{date} · {time}
          </Text>
        </View>
      </View>

      {/* direita */}
      <View style={styles.itemRight}>
        <View style={[styles.riskBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.riskBadgeText, { color: badge.text }, fontFamily ? { fontFamily } : undefined]}>
            {risk}
          </Text>
        </View>
        <Text style={[styles.itemAction, fontFamily ? { fontFamily } : undefined]} numberOfLines={2}>
          {action}
        </Text>
        <Text style={[styles.itemAuthor, fontFamily ? { fontFamily } : undefined]} numberOfLines={1}>
          Por: {item.colaboradorNome}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );
};

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function HistoryTechnicianScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const params  = useLocalSearchParams<{ tab?: string }>();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;

  const [activeTab,    setActiveTab]    = useState<HistoryTab>(toHistoryTab(params.tab));
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [allItems,     setAllItems]     = useState<TechnicalAnalysisItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sincroniza aba ativa com params de navegação
  useEffect(() => {
    if (params.tab) setActiveTab(toHistoryTab(params.tab));
  }, [params.tab]);

  // Recarrega ao ganhar foco (garante dados frescos ao voltar)
  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) return;
      loadHistory(user.uid);
    }, [user?.uid]),
  );

  function loadHistory(uid: string) {
    setLoading(true);
    setError(null);
    getTechnicianHistory(uid)
      .then(items => { setAllItems(items); setVisibleCount(PAGE_SIZE); })
      .catch(err => {
        console.error('[AquaSense] getTechnicianHistory:', err);
        setError('Não foi possível carregar o histórico. Verifique sua conexão.');
      })
      .finally(() => setLoading(false));
  }

  // Filtra por aba + busca
  const filtered = useMemo(() => {
    const byTab = filterByTab(allItems, activeTab);
    if (!search.trim()) return byTab;
    const q = search.toLowerCase();
    return byTab.filter(i =>
      i.corpoHidricoNome.toLowerCase().includes(q) ||
      resolveLocation(i).toLowerCase().includes(q) ||
      resolveRisk(i).toLowerCase().includes(q)     ||
      i.colaboradorNome.toLowerCase().includes(q),
    );
  }, [allItems, activeTab, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleTabChange = useCallback((tab: HistoryTab) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleItemPress = useCallback((id: string) => {
    const item = allItems.find(i => i.id === id);
    if (item?.corpoHidricoId) {
      router.push({
        pathname: '/(tabs)/last_analysis',
        params: { corpoHidricoId: item.corpoHidricoId },
      } as any);
    } else {
      router.push('/(tabs)/last_analysis' as any);
    }
  }, [allItems, router]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#004d48', '#0a7060']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.headerTitle, questrial ? { fontFamily: questrial } : undefined]}>
            Histórico técnico
          </Text>
          <Text style={[styles.headerSubtitle, questrial ? { fontFamily: questrial } : undefined]}>
            Suas análises e atividades realizadas
          </Text>
        </View>

        <TouchableOpacity style={styles.headerFilterBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={14} color="#fff" />
          <Text style={[styles.headerFilterText, questrial ? { fontFamily: questrial } : undefined]}>
            Filtros
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Abas (scroll horizontal) ── */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => handleTabChange(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                  questrial ? { fontFamily: questrial } : undefined,
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Busca ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={TEXT_MUTED} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, questrial ? { fontFamily: questrial } : undefined]}
          placeholder="Buscar corpo hídrico, região, status..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Conteúdo ── */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={48} color="#ccc" />
          <Text style={[styles.errorTitle, questrial ? { fontFamily: questrial } : undefined]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => user?.uid && loadHistory(user.uid)}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryBtnText, questrial ? { fontFamily: questrial } : undefined]}>
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <HistoryItem item={item} onPress={handleItemPress} fontFamily={questrial} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState tab={activeTab} hasSearch={search.length > 0} fontFamily={questrial} />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} activeOpacity={0.7}>
                <Text style={[styles.loadMoreText, questrial ? { fontFamily: questrial } : undefined]}>
                  Carregar mais
                </Text>
                <Ionicons name="arrow-down" size={15} color={PRIMARY_MID} />
              </TouchableOpacity>
            ) : (
              visible.length > 0
                ? <View style={styles.listEnd}><Text style={styles.listEndText}>Fim do histórico</Text></View>
                : null
            )
          }
        />
      )}

      <TechnicalBottomNav active="analises" fontFamily={questrial} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:    { fontSize: 18, color: '#fff', fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 6,
  },
  headerFilterText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Abas
  tabsWrapper: {
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  tabsContent: { paddingHorizontal: 14, gap: 4 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: PRIMARY },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#aaa' },
  tabTextActive: { color: PRIMARY },

  // Busca
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a1a' },

  // Estado centralizado (loading / error)
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorTitle:  { fontSize: 14, color: TEXT_MUTED, textAlign: 'center' },
  retryBtn:    {
    backgroundColor: PRIMARY, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  retryBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  // Lista
  listContent: { paddingBottom: 24 },
  separator:   { height: 1, backgroundColor: BORDER_LIGHT, marginLeft: 68 },

  // Item
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, paddingHorizontal: 14, paddingVertical: 14,
    gap: 10,
  },
  itemIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemBody:     { flex: 1, minWidth: 0 },
  itemName:     { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  itemLocation: { fontSize: 12, color: TEXT_MUTED, marginBottom: 4 },
  itemMetaRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  itemType:     { fontSize: 11, color: PRIMARY_MID, fontWeight: '600' },
  metaDot:      { width: 3, height: 3, borderRadius: 2, backgroundColor: '#ccc', marginHorizontal: 5 },
  itemDate:     { fontSize: 11, color: TEXT_MUTED },

  itemRight:   { alignItems: 'flex-end', minWidth: 110, maxWidth: 130, gap: 4 },
  riskBadge:   {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-end',
  },
  riskBadgeText: { fontSize: 10, fontWeight: '700' },
  itemAction:    { fontSize: 11, color: '#444', textAlign: 'right', lineHeight: 15 },
  itemAuthor:    { fontSize: 11, color: TEXT_MUTED, textAlign: 'right' },

  // Empty state
  emptyContainer: {
    alignItems: 'center', paddingTop: 64, paddingHorizontal: 32, gap: 12,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  emptyDesc:  { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', lineHeight: 19 },

  // Carregar mais / fim
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16, marginTop: 4,
  },
  loadMoreText: { fontSize: 14, color: PRIMARY_MID, fontWeight: '600' },
  listEnd:      { alignItems: 'center', paddingVertical: 20 },
  listEndText:  { fontSize: 12, color: '#bbb' },
});
