import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import * as Clipboard from "expo-clipboard";

import { auth } from "@/config/firebase";
import {
  EquipeTecnica,
  MembroTecnico,
  MetricasDiariasEquipe,
  criarEquipeTecnica,
  listarEquipesTecnicas,
  atualizarEquipeTecnica,
  desativarEquipeTecnica,
  ativarEquipeTecnica,
  buscarTecnicosDaEquipe,
  removerMembroDaEquipe,
  reativarMembroDaEquipe,
  buscarMetricasDiariasEquipe,
  buscarMetricasGlobaisHoje,
} from "@/services/firestore/technical_teams";
import { getPendingAnalyses } from "@/services/firestore/technicalAnalyses";

import ManagerBottomNav from "@/components/managerbottomnav";

const PRIMARY = "#004d48";
const TEAL = "#0a6b5e";
const SURFACE = "#F5F9F8";
const TEXT_MUTED = "#6b7a7a";
const RED = "#e05252";
const BORDER = "#dcefeb";

const TEAM_COLORS = ["#22C55E", "#3B82F6", "#F97316", "#8B5CF6", "#EF4444", "#06B6D4"];
const AVATAR_COLORS = ["#22C55E", "#3B82F6", "#F97316", "#8B5CF6", "#EF4444"];

type ViewMode = "lista" | "cards";
type FilterStatus = "todos" | "ativa" | "inativa";

interface TeamWithData {
  equipe: EquipeTecnica;
  membros: MembroTecnico[];
  metricas: MetricasDiariasEquipe | null;
  loadingMembros: boolean;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(" ");
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatUltimaAtividade(date: Date | null): string {
  if (!date) return "Sem atividade";

  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMin < 60) return `Há ${diffMin} min`;

  if (diffMin < 1440) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `Hoje, ${hh}:${mm}`;
  }

  return date.toLocaleDateString("pt-BR");
}

