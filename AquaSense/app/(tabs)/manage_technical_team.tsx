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
  criarEquipeTecnica,
  listarEquipesTecnicas,
  atualizarEquipeTecnica,
  desativarEquipeTecnica,
  ativarEquipeTecnica,
  buscarTecnicosDaEquipe,
  removerMembroDaEquipe,
  reativarMembroDaEquipe,
} from "@/services/firestore/technical_teams";

const PRIMARY = "#004d48";
const TEAL = "#0a6b5e";
const SURFACE = "#F5F9F8";
const TEXT_MUTED = "#6b7a7a";
const RED = "#e05252";
const ORANGE = "#e6a817";
const BORDER = "#dcefeb";

type Tab = "listar" | "criar";

export default function ManageTechnicalTeamScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

  const [tab, setTab] = useState<Tab>("listar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [equipes, setEquipes] = useState<EquipeTecnica[]>([]);
  const [search, setSearch] = useState("");

  const [nome, setNome] = useState("");
  const [codigoEquipe, setCodigoEquipe] = useState("");
  const [areaAtuacao, setAreaAtuacao] = useState("");
  const [descricao, setDescricao] = useState("");

  const [selectedEquipe, setSelectedEquipe] = useState<EquipeTecnica | null>(null);
  const [membros, setMembros] = useState<MembroTecnico[]>([]);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  useEffect(() => {
    carregarEquipes();
  }, []);

  async function carregarEquipes() {
    setLoading(true);

    try {
      const dados = await listarEquipesTecnicas();
      setEquipes(dados);
    } catch (error) {
      console.error("Erro ao carregar equipes:", error);
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
      setTab("listar");

      await carregarEquipes();

      Alert.alert("Equipe criada", "A equipe técnica foi cadastrada com sucesso.");
    } catch (error: any) {
      Alert.alert("Erro", error?.message ?? "Não foi possível criar a equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function abrirDetalhes(equipe: EquipeTecnica) {
    setSelectedEquipe(equipe);
    setDetailsVisible(true);
    setMembersLoading(true);

    try {
      const lista = await buscarTecnicosDaEquipe(equipe.codigoEquipe);
      setMembros(lista);
    } catch (error) {
      console.error("Erro ao buscar membros:", error);
      setMembros([]);
    } finally {
      setMembersLoading(false);
    }
  }

  function abrirEdicao(equipe: EquipeTecnica) {
    setSelectedEquipe(equipe);
    setEditNome(equipe.nome);
    setEditArea(equipe.areaAtuacao);
    setEditDescricao(equipe.descricao ?? "");
    setEditVisible(true);
  }

  async function handleSalvarEdicao() {
    if (!selectedEquipe) return;

    if (!editNome.trim() || !editArea.trim()) {
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
      await carregarEquipes();

      Alert.alert("Equipe atualizada", "As informações da equipe foram atualizadas.");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível atualizar a equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAlternarStatus(equipe: EquipeTecnica) {
    const vaiDesativar = equipe.status === "ativa";

    Alert.alert(
      vaiDesativar ? "Desativar equipe?" : "Ativar equipe?",
      vaiDesativar
        ? "A equipe ficará inativa, mas poderá ser ativada novamente depois."
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

              await carregarEquipes();
            } catch {
              Alert.alert("Erro", "Não foi possível alterar o status da equipe.");
            }
          },
        },
      ]
    );
  }

  async function handleCopiarCodigo(codigo: string) {
    await Clipboard.setStringAsync(codigo);
    Alert.alert("Código copiado", `O código ${codigo} foi copiado.`);
  }

  async function handleRemoverMembro(membro: MembroTecnico) {
    Alert.alert(
      "Remover membro?",
      "O técnico será marcado como removido desta equipe. Essa ação poderá ser revertida posteriormente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await removerMembroDaEquipe(membro.uid);

              if (selectedEquipe) {
                const lista = await buscarTecnicosDaEquipe(selectedEquipe.codigoEquipe);
                setMembros(lista);
              }
            } catch {
              Alert.alert("Erro", "Não foi possível remover o membro.");
            }
          },
        },
      ]
    );
  }

  async function handleReativarMembro(membro: MembroTecnico) {
    try {
      await reativarMembroDaEquipe(membro.uid);

      if (selectedEquipe) {
        const lista = await buscarTecnicosDaEquipe(selectedEquipe.codigoEquipe);
        setMembros(lista);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível reativar o membro.");
    }
  }

  const equipesFiltradas = useMemo(() => {
    const termo = search.trim().toLowerCase();

    if (!termo) return equipes;

    return equipes.filter((equipe) => {
      return (
        equipe.nome.toLowerCase().includes(termo) ||
        equipe.codigoEquipe.toLowerCase().includes(termo) ||
        equipe.areaAtuacao.toLowerCase().includes(termo)
      );
    });
  }, [equipes, search]);

  const ativas = equipes.filter((e) => e.status === "ativa").length;
  const inativas = equipes.filter((e) => e.status === "inativa").length;

  const membrosAtivos = membros.filter((m) => (m.statusNaEquipe ?? "ativo") === "ativo");
  const membrosRemovidos = membros.filter((m) => m.statusNaEquipe === "removido");

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[PRIMARY, TEAL]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                Gerenciar equipe técnica
              </Text>
              <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                Crie, acompanhe e administre equipes técnicas vinculadas ao AquaSense.
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { fontFamily: questrial }]}>{equipes.length}</Text>
              <Text style={[styles.statLabel, { fontFamily: questrial }]}>Equipes</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { fontFamily: questrial }]}>{ativas}</Text>
              <Text style={[styles.statLabel, { fontFamily: questrial }]}>Ativas</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { fontFamily: questrial }]}>{inativas}</Text>
              <Text style={[styles.statLabel, { fontFamily: questrial }]}>Inativas</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.contentPanel}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === "listar" && styles.tabButtonActive]}
            onPress={() => setTab("listar")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={tab === "listar" ? "#FFFFFF" : PRIMARY}
            />
            <Text
              style={[
                styles.tabText,
                { fontFamily: questrial, color: tab === "listar" ? "#FFFFFF" : PRIMARY },
              ]}
            >
              Equipes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === "criar" && styles.tabButtonActive]}
            onPress={() => setTab("criar")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={tab === "criar" ? "#FFFFFF" : PRIMARY}
            />
            <Text
              style={[
                styles.tabText,
                { fontFamily: questrial, color: tab === "criar" ? "#FFFFFF" : PRIMARY },
              ]}
            >
              Criar equipe
            </Text>
          </TouchableOpacity>
        </View>

        {tab === "listar" ? (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color={PRIMARY} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nome, código ou área..."
                placeholderTextColor="#8a9696"
                style={[styles.searchInput, { fontFamily: questrial }]}
              />
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
                {equipesFiltradas.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="people-outline" size={42} color={PRIMARY} />
                    <Text style={[styles.emptyTitle, { fontFamily: questrial }]}>
                      Nenhuma equipe encontrada
                    </Text>
                    <Text style={[styles.emptyText, { fontFamily: questrial }]}>
                      Crie uma equipe técnica para gerar um código de acesso aos técnicos.
                    </Text>
                  </View>
                ) : (
                  equipesFiltradas.map((equipe) => (
                    <TeamCard
                      key={equipe.id}
                      equipe={equipe}
                      fontFamily={questrial}
                      onDetails={() => abrirDetalhes(equipe)}
                      onEdit={() => abrirEdicao(equipe)}
                      onToggleStatus={() => handleAlternarStatus(equipe)}
                    />
                  ))
                )}
              </ScrollView>
            )}
          </>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContent}
          >
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <View style={styles.formIcon}>
                  <Ionicons name="people-circle-outline" size={34} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formTitle, { fontFamily: questrial }]}>
                    Nova equipe técnica
                  </Text>
                  <Text style={[styles.formSubtitle, { fontFamily: questrial }]}>
                    O código será usado pelos técnicos no momento do cadastro.
                  </Text>
                </View>
              </View>

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
                onChangeText={(text) => setCodigoEquipe(text.toUpperCase())}
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
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={[styles.primaryButtonText, { fontFamily: questrial }]}>
                      Criar equipe
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

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
                    onPress={() => handleCopiarCodigo(selectedEquipe.codigoEquipe)}
                  >
                    <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                    <Text style={[styles.copyBtnText, { fontFamily: questrial }]}>
                      Copiar
                    </Text>
                  </TouchableOpacity>
                </View>

                <InfoLine label="Área de atuação" value={selectedEquipe.areaAtuacao} fontFamily={questrial} />
                <InfoLine label="Status" value={selectedEquipe.status === "ativa" ? "Ativa" : "Inativa"} fontFamily={questrial} />
                <InfoLine label="Descrição" value={selectedEquipe.descricao || "Sem descrição"} fontFamily={questrial} />

                <View style={styles.membersHeader}>
                  <Text style={[styles.membersTitle, { fontFamily: questrial }]}>
                    Membros ativos
                  </Text>
                  <Text style={[styles.membersCount, { fontFamily: questrial }]}>
                    {membrosAtivos.length}
                  </Text>
                </View>

                {membersLoading ? (
                  <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }} />
                ) : membrosAtivos.length === 0 ? (
                  <Text style={[styles.noMembersText, { fontFamily: questrial }]}>
                    Nenhum técnico ativo vinculado a esta equipe.
                  </Text>
                ) : (
                  membrosAtivos.map((membro) => (
                    <MemberCard
                      key={membro.uid}
                      membro={membro}
                      type="ativo"
                      fontFamily={questrial}
                      onPress={() => handleRemoverMembro(membro)}
                    />
                  ))
                )}

                <View style={styles.membersHeader}>
                  <Text style={[styles.membersTitle, { fontFamily: questrial }]}>
                    Membros removidos
                  </Text>
                  <Text style={[styles.membersCountMuted, { fontFamily: questrial }]}>
                    {membrosRemovidos.length}
                  </Text>
                </View>

                {membrosRemovidos.length === 0 ? (
                  <Text style={[styles.noMembersText, { fontFamily: questrial }]}>
                    Nenhum membro removido.
                  </Text>
                ) : (
                  membrosRemovidos.map((membro) => (
                    <MemberCard
                      key={membro.uid}
                      membro={membro}
                      type="removido"
                      fontFamily={questrial}
                      onPress={() => handleReativarMembro(membro)}
                    />
                  ))
                )}
              </ScrollView>
            )}
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
              <>
                <View style={styles.lockedCode}>
                  <Ionicons name="lock-closed-outline" size={18} color={TEXT_MUTED} />
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
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={[styles.primaryButtonText, { fontFamily: questrial }]}>
                        Salvar alterações
                      </Text>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TeamCard({
  equipe,
  fontFamily,
  onDetails,
  onEdit,
  onToggleStatus,
}: {
  equipe: EquipeTecnica;
  fontFamily?: string;
  onDetails: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const ativa = equipe.status === "ativa";

  return (
    <View style={styles.teamCard}>
      <View style={styles.teamHeader}>
        <View style={styles.teamIcon}>
          <Ionicons name="people-outline" size={25} color={PRIMARY} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.teamName, { fontFamily }]}>{equipe.nome}</Text>
          <Text style={[styles.teamArea, { fontFamily }]}>{equipe.areaAtuacao}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: ativa ? "#e6f4f1" : "#fdecea" }]}>
          <Text style={[styles.statusText, { color: ativa ? "#1a8c80" : RED, fontFamily }]}>
            {ativa ? "Ativa" : "Inativa"}
          </Text>
        </View>
      </View>

      <View style={styles.teamCodeRow}>
        <Ionicons name="key-outline" size={16} color={TEXT_MUTED} />
        <Text style={[styles.teamCode, { fontFamily }]}>Código: {equipe.codigoEquipe}</Text>
      </View>

      <Text style={[styles.teamDescription, { fontFamily }]} numberOfLines={2}>
        {equipe.descricao || "Sem descrição cadastrada."}
      </Text>

      <View style={styles.teamActions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onDetails}>
          <Text style={[styles.secondaryBtnText, { fontFamily }]}>Detalhes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onEdit}>
          <Text style={[styles.secondaryBtnText, { fontFamily }]}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dangerBtn, !ativa && styles.activateBtn]}
          onPress={onToggleStatus}
        >
          <Text style={[styles.dangerBtnText, { fontFamily }]}>
            {ativa ? "Desativar" : "Ativar"}
          </Text>
        </TouchableOpacity>
      </View>
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
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  fontFamily?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { fontFamily }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa7a7"
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          multiline && styles.textArea,
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
    <View style={styles.infoLine}>
      <Text style={[styles.infoLabel, { fontFamily }]}>{label}</Text>
      <Text style={[styles.infoValue, { fontFamily }]}>{value}</Text>
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
  const ativo = type === "ativo";

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Ionicons name="person-outline" size={20} color={PRIMARY} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.memberName, { fontFamily }]}>{membro.nome}</Text>
        <Text style={[styles.memberEmail, { fontFamily }]}>{membro.email}</Text>
      </View>

      <TouchableOpacity
        style={[styles.memberActionBtn, ativo ? styles.removeMemberBtn : styles.reactivateMemberBtn]}
        onPress={onPress}
      >
        <Text style={[styles.memberActionText, { fontFamily }]}>
          {ativo ? "Remover" : "Reativar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  header: { paddingBottom: 34 },

  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  headerTitle: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "700",
    lineHeight: 29,
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 22,
  },

  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },

  statNumber: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },

  statLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    marginTop: 2,
  },

  contentPanel: {
    flex: 1,
    backgroundColor: SURFACE,
    marginTop: -18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
  },

  tabsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },

  tabButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  tabButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tabText: {
    fontSize: 14,
    fontWeight: "700",
  },

  searchBox: {
    height: 52,
    marginHorizontal: 20,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 14,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: "#334",
    fontSize: 14,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 28,
    marginTop: 22,
    elevation: 3,
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

  teamCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    elevation: 3,
  },

  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  teamIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#e6f4f1",
    alignItems: "center",
    justifyContent: "center",
  },

  teamName: {
    fontSize: 16,
    color: "#1a2e26",
    fontWeight: "700",
  },

  teamArea: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  statusBadge: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  teamCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  teamCode: {
    color: "#405060",
    fontSize: 13,
    fontWeight: "700",
  },

  teamDescription: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },

  teamActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    alignItems: "center",
  },

  secondaryBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },

  dangerBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: RED,
    paddingVertical: 10,
    alignItems: "center",
  },

  activateBtn: {
    backgroundColor: PRIMARY,
  },

  dangerBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    elevation: 3,
  },

  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  formIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#e6f4f1",
    alignItems: "center",
    justifyContent: "center",
  },

  formTitle: {
    fontSize: 18,
    color: PRIMARY,
    fontWeight: "700",
  },

  formSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
    marginTop: 3,
  },

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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#334",
  },

  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "88%",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 30 : 22,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "700",
  },

  detailTeamName: {
    color: "#1a2e26",
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 14,
  },

  codeBox: {
    backgroundColor: "#e6f4f1",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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

  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },

  membersTitle: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },

  membersCount: {
    color: "#FFFFFF",
    backgroundColor: PRIMARY,
    borderRadius: 12,
    minWidth: 25,
    textAlign: "center",
    paddingVertical: 3,
    overflow: "hidden",
  },

  membersCountMuted: {
    color: TEXT_MUTED,
    backgroundColor: "#edf0f0",
    borderRadius: 12,
    minWidth: 25,
    textAlign: "center",
    paddingVertical: 3,
    overflow: "hidden",
  },

  noMembersText: {
    color: TEXT_MUTED,
    fontSize: 13,
    backgroundColor: SURFACE,
    padding: 12,
    borderRadius: 12,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
    marginTop: 2,
  },

  memberActionBtn: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  removeMemberBtn: {
    backgroundColor: "#fdecea",
  },

  reactivateMemberBtn: {
    backgroundColor: "#e6f4f1",
  },

  memberActionText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },

  lockedCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },

  lockedCodeText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
});