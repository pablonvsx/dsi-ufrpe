import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, Alert, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter } from 'expo-router';
import { db } from '@/config/firebase';
import {
  doc, getDoc, collection, getDocs, query, where, updateDoc,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { sendPasswordResetEmail } from '@/services/emailService';
import TechnicalBottomNav from '@/components/technicalbottomnavbar';

const PRIMARY      = '#004d48';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png');

// ── Tipos ──────────────────────────────────────────────────────
interface TecnicoData {
  nome: string; email: string; cargo: string;
  equipeNome: string; equipeId: string;
  cidade: string; estado: string;
  membroDesde: string; statusConta: string;
}
interface TecnicoStats {
  analisesRealizadas: number; criticasAnalisadas: number;
  monitoramentosAtivos: number; encaminhamentos: number;
}
interface AreaMonitorada {
  id: string; nome: string; cidade: string; estado: string;
}

// ── StatCard ───────────────────────────────────────────────────
function StatCard({ icon, value, label, sublabel, color, questrial }: {
  icon: keyof typeof Ionicons.glyphMap; value: number;
  label: string; sublabel: string; color: string; questrial?: string;
}) {
  return (
    <View style={statStyles.card}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[statStyles.value, { color, fontFamily: questrial }]}>{value}</Text>
      <Text style={[statStyles.label, { fontFamily: questrial }]}>{label}</Text>
      <Text style={[statStyles.sublabel, { fontFamily: questrial }]}>{sublabel}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card: {
    width: 128, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginRight: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  value:   { fontSize: 24, fontWeight: '700', marginTop: 6 },
  label:   { fontSize: 11, color: '#333', textAlign: 'center', marginTop: 4, fontWeight: '600' },
  sublabel:{ fontSize: 10, color: TEXT_MUTED, textAlign: 'center', marginTop: 2 },
});

// ── SettingRow ─────────────────────────────────────────────────
function SettingRow({ icon, label, description, onPress, questrial }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  description: string; onPress?: () => void; questrial?: string;
}) {
  return (
    <TouchableOpacity style={settingStyles.row} onPress={onPress} disabled={!onPress}>
      <View style={settingStyles.iconCircle}>
        <Ionicons name={icon} size={16} color={PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[settingStyles.label, { fontFamily: questrial }]}>{label}</Text>
        <Text style={[settingStyles.desc, { fontFamily: questrial }]}>{description}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />}
    </TouchableOpacity>
  );
}
const settingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  iconCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(63,243,231,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 14, color: '#111', fontWeight: '600' },
  desc:  { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
});