export default function ManageTechnicalTeamScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("todos");

  const [filterVisible, setFilterVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [teamsData, setTeamsData] = useState<TeamWithData[]>([]);

  const [analisesHoje, setAnalisesHoje] = useState(0);
  const [concluidasHoje, setConcluidasHoje] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const [nome, setNome] = useState("");
  const [codigoEquipe, setCodigoEquipe] = useState("");
  const [areaAtuacao, setAreaAtuacao] = useState("");
  const [descricao, setDescricao] = useState("");

  const [selectedEquipe, setSelectedEquipe] = useState<EquipeTecnica | null>(null);
  const [detailMembros, setDetailMembros] = useState<MembroTecnico[]>([]);

  const [editNome, setEditNome] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    setLoading(true);

    try {
      const [equipes, globais, pendentes] = await Promise.all([
        listarEquipesTecnicas(),
        buscarMetricasGlobaisHoje(),
        getPendingAnalyses(50),
      ]);

      setAnalisesHoje(globais.analisesHoje);
      setConcluidasHoje(globais.concluidasHoje);
      setPendingCount(pendentes.length);

      setTeamsData(
        equipes.map((equipe) => ({
          equipe,
          membros: [],
          metricas: null,
          loadingMembros: true,
        }))
      );

      const enriched = await Promise.all(
        equipes.map(async (equipe) => {
          const membros = await buscarTecnicosDaEquipe(equipe.codigoEquipe);

          const uidsAtivos = membros
            .filter((m) => (m.statusNaEquipe ?? "ativo") === "ativo")
            .map((m) => m.uid);

          const metricas = await buscarMetricasDiariasEquipe(uidsAtivos);

          return {
            equipe,
            membros,
            metricas,
            loadingMembros: false,
          } as TeamWithData;
        })
      );

      setTeamsData(enriched);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar as equipes técnicas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCriarEquipe() {
    if (!nome.trim() || !codigoEquipe.trim() || !areaAtuacao.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha nome, código e área de atuação.");
      return;
    }

    setSaving(true);

    try {
      await criarEquipeTecnica({
        nome,
        codigoEquipe,
        areaAtuacao,
        descricao,
        gestorId: auth.currentUser?.uid,
      });

      setNome("");
      setCodigoEquipe("");
      setAreaAtuacao("");
      setDescricao("");
      setCreateVisible(false);

      await carregarTudo();

      Alert.alert("Equipe criada", "A equipe técnica foi cadastrada com sucesso.");
    } catch (error: any) {
      Alert.alert("Erro", error?.message ?? "Não foi possível criar a equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSalvarEdicao() {
    if (!selectedEquipe || !editNome.trim() || !editArea.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha o nome e a área de atuação.");
      return;
    }

    setSaving(true);

    try {
      await atualizarEquipeTecnica(selectedEquipe.id, {
        nome: editNome,
        areaAtuacao: editArea,
        descricao: editDescricao,
      });

      setEditVisible(false);
      await carregarTudo();

      Alert.alert("Equipe atualizada", "As informações foram atualizadas com sucesso.");
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar a equipe.");
    } finally {
      setSaving(false);
    }
  }

  function handleAlternarStatus(equipe: EquipeTecnica) {
    const vaiDesativar = equipe.status === "ativa";

    Alert.alert(
      vaiDesativar ? "Desativar equipe?" : "Ativar equipe?",
      vaiDesativar
        ? "A equipe ficará inativa, mas poderá ser reativada depois."
        : "A equipe voltará a ficar ativa para os técnicos vinculados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: vaiDesativar ? "Desativar" : "Ativar",
          style: vaiDesativar ? "destructive" : "default",
          onPress: async () => {
            try {
              if (vaiDesativar) {
                await desativarEquipeTecnica(equipe.id);
              } else {
                await ativarEquipeTecnica(equipe.id);
              }

              await carregarTudo();
            } catch {
              Alert.alert("Erro", "Não foi possível alterar o status.");
            }
          },
        },
      ]
    );
  }

  function abrirDetalhes(teamData: TeamWithData) {
    setSelectedEquipe(teamData.equipe);
    setDetailMembros(teamData.membros);
    setDetailsVisible(true);
  }

  function abrirEdicao(equipe: EquipeTecnica) {
    setSelectedEquipe(equipe);
    setEditNome(equipe.nome);
    setEditArea(equipe.areaAtuacao);
    setEditDescricao(equipe.descricao ?? "");
    setEditVisible(true);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  const filteredTeams = useMemo(() => {
    const termo = search.trim().toLowerCase();

    return teamsData.filter(({ equipe }) => {
      const matchSearch =
        !termo ||
        equipe.nome.toLowerCase().includes(termo) ||
        equipe.codigoEquipe.toLowerCase().includes(termo) ||
        equipe.areaAtuacao.toLowerCase().includes(termo);

      const matchFilter = filterStatus === "todos" || equipe.status === filterStatus;

      return matchSearch && matchFilter;
    });
  }, [teamsData, search, filterStatus]);

  const ativas = teamsData.filter((d) => d.equipe.status === "ativa").length;

  const taxaExecucao =
    analisesHoje > 0 ? Math.round((concluidasHoje / analisesHoje) * 100) : 0;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[PRIMARY, TEAL]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={styles.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.appBar}>
            <View style={styles.appBarLeft}>
              <Text style={[styles.brandName, { fontFamily: questrial }]}>AQUASENSE</Text>
              <View style={styles.brandDivider} />
              <Text style={[styles.brandRole, { fontFamily: questrial }]}>Gestor</Text>
            </View>

            <View style={styles.appBarRight}>
              <View style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />

                {pendingCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push("/(tabs)/profile" as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-circle-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { fontFamily: questrial }]}>
                Equipes técnicas
              </Text>

              <Text style={[styles.pageSubtitle, { fontFamily: questrial }]}>
                Acompanhe o desempenho e as atividades das equipes da sua região.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.filtrosBtn}
              onPress={() => setFilterVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={15} color="#fff" />
              <Text style={[styles.filtrosBtnText, { fontFamily: questrial }]}>
                Filtros
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            <StatCard
              icon="people"
              iconColor="#22C55E"
              value={String(ativas)}
              label="Equipes ativas"
              sub="Em campo"
              fontFamily={questrial}
            />

            <StatCard
              icon="document-text"
              iconColor="#3B82F6"
              value={String(analisesHoje)}
              label="Análises hoje"
              sub="Enviadas pelas equipes"
              fontFamily={questrial}
            />

            <StatCard
              icon="checkmark-circle"
              iconColor="#F97316"
              value={String(concluidasHoje)}
              label="Concluídas hoje"
              sub="Já validadas"
              fontFamily={questrial}
            />

            <StatCard
              icon="trending-up"
              iconColor="#8B5CF6"
              value={`${taxaExecucao}%`}
              label="Taxa de execução"
              sub="Média das equipes"
              fontFamily={questrial}
            />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.contentPanel}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={17} color={TEXT_MUTED} />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por equipe, líder ou participante..."
              placeholderTextColor="#9aa7a7"
              style={[styles.searchInput, { fontFamily: questrial }]}
            />
          </View>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "lista" && styles.toggleBtnActive]}
              onPress={() => setViewMode("lista")}
            >
              <Ionicons
                name="list"
                size={15}
                color={viewMode === "lista" ? "#fff" : PRIMARY}
              />

              <Text
                style={[
                  styles.toggleText,
                  {
                    fontFamily: questrial,
                    color: viewMode === "lista" ? "#fff" : PRIMARY,
                  },
                ]}
              >
                Lista
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "cards" && styles.toggleBtnActive]}
              onPress={() => setViewMode("cards")}
            >
              <Ionicons
                name="grid"
                size={15}
                color={viewMode === "cards" ? "#fff" : PRIMARY}
              />

              <Text
                style={[
                  styles.toggleText,
                  {
                    fontFamily: questrial,
                    color: viewMode === "cards" ? "#fff" : PRIMARY,
                  },
                ]}
              >
                Cards
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color={PRIMARY} size="large" />

            <Text style={[styles.loadingText, { fontFamily: questrial }]}>
              Carregando equipes...
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {filteredTeams.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={42} color={PRIMARY} />

                <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
                  Nenhuma equipe encontrada
                </Text>

                <Text style={[styles.emptyText, { fontFamily: questrial }]}>
                  Crie uma equipe técnica para gerar um código de acesso aos técnicos.
                </Text>
              </View>
            ) : viewMode === "lista" ? (
              filteredTeams.map((teamData, index) => (
                <TeamListCard
                  key={teamData.equipe.id}
                  teamData={teamData}
                  accentColor={TEAM_COLORS[index % TEAM_COLORS.length]}
                  fontFamily={questrial}
                  expanded={expandedIds.has(teamData.equipe.id)}
                  onToggleExpand={() => toggleExpand(teamData.equipe.id)}
                  onDetails={() => abrirDetalhes(teamData)}
                  onEdit={() => abrirEdicao(teamData.equipe)}
                  onToggleStatus={() => handleAlternarStatus(teamData.equipe)}
                />
              ))
            ) : (
              <View style={styles.cardsGrid}>
                {filteredTeams.map((teamData, index) => (
                  <TeamGridCard
                    key={teamData.equipe.id}
                    teamData={teamData}
                    accentColor={TEAM_COLORS[index % TEAM_COLORS.length]}
                    fontFamily={questrial}
                    onPress={() => abrirDetalhes(teamData)}
                  />
                ))}
              </View>
            )}

            <View style={styles.footerBanner}>
              <Ionicons name="information-circle-outline" size={16} color={TEXT_MUTED} />

              <Text style={[styles.footerBannerText, { fontFamily: questrial }]}>
                As métricas são atualizadas em tempo real conforme as atividades das equipes.
              </Text>
            </View>

            <TouchableOpacity style={styles.exportBtn} activeOpacity={0.85}>
              <Text style={[styles.exportBtnText, { fontFamily: questrial }]}>
                Exportar relatório
              </Text>

              <Ionicons name="download-outline" size={18} color={PRIMARY} />
            </TouchableOpacity>

            <View style={{ height: 110 }} />
          </ScrollView>
        )}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={createVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                Nova equipe técnica
              </Text>

              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={24} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSubtitle, { fontFamily: questrial }]}>
                O código será usado pelos técnicos no momento do cadastro.
              </Text>

              <Field
                label="Nome da equipe"
                value={nome}
                onChangeText={setNome}
                placeholder="Ex: Equipe Técnica Norte"
                fontFamily={questrial}
              />

              <Field
                label="Código da equipe"
                value={codigoEquipe}
                onChangeText={(t) => setCodigoEquipe(t.toUpperCase())}
                placeholder="Ex: EQ-NORTE-01"
                autoCapitalize="characters"
                fontFamily={questrial}
              />

              <Field
                label="Área de atuação"
                value={areaAtuacao}
                onChangeText={setAreaAtuacao}
                placeholder="Ex: Bacia do Capibaribe"
                fontFamily={questrial}
              />

              <Field
                label="Descrição"
                value={descricao}
                onChangeText={setDescricao}
                placeholder="Descreva a responsabilidade da equipe..."
                multiline
                fontFamily={questrial}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCriarEquipe}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={[styles.primaryButtonText, { fontFamily: questrial }]}>
                      Criar equipe
                    </Text>

                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                Editar equipe
              </Text>

              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Ionicons name="close" size={24} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            {selectedEquipe && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.lockedCode}>
                  <Ionicons name="lock-closed-outline" size={16} color={TEXT_MUTED} />

                  <Text style={[styles.lockedCodeText, { fontFamily: questrial }]}>
                    Código bloqueado: {selectedEquipe.codigoEquipe}
                  </Text>
                </View>

                <Field
                  label="Nome da equipe"
                  value={editNome}
                  onChangeText={setEditNome}
                  placeholder="Nome da equipe"
                  fontFamily={questrial}
                />

                <Field
                  label="Área de atuação"
                  value={editArea}
                  onChangeText={setEditArea}
                  placeholder="Área de atuação"
                  fontFamily={questrial}
                />

                <Field
                  label="Descrição"
                  value={editDescricao}
                  onChangeText={setEditDescricao}
                  placeholder="Descrição"
                  multiline
                  fontFamily={questrial}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSalvarEdicao}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={[styles.primaryButtonText, { fontFamily: questrial }]}>
                        Salvar alterações
                      </Text>

                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: questrial }]}>
                Detalhes da equipe
              </Text>

              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={24} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            {selectedEquipe && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.detailTeamName, { fontFamily: questrial }]}>
                  {selectedEquipe.nome}
                </Text>

                <View style={styles.codeBox}>
                  <View>
                    <Text style={[styles.codeLabel, { fontFamily: questrial }]}>
                      Código da equipe
                    </Text>

                    <Text style={[styles.codeValue, { fontFamily: questrial }]}>
                      {selectedEquipe.codigoEquipe}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={async () => {
                      await Clipboard.setStringAsync(selectedEquipe.codigoEquipe);
                      Alert.alert("Copiado", `Código ${selectedEquipe.codigoEquipe} copiado.`);
                    }}
                  >
                    <Ionicons name="copy-outline" size={16} color="#fff" />

                    <Text style={[styles.copyBtnText, { fontFamily: questrial }]}>
                      Copiar
                    </Text>
                  </TouchableOpacity>
                </View>

                <InfoLine
                  label="Área de atuação"
                  value={selectedEquipe.areaAtuacao}
                  fontFamily={questrial}
                />

                <InfoLine
                  label="Status"
                  value={selectedEquipe.status === "ativa" ? "Ativa" : "Inativa"}
                  fontFamily={questrial}
                />

                <InfoLine
                  label="Descrição"
                  value={selectedEquipe.descricao || "Sem descrição"}
                  fontFamily={questrial}
                />

                <View style={styles.membersHeader}>
                  <Text style={[styles.membersTitle, { fontFamily: questrial }]}>
                    Membros ativos
                  </Text>

                  <Text style={[styles.membersCount, { fontFamily: questrial }]}>
                    {
                      detailMembros.filter(
                        (m) => (m.statusNaEquipe ?? "ativo") === "ativo"
                      ).length
                    }
                  </Text>
                </View>

                {detailMembros
                  .filter((m) => (m.statusNaEquipe ?? "ativo") === "ativo")
                  .map((membro) => (
                    <MemberCard
                      key={membro.uid}
                      membro={membro}
                      type="ativo"
                      fontFamily={questrial}
                      onPress={() =>
                        Alert.alert(
                          "Remover membro?",
                          "O técnico será marcado como removido.",
                          [
                            { text: "Cancelar", style: "cancel" },
                            {
                              text: "Remover",
                              style: "destructive",
                              onPress: async () => {
                                await removerMembroDaEquipe(membro.uid);
                                await carregarTudo();
                                setDetailsVisible(false);
                              },
                            },
                          ]
                        )
                      }
                    />
                  ))}

                <View style={styles.membersHeader}>
                  <Text style={[styles.membersTitle, { fontFamily: questrial }]}>
                    Membros removidos
                  </Text>

                  <Text style={[styles.membersCountMuted, { fontFamily: questrial }]}>
                    {detailMembros.filter((m) => m.statusNaEquipe === "removido").length}
                  </Text>
                </View>

                {detailMembros
                  .filter((m) => m.statusNaEquipe === "removido")
                  .map((membro) => (
                    <MemberCard
                      key={membro.uid}
                      membro={membro}
                      type="removido"
                      fontFamily={questrial}
                      onPress={async () => {
                        await reativarMembroDaEquipe(membro.uid);
                        await carregarTudo();
                        setDetailsVisible(false);
                      }}
                    />
                  ))}

                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={styles.editDetailBtn}
                    onPress={() => {
                      setDetailsVisible(false);
                      abrirEdicao(selectedEquipe);
                    }}
                  >
                    <Ionicons name="create-outline" size={17} color={PRIMARY} />

                    <Text style={[styles.editDetailBtnText, { fontFamily: questrial }]}>
                      Editar equipe
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleDetailBtn,
                      selectedEquipe.status === "ativa"
                        ? styles.dangerDetailBtn
                        : styles.activateDetailBtn,
                    ]}
                    onPress={() => {
                      setDetailsVisible(false);
                      handleAlternarStatus(selectedEquipe);
                    }}
                  >
                    <Text style={[styles.toggleDetailBtnText, { fontFamily: questrial }]}>
                      {selectedEquipe.status === "ativa" ? "Desativar" : "Ativar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <View style={styles.filterSheet}>
            <Text style={[styles.filterTitle, { fontFamily: questrial }]}>
              Filtrar por status
            </Text>

            {(["todos", "ativa", "inativa"] as FilterStatus[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterOption, filterStatus === f && styles.filterOptionActive]}
                onPress={() => {
                  setFilterStatus(f);
                  setFilterVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    {
                      fontFamily: questrial,
                      color: filterStatus === f ? "#fff" : PRIMARY,
                    },
                  ]}
                >
                  {f === "todos" ? "Todos" : f === "ativa" ? "Ativas" : "Inativas"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <ManagerBottomNav fontFamily={questrial} />
    </View>
  );
}

function StatCard({
  icon,
  iconColor,
  value,
  label,
  sub,
  fontFamily,
}: {
  icon: string;
  iconColor: string;
  value: string;
  label: string;
  sub: string;
  fontFamily?: string;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconCircle, { backgroundColor: iconColor + "22" }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>

      <Text style={[statStyles.value, { fontFamily }]}>{value}</Text>
      <Text style={[statStyles.label, { fontFamily }]}>{label}</Text>
      <Text style={[statStyles.sub, { fontFamily }]}>{sub}</Text>
    </View>
  );
}

function AvatarCircle({
  nome,
  index,
  size = 30,
  fontFamily,
}: {
  nome: string;
  index: number;
  size?: number;
  fontFamily?: string;
}) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + "22",
        borderWidth: 1.5,
        borderColor: color + "55",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.35,
          fontWeight: "700",
          color,
          fontFamily,
        }}
      >
        {getInitials(nome)}
      </Text>
    </View>
  );
}

