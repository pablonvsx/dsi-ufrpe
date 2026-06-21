import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, Alert, Modal, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter } from 'expo-router';
import {
  reauthenticateWithCredential, EmailAuthProvider,
  deleteUser, signOut, updateEmail, getAuth,
} from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchGestorProfile, updateGestorEmail, deactivateGestorAccount,
  deleteGestorAccount, recordGestorLastAccess,
  GestorProfileData, GestorStats,
} from '@/services/firestore/manager';
import { sendPasswordResetEmail } from '@/services/emailService';
import ManagerBottomNav from '@/components/managerbottomnav';

const PRIMARY      = '#004d48';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png');

const maskEmail = (email: string) => {
  if (!email) return '';
  const [user, domain] = email.split('@');
  return `${user.substring(0, 3)}****@${domain}`;
};

// ── InfoField helper ───────────────────────────────────────────
function InfoField({ label, value, questrial }: { label: string; value: string; questrial?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[infoStyles.label, { fontFamily: questrial }]}>{label}</Text>
      <Text style={[infoStyles.value, { fontFamily: questrial }]}>{value}</Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  label: { fontSize: 11, color: TEXT_MUTED, marginBottom: 1 },
  value: { fontSize: 13, color: '#111', fontWeight: '700' },
});

// ── Helpers ────────────────────────────────────────────────────
const formatLastAccess = (ts?: Timestamp) => {
  if (!ts) return 'Nunca registrado';
  const date = ts.toDate();
  if (date.toDateString() === new Date().toDateString()) return 'Hoje';
  return date.toLocaleDateString('pt-BR');
};