// ── Tela ───────────────────────────────────────────────────────
export default function PerfilTecnicoScreen() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tecnicoData, setTecnicoData] = useState<TecnicoData>({
    nome: '', email: '', cargo: 'Técnico Ambiental',
    equipeNome: '', equipeId: '',
    cidade: '', estado: 'PE', membroDesde: '', statusConta: 'ativo',
  });
  const [stats, setStats] = useState<TecnicoStats>({
    analisesRealizadas: 0, criticasAnalisadas: 0,
    monitoramentosAtivos: 0, encaminhamentos: 0,
  });
  const [areas, setAreas] = useState<AreaMonitorada[]>([]);
  const [showAllAreas, setShowAllAreas] = useState(false);

  const [modalPasswordSentVisible, setModalPasswordSentVisible] = useState(false);
  const [modalSignOutVisible,      setModalSignOutVisible]      = useState(false);
  const [modalDeactivateVisible,   setModalDeactivateVisible]   = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) fetchTecnicoData(user.uid);
      else setLoading(false);
    });
    return () => unsub();
  }, []);

  const fetchTecnicoData = async (uid: string) => {
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'usuarios', uid));
      let equipeId   = '';
      let equipeNome = '';
      let membroDesde = '';

      if (userSnap.exists()) {
        const d = userSnap.data();
        equipeId = d.equipeId || '';

        if (d.dataCriacao?.toDate) {
          const date = d.dataCriacao.toDate() as Date;
          membroDesde = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        }

        if (equipeId) {
          const equipeSnap = await getDoc(doc(db, 'equipesTecnicas', equipeId));
          if (equipeSnap.exists()) equipeNome = equipeSnap.data().nome || '';
        }

        setTecnicoData({
          nome:        d.nome        || 'Técnico',
          email:       d.email       || '',
          cargo:       d.cargo       || 'Técnico Ambiental',
          equipeNome:  equipeNome    || 'Equipe Técnica AquaSense',
          equipeId,
          cidade:      d.cidade      || '',
          estado:      d.estado      || 'PE',
          membroDesde,
          statusConta: d.statusConta || 'ativo',
        });
      }

      const [analisesSnap, corposSnap, alertasSnap] = await Promise.all([
        getDocs(query(collection(db, 'analisesTecnicas'), where('tecnicoId', '==', uid))),
        getDocs(
          equipeId
            ? query(collection(db, 'corposHidricos'), where('equipeId', '==', equipeId))
            : query(collection(db, 'corposHidricos'), where('tecnicoId', '==', uid))
        ),
        getDocs(query(collection(db, 'alertas'), where('tecnicoId', '==', uid))),
      ]);

      const criticas = analisesSnap.docs.filter(
        d => d.data().tipo === 'critica' || d.data().classificacao === 'critica'
      );

      setStats({
        analisesRealizadas:   analisesSnap.size,
        criticasAnalisadas:   criticas.length,
        monitoramentosAtivos: corposSnap.size,
        encaminhamentos:      alertasSnap.size,
      });

      setAreas(
        corposSnap.docs.slice(0, 10).map(d => ({
          id:     d.id,
          nome:   d.data().nome   || 'Sem nome',
          cidade: d.data().cidade || '',
          estado: d.data().estado || 'PE',
        }))
      );
    } catch (err) {
      console.error('[AquaSense] fetchTecnicoData:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail({ email: user.email });
      setModalPasswordSentVisible(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o e-mail. Tente novamente.');
    }
  };

  const handleSignOut = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      router.replace('/login');
    } catch {
      Alert.alert('Erro', 'Não foi possível sair da conta.');
    }
  };

  const handleRequestDeactivation = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), {
        statusConta:                'pendente_desativacao',
        solicitacaoDesativacaoEm:   new Date().toISOString(),
      });
      setModalDeactivateVisible(false);
      Alert.alert(
        'Solicitação enviada',
        'Sua solicitação foi enviada ao gestor responsável para análise.'
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a solicitação.');
    }
  };

  const initials    = tecnicoData.nome ? tecnicoData.nome.charAt(0).toUpperCase() : 'T';
  const isAtivo     = ['ativo', 'ativa'].includes(tecnicoData.statusConta);
  const visibleAreas = showAllAreas ? areas : areas.slice(0, 4);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.root}>

        {/* ══ HEADER ══ */}
        <LinearGradient colors={['#004d48', '#0a7060']} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerBar}>
              <View style={styles.headerLogoRow}>
                <Image source={logoImg} style={styles.headerLogo} resizeMode="contain" tintColor="#fff" />
                <Text style={[styles.headerRoleLabel, { fontFamily: questrial }]}>Técnico</Text>
              </View>
              <View style={styles.headerIcons}>
                <TouchableOpacity style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                  <Ionicons name="person-circle-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ BODY ══ */}
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={styles.bodyPad}>
            <Text style={[styles.pageTitle, { fontFamily: questrial }]}>Meu perfil</Text>
            <Text style={[styles.pageSubtitle, { fontFamily: questrial }]}>Gerencie suas informações e conta</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Card de perfil */}
              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.profileCardHeader}>
                  {/* Avatar */}
                  <View style={styles.avatarBlock}>
                    <View style={styles.avatarCircle}>
                      <Text style={[styles.avatarText, { fontFamily: questrial }]}>{initials}</Text>
                    </View>
                    <View style={styles.cameraBtn}>
                      <Ionicons name="camera-outline" size={13} color={PRIMARY} />
                    </View>
                  </View>

                  {/* Info */}
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { fontFamily: questrial }]}>{tecnicoData.nome}</Text>
                    <Text style={[styles.profileRole, { fontFamily: questrial }]}>{tecnicoData.cargo}</Text>
                    <Text style={[styles.profileTeam, { fontFamily: questrial }]}>{tecnicoData.equipeNome}</Text>
                    {tecnicoData.cidade ? (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                        <Text style={[styles.locationText, { fontFamily: questrial }]}>
                          {' '}{tecnicoData.cidade} - {tecnicoData.estado}
                        </Text>
                        <View style={styles.dot} />
                        <Ionicons name="shield-outline" size={12} color={TEXT_MUTED} />
                        <Text style={[styles.locationText, { fontFamily: questrial }]}> Técnica Regional</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Status + Membro desde */}
                  <View style={styles.profileCardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: isAtivo ? '#e8f8f4' : '#fdecea' }]}>
                      <View style={[styles.statusDot, { backgroundColor: isAtivo ? '#27ae60' : '#c0392b' }]} />
                      <Text style={[styles.statusText, { color: isAtivo ? '#27ae60' : '#c0392b', fontFamily: questrial }]}>
                        {isAtivo ? 'Ativo' : 'Inativo'}
                      </Text>
                    </View>
                    {tecnicoData.membroDesde ? (
                      <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
                        <Text style={[styles.membroLabel, { fontFamily: questrial }]}>Membro desde</Text>
                        <Text style={[styles.membroDate, { fontFamily: questrial }]}>{tecnicoData.membroDesde}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Resumo operacional */}
              <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Resumo operacional</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
                <StatCard icon="bar-chart-outline"        value={stats.analisesRealizadas}   label="Análises realizadas"         sublabel="Últimos 30 dias" color={PRIMARY}    questrial={questrial} />
                <StatCard icon="water-outline"            value={stats.criticasAnalisadas}   label="Críticas analisadas"         sublabel="Últimos 30 dias" color="#c0392b"    questrial={questrial} />
                <StatCard icon="navigate-circle-outline"  value={stats.monitoramentosAtivos} label="Monitoramentos ativos"       sublabel="Ativos agora"    color="#2980b9"    questrial={questrial} />
                <StatCard icon="send-outline"             value={stats.encaminhamentos}      label="Encaminhamentos ao gestor"   sublabel="Últimos 30 dias" color="#e67e22"    questrial={questrial} />
              </ScrollView>

              {/* Áreas monitoradas */}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { fontFamily: questrial, marginTop: 0 }]}>
                  Áreas que você monitora
                </Text>
                <TouchableOpacity>
                  <Text style={[styles.mapLink, { fontFamily: questrial }]}>Ver no mapa ›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                {areas.length === 0 ? (
                  <Text style={[styles.emptyText, { fontFamily: questrial }]}>Nenhuma área monitorada.</Text>
                ) : (
                  visibleAreas.map((area, idx) => (
                    <View key={area.id}>
                      <TouchableOpacity style={styles.areaRow}>
                        <Ionicons name="location" size={20} color={PRIMARY} style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.areaName, { fontFamily: questrial }]}>{area.nome}</Text>
                          <Text style={[styles.areaCity, { fontFamily: questrial }]}>
                            {area.cidade} - {area.estado}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
                      </TouchableOpacity>
                      {idx < visibleAreas.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
                {areas.length > 4 && (
                  <>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.verTodasBtn} onPress={() => setShowAllAreas(!showAllAreas)}>
                      <Text style={[styles.verTodasText, { fontFamily: questrial }]}>
                        {showAllAreas ? 'Ver menos' : 'Ver todas as áreas'}
                      </Text>
                      <Ionicons name={showAllAreas ? 'chevron-up' : 'chevron-forward'} size={16} color={PRIMARY} />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Conta e segurança */}
              <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Conta e segurança</Text>
              <View style={styles.card}>
                <SettingRow
                  icon="person-outline"
                  label="Alterar senha"
                  description="Mantenha sua conta segura"
                  onPress={handlePasswordReset}
                  questrial={questrial}
                />
                <View style={styles.divider} />
                <SettingRow
                  icon="mail-outline"
                  label="E-mail"
                  description={tecnicoData.email}
                  questrial={questrial}
                />
                <View style={styles.divider} />
                <SettingRow
                  icon="person-remove-outline"
                  label="Solicitar desativação da conta"
                  description="Sua solicitação será analisada pela equipe gestora"
                  onPress={() => setModalDeactivateVisible(true)}
                  questrial={questrial}
                />
              </View>

              {/* Aviso de conta técnica */}
              <View style={styles.noticeCard}>
                <Ionicons name="information-circle-outline" size={16} color="#2980b9" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.noticeText, { fontFamily: questrial }]}>
                  Contas técnicas estão vinculadas à equipe e não podem ser excluídas diretamente.{'\n'}
                  Em caso de necessidade, solicite desativação e aguarde análise do gestor responsável.
                </Text>
              </View>

              {/* Sair da conta */}
              <TouchableOpacity style={styles.signOutBtn} onPress={() => setModalSignOutVisible(true)}>
                <Ionicons name="log-out-outline" size={18} color="#c0392b" />
                <Text style={[styles.signOutText, { fontFamily: questrial }]}>Sair da conta</Text>
                <Ionicons name="chevron-forward" size={16} color="#c0392b" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <TechnicalBottomNav active="profile" fontFamily={questrial} />

        {/* ── Modal: Sair ── */}
        <Modal visible={modalSignOutVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="log-out-outline" size={36} color={PRIMARY} style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: PRIMARY }]}>Sair da conta</Text>
              <Text style={[styles.modalDesc, { fontFamily: questrial }]}>
                Você precisará fazer login novamente para acessar o aplicativo.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => setModalSignOutVisible(false)} style={styles.modalBtnCancel}>
                  <Text style={{ color: TEXT_MUTED, fontFamily: questrial }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnConfirm}
                  onPress={() => { setModalSignOutVisible(false); handleSignOut(); }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Sair</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal: Solicitar desativação ── */}
        <Modal visible={modalDeactivateVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="person-remove-outline" size={36} color="#e67e22" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: '#e67e22' }]}>Solicitar desativação</Text>
              <Text style={[styles.modalDesc, { fontFamily: questrial }]}>
                Uma solicitação será enviada ao gestor responsável pela sua equipe para análise.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => setModalDeactivateVisible(false)} style={styles.modalBtnCancel}>
                  <Text style={{ color: TEXT_MUTED, fontFamily: questrial }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnConfirm, { backgroundColor: '#e67e22' }]}
                  onPress={handleRequestDeactivation}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Solicitar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal: E-mail de senha enviado ── */}
        <Modal visible={modalPasswordSentVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="mail-outline" size={36} color={PRIMARY} style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: PRIMARY }]}>E-mail enviado!</Text>
              <Text style={[styles.modalDesc, { fontFamily: questrial }]}>
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </Text>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, { width: '100%' }]}
                onPress={() => setModalPasswordSentVisible(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE },

  // Header
  header: { paddingBottom: 12 },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  headerLogoRow: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 100, height: 60 },
  headerRoleLabel: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)', marginLeft: 8,
    borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)', paddingLeft: 55,
  },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Body
  body: { flex: 1 },
  bodyPad: { paddingHorizontal: 16, paddingTop: 16, marginBottom: 4 },
  pageTitle:    { fontSize: 22, color: PRIMARY, fontWeight: '700' },
  pageSubtitle: { fontSize: 13, color: TEXT_MUTED, marginTop: 2 },

  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: '#111',
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  mapLink: { fontSize: 13, color: '#1ab89a', fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  // Profile card
  profileCardHeader: { flexDirection: 'row', gap: 10 },
  avatarBlock: { position: 'relative' },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,77,72,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 26, color: PRIMARY, fontWeight: '700' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, color: '#111', fontWeight: '700' },
  profileRole: { fontSize: 13, color: '#1ab89a', fontWeight: '600', marginTop: 2 },
  profileTeam: { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  locationText: { fontSize: 11, color: TEXT_MUTED },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: TEXT_MUTED, marginHorizontal: 6 },

  profileCardRight: { alignItems: 'flex-end' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  membroLabel: { fontSize: 10, color: TEXT_MUTED },
  membroDate:  { fontSize: 12, color: '#111', fontWeight: '600' },

  // Stats
  statsRow: { paddingHorizontal: 16, paddingBottom: 4 },

  // Areas
  areaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  areaName: { fontSize: 14, color: '#111', fontWeight: '600' },
  areaCity: { fontSize: 12, color: TEXT_MUTED },
  verTodasBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10,
  },
  verTodasText: { fontSize: 13, color: PRIMARY, fontWeight: '600', marginRight: 4 },
  emptyText: { fontSize: 13, color: TEXT_MUTED, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  divider: { height: 1, backgroundColor: BORDER_LIGHT, marginVertical: 4 },

  // Notice
  noticeCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#eaf4fd', borderRadius: 12, padding: 12,
    marginHorizontal: 16, marginBottom: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: '#2980b9', lineHeight: 18 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  signOutText: { fontSize: 14, color: '#c0392b', fontWeight: '700' },

  // Modais
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,77,72,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24, elevation: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  modalDesc:  { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalBtns:  { flexDirection: 'row', gap: 10 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderRadius: 12, backgroundColor: '#f0f0f0',
  },
  modalBtnConfirm: {
    flex: 1.5, paddingVertical: 13, alignItems: 'center',
    borderRadius: 12, backgroundColor: PRIMARY,
  },
});