function TeamListCard({
  teamData,
  accentColor,
  fontFamily,
  expanded,
  onToggleExpand,
  onDetails,
  onEdit,
  onToggleStatus,
}: {
  teamData: TeamWithData;
  accentColor: string;
  fontFamily?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onDetails: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const { equipe, membros, metricas, loadingMembros } = teamData;
  const ativa = equipe.status === "ativa";

  const membrosAtivos = membros.filter(
    (m) => (m.statusNaEquipe ?? "ativo") === "ativo"
  );

  const desempenho =
    metricas && metricas.enviadas > 0
      ? Math.round((metricas.concluidas / metricas.enviadas) * 100)
      : 0;

  return (
    <View style={[listCardStyles.card, { borderLeftColor: accentColor }]}>
      <View style={listCardStyles.topRow}>
        <View style={[listCardStyles.iconCircle, { backgroundColor: accentColor + "18" }]}>
          <Ionicons name="people" size={22} color={accentColor} />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={listCardStyles.teamNameRow}>
            <Text style={[listCardStyles.teamName, { fontFamily }]} numberOfLines={1}>
              {equipe.nome}
            </Text>

            <View
              style={[
                listCardStyles.badge,
                { backgroundColor: ativa ? "#dcfce7" : "#fee2e2" },
              ]}
            >
              <Text
                style={[
                  listCardStyles.badgeText,
                  { color: ativa ? "#16a34a" : RED, fontFamily },
                ]}
              >
                {ativa ? "ATIVA" : "INATIVA"}
              </Text>
            </View>
          </View>

          <Text style={[listCardStyles.teamArea, { fontFamily }]}>
            {equipe.areaAtuacao}
          </Text>
        </View>

        <TouchableOpacity onPress={onDetails} style={{ padding: 4 }}>
          <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>

      <View style={listCardStyles.metricsRow}>
        <View style={{ flex: 1 }}>
          <Text style={[listCardStyles.metricsLabel, { fontFamily }]}>
            Atividade hoje
          </Text>

          {loadingMembros ? (
            <ActivityIndicator
              size="small"
              color={PRIMARY}
              style={{ marginTop: 4, alignSelf: "flex-start" }}
            />
          ) : (
            <>
              <MetricLine
                icon="document-text-outline"
                value={`${metricas?.enviadas ?? 0} análises enviadas`}
                fontFamily={fontFamily}
              />

              <MetricLine
                icon="checkmark-circle-outline"
                value={`${metricas?.concluidas ?? 0} concluídas`}
                fontFamily={fontFamily}
              />

              <MetricLine
                icon="warning-outline"
                value={`${metricas?.alertas ?? 0} alertas identificados`}
                fontFamily={fontFamily}
              />
            </>
          )}
        </View>

        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[listCardStyles.metricsLabel, { fontFamily }]}>
            Desempenho
          </Text>

          <View style={listCardStyles.progressRow}>
            <View style={listCardStyles.progressTrack}>
              <View
                style={[
                  listCardStyles.progressFill,
                  {
                    width: `${desempenho}%` as any,
                    backgroundColor: accentColor,
                  },
                ]}
              />
            </View>

            <Text style={[listCardStyles.progressText, { fontFamily }]}>
              {desempenho}%
            </Text>
          </View>

          <Text style={[listCardStyles.ultimaLabel, { fontFamily }]}>
            Última atividade
          </Text>

          <Text style={[listCardStyles.ultimaValue, { fontFamily }]}>
            {formatUltimaAtividade(metricas?.ultimaAtividade ?? null)}
          </Text>
        </View>
      </View>

      <View style={listCardStyles.participantsRow}>
        <Text style={[listCardStyles.participantsLabel, { fontFamily }]}>
          Participantes ({membrosAtivos.length})
        </Text>

        <View style={{ flexDirection: "row" }}>
          {membrosAtivos.slice(0, 4).map((m, i) => (
            <View key={m.uid} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <AvatarCircle nome={m.nome} index={i} size={28} fontFamily={fontFamily} />
            </View>
          ))}

          {membrosAtivos.length > 4 && (
            <View style={listCardStyles.avatarExtra}>
              <Text style={[listCardStyles.avatarExtraText, { fontFamily }]}>
                +{membrosAtivos.length - 4}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={listCardStyles.detailsBtn} onPress={onToggleExpand}>
          <Text style={[listCardStyles.detailsBtnText, { fontFamily }]}>
            Ver detalhes
          </Text>

          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={13}
            color={PRIMARY}
          />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={listCardStyles.expandedSection}>
          {membrosAtivos.length === 0 ? (
            <Text style={[listCardStyles.noMembersText, { fontFamily }]}>
              Nenhum técnico ativo vinculado a esta equipe.
            </Text>
          ) : (
            <View style={listCardStyles.membersGrid}>
              {membrosAtivos.map((m, i) => (
                <View key={m.uid} style={listCardStyles.memberItem}>
                  <AvatarCircle nome={m.nome} index={i} size={38} fontFamily={fontFamily} />

                  <Text
                    style={[listCardStyles.memberItemName, { fontFamily }]}
                    numberOfLines={1}
                  >
                    {m.nome.split(" ")[0]}
                  </Text>

                  <Text style={[listCardStyles.memberItemRole, { fontFamily }]}>
                    Técnico
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={listCardStyles.actionRow}>
            <TouchableOpacity style={listCardStyles.actionBtnOutline} onPress={onEdit}>
              <Ionicons name="create-outline" size={15} color={PRIMARY} />

              <Text style={[listCardStyles.actionBtnOutlineText, { fontFamily }]}>
                Editar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                listCardStyles.actionBtnFilled,
                ativa ? listCardStyles.dangerBtn : listCardStyles.activateBtn,
              ]}
              onPress={onToggleStatus}
            >
              <Text style={[listCardStyles.actionBtnFilledText, { fontFamily }]}>
                {ativa ? "Desativar" : "Ativar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function TeamGridCard({
  teamData,
  accentColor,
  fontFamily,
  onPress,
}: {
  teamData: TeamWithData;
  accentColor: string;
  fontFamily?: string;
  onPress: () => void;
}) {
  const { equipe, membros } = teamData;
  const ativa = equipe.status === "ativa";

  const membrosAtivos = membros.filter(
    (m) => (m.statusNaEquipe ?? "ativo") === "ativo"
  ).length;

  return (
    <TouchableOpacity
      style={[gridCardStyles.card, { borderTopColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[gridCardStyles.iconCircle, { backgroundColor: accentColor + "18" }]}>
        <Ionicons name="people" size={20} color={accentColor} />
      </View>

      <Text style={[gridCardStyles.name, { fontFamily }]} numberOfLines={2}>
        {equipe.nome}
      </Text>

      <View
        style={[
          gridCardStyles.badge,
          { backgroundColor: ativa ? "#dcfce7" : "#fee2e2" },
        ]}
      >
        <Text
          style={[
            gridCardStyles.badgeText,
            { color: ativa ? "#16a34a" : RED, fontFamily },
          ]}
        >
          {ativa ? "ATIVA" : "INATIVA"}
        </Text>
      </View>

      <Text style={[gridCardStyles.area, { fontFamily }]} numberOfLines={1}>
        {equipe.areaAtuacao}
      </Text>

      <Text style={[gridCardStyles.members, { fontFamily }]}>
        {membrosAtivos} membro{membrosAtivos !== 1 ? "s" : ""}
      </Text>
    </TouchableOpacity>
  );
}

function MetricLine({
  icon,
  value,
  fontFamily,
}: {
  icon: string;
  value: string;
  fontFamily?: string;
}) {
  return (
    <View style={metricStyles.row}>
      <Ionicons name={icon as any} size={12} color={TEXT_MUTED} />

      <Text style={[metricStyles.text, { fontFamily }]}>
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize,
  fontFamily,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  fontFamily?: string;
}) {
  return (
    <View style={sharedStyles.fieldGroup}>
      <Text style={[sharedStyles.fieldLabel, { fontFamily }]}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa7a7"
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        style={[
          sharedStyles.input,
          multiline && sharedStyles.textArea,
          { fontFamily },
        ]}
      />
    </View>
  );
}

function InfoLine({
  label,
  value,
  fontFamily,
}: {
  label: string;
  value: string;
  fontFamily?: string;
}) {
  return (
    <View style={sharedStyles.infoLine}>
      <Text style={[sharedStyles.infoLabel, { fontFamily }]}>
        {label}
      </Text>

      <Text style={[sharedStyles.infoValue, { fontFamily }]}>
        {value}
      </Text>
    </View>
  );
}

function MemberCard({
  membro,
  type,
  fontFamily,
  onPress,
}: {
  membro: MembroTecnico;
  type: "ativo" | "removido";
  fontFamily?: string;
  onPress: () => void;
}) {
  return (
    <View style={sharedStyles.memberCard}>
      <View style={sharedStyles.memberAvatar}>
        <Ionicons name="person-outline" size={18} color={PRIMARY} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[sharedStyles.memberName, { fontFamily }]}>
          {membro.nome}
        </Text>

        <Text style={[sharedStyles.memberEmail, { fontFamily }]}>
          {membro.email}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          sharedStyles.memberBtn,
          type === "ativo"
            ? sharedStyles.removeMemberBtn
            : sharedStyles.reactivateMemberBtn,
        ]}
        onPress={onPress}
      >
        <Text style={[sharedStyles.memberBtnText, { fontFamily }]}>
          {type === "ativo" ? "Remover" : "Reativar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  value: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a2e26",
    lineHeight: 30,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a2e26",
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
});

const metricStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  text: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
});

const listCardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  teamNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  teamName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a2e26",
    flexShrink: 1,
  },
  teamArea: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  metricsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1a2e26",
    marginBottom: 2,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a2e26",
  },
  ultimaLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 6,
  },
  ultimaValue: {
    fontSize: 12,
    color: "#1a2e26",
    fontWeight: "600",
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  participantsLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  avatarExtra: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  avatarExtraText: {
    fontSize: 9,
    color: TEXT_MUTED,
    fontWeight: "700",
  },
  detailsBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "700",
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  membersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  memberItem: {
    alignItems: "center",
    width: 56,
  },
  memberItemName: {
    fontSize: 11,
    color: "#1a2e26",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  memberItemRole: {
    fontSize: 10,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  noMembersText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    padding: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtnOutline: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionBtnOutlineText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  actionBtnFilled: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnFilledText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  dangerBtn: {
    backgroundColor: RED,
  },
  activateBtn: {
    backgroundColor: PRIMARY,
  },
});

const gridCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderTopWidth: 4,
    padding: 14,
    minWidth: 140,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a2e26",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  area: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  members: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "600",
    marginTop: 6,
  },
});