// ── Tela ───────────────────────────────────────────────────────
export default function PerfilGestorScreen() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managerData, setManagerData] = useState<GestorProfileData>({
    nome: '', email: '', cargo: 'Gestor Ambiental',
    orgao: '', unidade: '', matricula: '', regiaoGerenciada: '', uf: 'PE',
  });
  const [stats, setStats] = useState<GestorStats>({
    totalCorposHidricos: 0, totalMunicipios: 0, totalEquipes: 0,
  });

  const [modalEmailVisible,        setModalEmailVisible]        = useState(false);
  const [modalReauthVisible,       setModalReauthVisible]       = useState(false);
  const [modalDeactivateVisible,   setModalDeactivateVisible]   = useState(false);
  const [modalDeleteVisible,       setModalDeleteVisible]       = useState(false);
  const [modalPasswordSentVisible, setModalPasswordSentVisible] = useState(false);
  const [modalSignOutVisible,      setModalSignOutVisible]      = useState(false);

  const [newEmail,         setNewEmail]         = useState('');
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [pendingAction,    setPendingAction]    = useState<'EMAIL' | 'DEACTIVATE' | 'DELETE' | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchProfile(user.uid);
    recordGestorLastAccess(user.uid);
  }, [user?.uid]);

  const fetchProfile = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const { profile, stats: fetchedStats } = await fetchGestorProfile(uid);
      setManagerData(profile);
      setStats(fetchedStats);
    } catch (err) {
      console.error('[AquaSense] fetchProfile:', err);
      setError('Não foi possível carregar o perfil. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleReauthAndSubmit = async () => {
    if (!user || !user.email || !currentPassword) {
      Alert.alert('Erro', 'Insira sua senha atual.');
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      if (pendingAction === 'EMAIL') {
        await updateGestorEmail(user.uid, newEmail);
        await updateEmail(user, newEmail);
        setManagerData(prev => ({ ...prev, email: newEmail }));
        Alert.alert('Sucesso', 'E-mail atualizado!');
      } else if (pendingAction === 'DEACTIVATE') {
        await deactivateGestorAccount(user.uid);
        router.replace('/login');
      } else if (pendingAction === 'DELETE') {
        await deleteGestorAccount(user.uid);
        await deleteUser(user);
        router.replace('/login');
      }

      setModalReauthVisible(false);
      setCurrentPassword('');
      setPendingAction(null);
    } catch (err: any) {
      const msgMap: Record<string, string> = {
        'auth/wrong-password':    'Senha incorreta.',
        'auth/invalid-credential':'Senha incorreta.',
        'auth/email-already-in-use': 'Este e-mail já está em uso.',
        'auth/invalid-email':     'E-mail inválido.',
      };
      Alert.alert('Erro', msgMap[err.code] ?? 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
      router.replace('/login');
    } catch {
      Alert.alert('Erro', 'Não foi possível sair da conta. Tente novamente.');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail({ email: user.email! });
      setModalPasswordSentVisible(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o e-mail. Tente novamente.');
    }
  };

  const initials = managerData.nome ? managerData.nome.charAt(0).toUpperCase() : 'G';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.root}>

        {/* ══ HEADER ══ */}
        <LinearGradient colors={['#004d48', '#0a7060']} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
                <Ionicons name="arrow-back-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTitleBlock}>
                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>Meu perfil</Text>
                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                  Gerencie suas informações e configurações
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerIconBtn}>
                  <Ionicons name="notifications-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerIconBtn}>
                  <Ionicons name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Linha: Avatar + Info + Região */}
            <View style={styles.profileRow}>
              <View style={styles.avatarBlock}>
                <View style={styles.avatarCircle}>
                  <Text style={[styles.avatarText, { fontFamily: questrial }]}>{initials}</Text>
                </View>
                <View style={styles.cameraBtn}>
                  <Ionicons name="camera-outline" size={14} color={PRIMARY} />
                </View>
              </View>

              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { fontFamily: questrial }]}>{managerData.nome}</Text>
                <View style={styles.roleBadge}>
                  <Text style={[styles.roleBadgeText, { fontFamily: questrial }]}>{managerData.cargo}</Text>
                </View>
                <View style={styles.emailRow}>
                  <Ionicons name="mail-outline" size={12} color="rgba(255,255,255,0.8)" />
                  <Text style={[styles.profileEmail, { fontFamily: questrial }]}> {managerData.email}</Text>
                </View>
              </View>

              <View style={styles.regionCard}>
                <View style={styles.regionCardTop}>
                  <Ionicons name="location-outline" size={11} color={TEXT_MUTED} />
                  <Text style={[styles.regionCardLabel, { fontFamily: questrial }]}> Região gerenciada</Text>
                </View>
                <Text style={[styles.regionCardCity, { fontFamily: questrial }]}>
                  {managerData.regiaoGerenciada} • {managerData.uf}
                </Text>
                <Text style={[styles.regionCardUnit, { fontFamily: questrial }]}>{managerData.unidade}</Text>
                <Text style={[styles.regionCardLink, { fontFamily: questrial }]}>Ver detalhes da região ›</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══ BODY ══ */}
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#c0392b" />
              <Text style={[styles.errorText, { fontFamily: questrial }]}>{error}</Text>
              <TouchableOpacity onPress={() => user && fetchProfile(user.uid)}>
                <Text style={[styles.errorRetry, { fontFamily: questrial }]}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}
          {loading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Informações da conta */}
              <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Informações da conta</Text>
              <View style={styles.card}>
                <View style={styles.accountRow}>
                  <View style={styles.accountRowLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="mail-outline" size={16} color={PRIMARY} />
                    </View>
                    <View>
                      <Text style={[styles.accountLabel, { fontFamily: questrial }]}>E-mail</Text>
                      <Text style={[styles.accountValue, { fontFamily: questrial }]}>
                        {maskEmail(managerData.email)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.alterBtn}
                    onPress={() => { setNewEmail(managerData.email); setModalEmailVisible(true); }}
                  >
                    <Ionicons name="pencil-outline" size={12} color={PRIMARY} />
                    <Text style={[styles.alterBtnText, { fontFamily: questrial }]}> Alterar</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.accountRow}>
                  <View style={styles.accountRowLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="lock-closed-outline" size={16} color={PRIMARY} />
                    </View>
                    <View>
                      <Text style={[styles.accountLabel, { fontFamily: questrial }]}>Senha</Text>
                      <Text style={[styles.accountValue, { fontFamily: questrial }]}>••••••••••</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.alterBtn} onPress={handlePasswordReset}>
                    <Ionicons name="pencil-outline" size={12} color={PRIMARY} />
                    <Text style={[styles.alterBtnText, { fontFamily: questrial }]}> Alterar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Organização + Região (2 colunas) */}
              <View style={styles.twoColRow}>
                <View style={[styles.card, styles.halfCard]}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="business-outline" size={16} color={PRIMARY} />
                    <Text style={[styles.cardTitle, { fontFamily: questrial }]}> Organização</Text>
                  </View>
                  <InfoField label="Órgão"     value={managerData.orgao}    questrial={questrial} />
                  <InfoField label="Unidade"   value={managerData.unidade}  questrial={questrial} />
                  <InfoField label="Cargo"     value={managerData.cargo}    questrial={questrial} />
                  <InfoField label="Matrícula" value={managerData.matricula} questrial={questrial} />
                  <TouchableOpacity>
                    <Text style={[styles.cardLinkText, { fontFamily: questrial }]}>
                      Ver mais informações da organização ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, styles.halfCard]}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="map-outline" size={16} color={PRIMARY} />
                    <Text style={[styles.cardTitle, { fontFamily: questrial }]}> Região e atuação</Text>
                  </View>
                  <InfoField
                    label="Região gerenciada"
                    value={`${managerData.regiaoGerenciada} • ${managerData.uf}`}
                    questrial={questrial}
                  />
                  <InfoField
                    label="Área de abrangência"
                    value={`${stats.totalMunicipios} municípios`}
                    questrial={questrial}
                  />
                  <InfoField
                    label="Corpos hídricos monitorados"
                    value={String(stats.totalCorposHidricos)}
                    questrial={questrial}
                  />
                  <InfoField
                    label="Equipes técnicas vinculadas"
                    value={`${stats.totalEquipes} equipes ativas`}
                    questrial={questrial}
                  />
                  <TouchableOpacity>
                    <Text style={[styles.cardLinkText, { fontFamily: questrial }]}>Ver mapa estratégico ↗</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sair da conta */}
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={() => setModalSignOutVisible(true)}
                activeOpacity={0.82}
              >
                <Ionicons name="log-out-outline" size={18} color="#c0392b" />
                <Text style={[styles.signOutText, { fontFamily: questrial }]}>Sair da conta</Text>
                <Ionicons name="chevron-forward" size={16} color="#c0392b" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              {/* Ações da conta */}
              <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Ações da conta</Text>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => setModalDeactivateVisible(true)}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(230,126,34,0.1)' }]}>
                    <Ionicons name="person-remove-outline" size={18} color="#e67e22" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionLabel, { color: '#e67e22', fontFamily: questrial }]}>
                      Desativar conta
                    </Text>
                    <Text style={[styles.actionDesc, { fontFamily: questrial }]}>
                      Sua conta será desativada temporariamente.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#e67e22" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => setModalDeleteVisible(true)}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(192,57,43,0.1)' }]}>
                    <Ionicons name="trash-outline" size={18} color="#c0392b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionLabel, { color: '#c0392b', fontFamily: questrial }]}>
                      Excluir conta
                    </Text>
                    <Text style={[styles.actionDesc, { fontFamily: questrial }]}>
                      Esta ação é permanente e não poderá ser desfeita.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#c0392b" />
                </TouchableOpacity>
              </View>

              {/* Rodapé de segurança */}
              <View style={styles.securityFooter}>
                <View style={styles.securityItem}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={PRIMARY} />
                  <Text style={[styles.securityText, { color: PRIMARY, fontFamily: questrial }]}>
                    {' '}Sua conta está segura
                  </Text>
                </View>
                <View style={styles.securityItem}>
                  <Ionicons name="time-outline" size={13} color={TEXT_MUTED} />
                  <Text style={[styles.securityText, { color: TEXT_MUTED, fontFamily: questrial }]}>
                    {' '}Último acesso: {formatLastAccess(managerData.ultimoAcessoEm)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <ManagerBottomNav activeTab="perfil" fontFamily={questrial} />

        {/* ── Modal: Sair da conta ── */}
        <Modal visible={modalSignOutVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="log-out-outline" size={40} color={PRIMARY} style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: PRIMARY }]}>Sair da conta</Text>
              <Text style={[styles.modalDesc, { fontFamily: questrial }]}>
                Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o aplicativo.
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

        {/* ── Modal: Editar E-mail ── */}
        <Modal visible={modalEmailVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: PRIMARY }]}>Editar E-mail</Text>
              <TextInput
                style={[styles.modalInput, { fontFamily: questrial }]}
                placeholder="Novo e-mail"
                placeholderTextColor={TEXT_MUTED}
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => setModalEmailVisible(false)} style={styles.modalBtnCancel}>
                  <Text style={{ color: TEXT_MUTED, fontFamily: questrial }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnConfirm}
                  onPress={() => {
                    if (!newEmail.includes('@')) return Alert.alert('Erro', 'E-mail inválido.');
                    setPendingAction('EMAIL');
                    setModalEmailVisible(false);
                    setCurrentPassword('');
                    setModalReauthVisible(true);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal: Reautenticação ── */}
        <Modal visible={modalReauthVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: PRIMARY }]}>Confirme sua Senha</Text>
              <TextInput
                style={[styles.modalInput, { fontFamily: questrial }]}
                placeholder="Senha atual"
                placeholderTextColor={TEXT_MUTED}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  onPress={() => { setModalReauthVisible(false); setCurrentPassword(''); setPendingAction(null); }}
                  style={styles.modalBtnCancel}
                >
                  <Text style={{ color: TEXT_MUTED, fontFamily: questrial }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleReauthAndSubmit}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal: Desativar ── */}
        <Modal visible={modalDeactivateVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="pause-circle-outline" size={40} color="#e67e22" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: '#e67e22' }]}>Desativar conta</Text>
              <Text style={[styles.modalDesc, { fontFamily: questrial }]}>
                Sua conta será desativada temporariamente. Você poderá reativá-la fazendo login novamente.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => setModalDeactivateVisible(false)} style={styles.modalBtnCancel}>
                  <Text style={{ color: TEXT_MUTED, fontFamily: questrial }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnConfirm, { backgroundColor: '#e67e22' }]}
                  onPress={() => {
                    setModalDeactivateVisible(false);
                    setPendingAction('DEACTIVATE');
                    setCurrentPassword('');
                    setModalReauthVisible(true);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Desativar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal: Excluir ── */}
        <Modal visible={modalDeleteVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="trash-outline" size={40} color="#c0392b" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { fontFamily: questrial, color: '#c0392b' }]}>Excluir conta</Text>
              <Text style={[styles.modalDesc, { fontFamily: questrial }]}>
                Atenção! Esta ação é irreversível. Todos os seus dados serão permanentemente apagados.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity onPress={() => setModalDeleteVisible(false)} style={styles.modalBtnCancel}>
                  <Text style={{ color: TEXT_MUTED, fontFamily: questrial }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnConfirm, { backgroundColor: '#c0392b' }]}
                  onPress={() => {
                    setModalDeleteVisible(false);
                    setPendingAction('DELETE');
                    setCurrentPassword('');
                    setModalReauthVisible(true);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontFamily: questrial }}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal: E-mail enviado ── */}
        <Modal visible={modalPasswordSentVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="mail-outline" size={40} color={PRIMARY} style={{ alignSelf: 'center', marginBottom: 12 }} />
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
  header: { paddingBottom: 20 },
  headerTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 8, marginBottom: 16,
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },
  headerTitleBlock: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6 },

  profileRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingBottom: 4, gap: 10,
  },
  avatarBlock: { position: 'relative' },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 28, color: '#fff', fontWeight: '700' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, color: '#fff', fontWeight: '700' },
  roleBadge: {
    backgroundColor: '#1ab89a', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: 4, marginBottom: 6,
  },
  roleBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  emailRow: { flexDirection: 'row', alignItems: 'center' },
  profileEmail: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  regionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12,
    padding: 10, width: 148,
  },
  regionCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  regionCardLabel: { fontSize: 10, color: TEXT_MUTED },
  regionCardCity: { fontSize: 14, color: '#111', fontWeight: '700' },
  regionCardUnit: { fontSize: 11, color: TEXT_MUTED, marginBottom: 6 },
  regionCardLink: { fontSize: 11, color: '#1ab89a', fontWeight: '600' },

  // Body
  body: { flex: 1 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: PRIMARY,
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  twoColRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  halfCard: {
    flex: 1, margin: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 13, color: PRIMARY, fontWeight: '700' },
  cardLinkText: { fontSize: 11, color: '#1ab89a', fontWeight: '600', marginTop: 4 },

  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 6,
  },
  accountRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(63,243,231,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  accountLabel: { fontSize: 11, color: TEXT_MUTED },
  accountValue: { fontSize: 14, color: '#222', fontWeight: '600' },
  alterBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER_LIGHT,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  alterBtnText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  divider: { height: 1, backgroundColor: BORDER_LIGHT, marginVertical: 8 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  actionIconCircle: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '700' },
  actionDesc: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  signOutText: { fontSize: 14, color: '#c0392b', fontWeight: '700' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fdf0ee', borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginTop: 16,
    borderLeftWidth: 3, borderLeftColor: '#c0392b',
  },
  errorText: { flex: 1, fontSize: 13, color: '#c0392b' },
  errorRetry: { fontSize: 13, color: PRIMARY, fontWeight: '700' },

  securityFooter: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 16, marginHorizontal: 16,
  },
  securityItem: { flexDirection: 'row', alignItems: 'center' },
  securityText: { fontSize: 11 },

  // Modais
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,77,72,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 20, padding: 24, elevation: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalDesc: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalInput: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER_LIGHT,
    borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderRadius: 12, backgroundColor: '#f0f0f0',
  },
  modalBtnConfirm: {
    flex: 1.5, paddingVertical: 13, alignItems: 'center',
    borderRadius: 12, backgroundColor: PRIMARY,
  },
});