const sharedStyles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#334",
  },
  textArea: {
    minHeight: 90,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  infoLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f0",
    paddingVertical: 10,
  },
  infoLabel: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    color: "#1a2e26",
    fontSize: 14,
    fontWeight: "600",
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e6f4f1",
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: {
    color: "#1a2e26",
    fontSize: 14,
    fontWeight: "700",
  },
  memberEmail: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 1,
  },
  memberBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeMemberBtn: {
    backgroundColor: "#fdecea",
  },
  reactivateMemberBtn: {
    backgroundColor: "#e6f4f1",
  },
  memberBtnText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  header: {
    paddingBottom: 20,
  },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  appBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  brandDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  brandRole: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },
  appBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 10,
  },
  pageTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
  },
  pageSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  filtrosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    marginTop: 2,
  },
  filtrosBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  statsRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  contentPanel: {
    flex: 1,
    backgroundColor: SURFACE,
    marginTop: -14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: "#334",
    fontSize: 13,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  toggleBtnActive: {
    backgroundColor: PRIMARY,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingArea: {
    alignItems: "center",
    paddingTop: 80,
    gap: 10,
  },
  loadingText: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 28,
    marginTop: 22,
    elevation: 2,
  },
  emptyTitle: {
    color: PRIMARY,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  footerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  footerBannerText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 17,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    backgroundColor: "#fff",
  },
  exportBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 92,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  lockedCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  lockedCodeText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
  detailTeamName: {
    color: "#1a2e26",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: "#e6f4f1",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  codeLabel: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
  codeValue: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  copyBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  copyBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  membersTitle: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  membersCount: {
    color: "#fff",
    backgroundColor: PRIMARY,
    borderRadius: 10,
    minWidth: 24,
    textAlign: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
    overflow: "hidden",
    fontSize: 12,
  },
  membersCountMuted: {
    color: TEXT_MUTED,
    backgroundColor: "#edf0f0",
    borderRadius: 10,
    minWidth: 24,
    textAlign: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
    overflow: "hidden",
    fontSize: 12,
  },
  detailActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    marginBottom: 8,
  },
  editDetailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
  },
  editDetailBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  toggleDetailBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerDetailBtn: {
    backgroundColor: RED,
  },
  activateDetailBtn: {
    backgroundColor: PRIMARY,
  },
  toggleDetailBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterSheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    width: 260,
  },
  filterTitle: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  filterOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  filterOptionActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});