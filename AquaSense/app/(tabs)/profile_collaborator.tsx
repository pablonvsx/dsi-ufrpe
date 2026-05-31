import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter } from 'expo-router';
import {
  getAuth,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  signOut,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuth } from '@/contexts/auth-context';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { sendPasswordResetEmail } from '@/services/emailService';

// ── Design tokens ──────────────────────────────────────────
const PRIMARY    = '#004d48';
const TEAL_LIGHT = 'rgba(63,243,231,0.15)';
const TEXT_MUTED = '#6b7a7a';
const SURFACE    = '#FFFFFF';
const BORDER     = '#eef2f1';

const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png');

// ── Dados de impacto ───────────────────────────────────────
interface ImpactData {
  medicoes: number;
  ocorrencias: number;
  contribuicoes: number;
}

// ── Helpers ────────────────────────────────────────────────
const maskEmail = (email: string) => {
  if (!email) return '';
  const [user, domain] = email.split('@');
  return `${user.substring(0, 3)}****@${domain}`;
};

// ── Modal de input (e-mail / reautenticação) ───────────────
interface AquaInputModalProps {
  visible: boolean;
  title: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  secureTextEntry?: boolean;
  fontFamily?: string;
}

const AquaInputModal = ({
  visible, title, placeholder, value, onChangeText,
  onConfirm, onCancel, secureTextEntry, fontFamily,
}: AquaInputModalProps) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={[styles.modalTitle, { fontFamily, color: PRIMARY }]}>{title}</Text>
        <TextInput
          style={[styles.modalInput, { fontFamily }]}
          placeholder={placeholder}
          placeholderTextColor={TEXT_MUTED}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity onPress={onCancel} style={styles.modalBtnCancel}>
            <Text style={[styles.modalBtnCancelText, { fontFamily }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={styles.modalBtnConfirmWrapper}>
            <LinearGradient colors={['#004d48', '#0a6b5e']} style={styles.modalBtnGradient}>
              <Text style={[styles.modalBtnConfirmText, { fontFamily }]}>Confirmar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ── Modal de confirmação genérico ──────────────────────────
interface AquaConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fontFamily?: string;
  icon?: string;
}

const AquaConfirmModal = ({
  visible, title, description, confirmLabel, confirmDanger,
  onConfirm, onCancel, fontFamily, icon,
}: AquaConfirmModalProps) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {icon && (
          <View style={[styles.modalIconCircle, confirmDanger && styles.modalIconCircleDanger]}>
            <Ionicons name={icon as any} size={28} color={confirmDanger ? '#c0392b' : PRIMARY} />
          </View>
        )}
        <Text style={[styles.modalTitle, { fontFamily, color: confirmDanger ? '#c0392b' : PRIMARY }]}>
          {title}
        </Text>
        <Text style={[styles.modalDescription, { fontFamily }]}>{description}</Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity onPress={onCancel} style={styles.modalBtnCancel}>
            <Text style={[styles.modalBtnCancelText, { fontFamily }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={styles.modalBtnConfirmWrapper}>
            <LinearGradient
              colors={confirmDanger ? ['#8b1a1a', '#c0392b'] : ['#004d48', '#0a6b5e']}
              style={styles.modalBtnGradient}
            >
              <Text style={[styles.modalBtnConfirmText, { fontFamily }]}>{confirmLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ── Linha de configuração clicável ─────────────────────────
interface ConfigRowProps {
  icon: string;
  label: string;
  onPress: () => void;
  fontFamily?: string;
  isLast?: boolean;
}

const ConfigRow = ({ icon, label, onPress, fontFamily, isLast }: ConfigRowProps) => (
  <>
    <TouchableOpacity style={styles.configRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.configLeft}>
        <View style={styles.configIconCircle}>
          <Ionicons name={icon as any} size={18} color={PRIMARY} />
        </View>
        <Text style={[styles.configLabel, { fontFamily }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
    </TouchableOpacity>
    {!isLast && <View style={styles.rowDivider} />}
  </>
);

// ── Coluna de impacto ──────────────────────────────────────
interface ImpactColProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  value: number;
  label: string;
  fontFamily?: string;
}

const ImpactCol = ({ icon, iconColor, iconBg, value, label, fontFamily }: ImpactColProps) => (
  <View style={styles.impactCol}>
    <View style={[styles.impactIconCircle, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
    </View>
    <Text style={[styles.impactNumber, { fontFamily }]}>{value}</Text>
    <Text style={[styles.impactLabel, { fontFamily }]}>{label}</Text>
  </View>
);

// ── Tela principal ─────────────────────────────────────────
export default function PerfilColaboradorScreen() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;
  const router = useRouter();

  const { user, userProfile, loadingAuth } = useAuth();

  const [impact, setImpact] = useState<ImpactData>({ medicoes: 0, ocorrencias: 0, contribuicoes: 0 });
  const [loadingImpact, setLoadingImpact] = useState(true);

  // ── Estados dos modais ─────────────────────────────────
  const [modalEmailVisible,          setModalEmailVisible]          = useState(false);
  const [modalReauthVisible,         setModalReauthVisible]         = useState(false);
  const [modalDeactivateVisible,     setModalDeactivateVisible]     = useState(false);
  const [modalDeleteVisible,         setModalDeleteVisible]         = useState(false);
  const [modalPasswordConfirmVisible, setModalPasswordConfirmVisible] = useState(false);
  const [modalPasswordSentVisible,   setModalPasswordSentVisible]   = useState(false);
  const [modalSignOutVisible,        setModalSignOutVisible]        = useState(false);

  // ── Estados de formulário ──────────────────────────────
  const [newEmail,        setNewEmail]        = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [pendingAction,   setPendingAction]   = useState<
    'EMAIL' | 'DEACTIVATE' | 'DELETE' | null
  >(null);

  // ── Busca dados de impacto do Firestore ────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const fetchImpact = async () => {
      setLoadingImpact(true);
      try {
        const uid = user.uid;

        const qMedicoes = query(collection(db, 'observacoes'), where('uid', '==', uid));
        const medicoesSnap = await getDocs(qMedicoes);

        const qOcorrencias = query(collection(db, 'ocorrencias'), where('uid', '==', uid));
        const ocorrenciasSnap = await getDocs(qOcorrencias);

        const qContribuicoes = query(
          collection(db, 'observacoes'),
          where('uid', '==', uid),
          where('status', '==', 'aprovada'),
        );
        const contribuicoesSnap = await getDocs(qContribuicoes);

        setImpact({
          medicoes:     medicoesSnap.size,
          ocorrencias:  ocorrenciasSnap.size,
          contribuicoes: contribuicoesSnap.size,
        });
      } catch (err) {
        console.error('Erro ao buscar impacto:', err);
      } finally {
        setLoadingImpact(false);
      }
    };

    fetchImpact();
  }, [user?.uid]);

  // ── Formata data de criação ────────────────────────────
  const formatarDataEntrada = (): string => {
    const metadata = user?.metadata?.creationTime;
    if (!metadata) return '';
    return new Date(metadata).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // ── Reautenticação e execução da ação pendente ─────────
  const handleReauthenticateAndSubmit = async () => {
    const firebaseAuth = getAuth();
    const currentUser  = firebaseAuth.currentUser;

    if (!currentUser || !currentUser.email || !currentPassword) {
      Alert.alert('Erro', 'Por favor, insira sua senha atual.');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      if (pendingAction === 'EMAIL') {
        await updateEmail(currentUser, newEmail);
        await updateDoc(doc(db, 'usuarios', currentUser.uid), { email: newEmail });
        Alert.alert('Sucesso', 'E-mail atualizado com sucesso!');

      } else if (pendingAction === 'DEACTIVATE') {
        await updateDoc(doc(db, 'usuarios', currentUser.uid), {
          desativada:   true,
          desativadaEm: new Date().toISOString(),
        });
        Alert.alert('Conta desativada', 'Sua conta foi desativada. Você pode reativá-la fazendo login novamente.');
        router.replace('/login');

      } else if (pendingAction === 'DELETE') {
        const batch = writeBatch(db);

        const qRios = query(collection(db, 'corposHidricos'), where('uid', '==', currentUser.uid));
        (await getDocs(qRios)).docs.forEach(d => batch.delete(d.ref));

        const qObs = query(collection(db, 'observacoes'), where('uid', '==', currentUser.uid));
        (await getDocs(qObs)).docs.forEach(d => batch.delete(d.ref));

        batch.delete(doc(db, 'usuarios', currentUser.uid));
        await batch.commit();
        await deleteUser(currentUser);
        router.replace('/login');
      }

      setModalReauthVisible(false);
      setCurrentPassword('');
      setNewEmail('');
      setPendingAction(null);

    } catch (error: any) {
      console.error(error);
      let msg = 'Ocorreu um erro na operação.';
      if (error.code === 'auth/wrong-password') msg = 'Senha atual incorreta.';
      if (error.code === 'auth/invalid-email')  msg = 'E-mail inválido.';
      Alert.alert('Erro', msg);
    }
  };

  // ── Envio de e-mail de redefinição de senha ────────────
  const handlePasswordReset = async () => {
    const firebaseAuth = getAuth();
    const currentUser  = firebaseAuth.currentUser;
    if (!currentUser?.email) return;

    try {
      await sendPasswordResetEmail({ email: currentUser.email });
      setModalPasswordSentVisible(true);
    } catch (err: any) {
      const msg =
        err?.code === 'auth/too-many-requests'
          ? 'Muitas tentativas. Tente novamente mais tarde.'
          : 'Não foi possível enviar o e-mail. Tente novamente.';
      Alert.alert('Erro', msg);
    }
  };

  // ── Sign out ───────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch {
      Alert.alert('Erro', 'Não foi possível sair da conta. Tente novamente.');
    }
  };

  const initials = userProfile?.nome ? userProfile.nome.charAt(0).toUpperCase() : '?';

  if (loadingAuth) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.root}>
        {/* ══ HEADER ══ */}
        <LinearGradient
          colors={['#004d48', '#0a6b5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerLocationRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={[styles.headerLocationText, { fontFamily: questrial }]}>
                  {userProfile?.cidade ?? '—'} • PE
                </Text>
              </View>

              <Image source={logoImg} style={styles.headerLogo} resizeMode="contain" tintColor="#FFFFFF" />
            </View>

            <View style={styles.headerTitleBlock}>
              <Text style={[styles.headerTitle, { fontFamily: questrial }]}>Meu perfil</Text>
              <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                Gerencie suas informações e{'\n'}configurações da sua conta.
              </Text>
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
          {/* ── Card de perfil ── */}
          <View style={[styles.card, styles.profileCard]}>
            <View style={styles.profileAvatarWrapper}>
              <View style={styles.profileAvatarFallback}>
                <Text style={[styles.profileAvatarInitial, { fontFamily: questrial }]}>{initials}</Text>
              </View>
            </View>

            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { fontFamily: questrial }]}>
                {userProfile?.nome ?? '—'}
              </Text>
              <Text style={[styles.profileCargo, { fontFamily: questrial }]}>
                {userProfile?.tipoUsuario ?? '—'}
              </Text>

              <View style={styles.papelBadge}>
                <View style={styles.papelDot} />
                <Text style={[styles.papelText, { fontFamily: questrial }]}>Contribuidor</Text>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="mail-outline" size={14} color={TEXT_MUTED} style={styles.detailIcon} />
                <Text style={[styles.profileDetailText, { fontFamily: questrial }]}>
                  {maskEmail(userProfile?.email ?? '')}
                </Text>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="location-outline" size={14} color={TEXT_MUTED} style={styles.detailIcon} />
                <Text style={[styles.profileDetailText, { fontFamily: questrial }]}>
                  {userProfile?.cidade ?? '—'} • PE
                </Text>
              </View>

              <View style={styles.profileDetailRow}>
                <Ionicons name="calendar-outline" size={14} color={TEXT_MUTED} style={styles.detailIcon} />
                <Text style={[styles.profileDetailText, { fontFamily: questrial }]}>
                  Participando desde {formatarDataEntrada()}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Seu impacto ── */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Seu impacto</Text>

            {loadingImpact ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={styles.impactRow}>
                  <ImpactCol
                    icon="water-outline"
                    iconColor="#0a6b5e"
                    iconBg="rgba(10,107,94,0.1)"
                    value={impact.medicoes}
                    label={'Medições\nenviadas'}
                    fontFamily={questrial}
                  />
                  <View style={styles.impactDivider} />
                  <ImpactCol
                    icon="send-outline"
                    iconColor="#2980b9"
                    iconBg="rgba(41,128,185,0.1)"
                    value={impact.ocorrencias}
                    label={'Ocorrências\nreportadas'}
                    fontFamily={questrial}
                  />
                  <View style={styles.impactDivider} />
                  <ImpactCol
                    icon="checkmark-circle-outline"
                    iconColor="#27ae60"
                    iconBg="rgba(39,174,96,0.1)"
                    value={impact.contribuicoes}
                    label={'Contribuições\naprovadas'}
                    fontFamily={questrial}
                  />
                </View>

                <Text style={[styles.impactFootnote, { fontFamily: questrial }]}>
                  Sua participação ajuda a melhorar o monitoramento ambiental da região.
                </Text>
              </>
            )}
          </View>

          {/* ── Conta ── */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>Conta</Text>
            <ConfigRow
              icon="mail-outline"
              label="Alterar e-mail"
              onPress={() => {
                setNewEmail(userProfile?.email ?? '');
                setModalEmailVisible(true);
              }}
              fontFamily={questrial}
            />
            <ConfigRow
              icon="lock-closed-outline"
              label="Alterar senha"
              onPress={() => setModalPasswordConfirmVisible(true)}
              fontFamily={questrial}
              isLast
            />
          </View>

          {/* ── Gerenciar conta ── */}
          <View style={[styles.card, styles.dangerCard]}>
            <View style={styles.dangerHeader}>
              <Ionicons name="warning-outline" size={18} color="#c0392b" />
              <Text style={[styles.dangerTitle, { fontFamily: questrial }]}>Gerenciar conta</Text>
            </View>
            <View style={styles.rowDivider} />
            <ConfigRow
              icon="ban-outline"
              label="Desativar conta"
              onPress={() => setModalDeactivateVisible(true)}
              fontFamily={questrial}
            />
            <ConfigRow
              icon="trash-outline"
              label="Excluir conta permanentemente"
              onPress={() => setModalDeleteVisible(true)}
              fontFamily={questrial}
              isLast
            />
          </View>

          {/* ── Botão Sair ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setModalSignOutVisible(true)}
            style={styles.signOutWrapper}
          >
            <LinearGradient
              colors={['#004d48', '#0a6b5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signOutBtn}
            >
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={[styles.signOutText, { fontFamily: questrial }]}>Sair da conta</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* ══ MODAIS ══ */}

        {/* 1. Novo e-mail */}
        <AquaInputModal
          visible={modalEmailVisible}
          title="Alterar E-mail"
          placeholder="Digite o novo e-mail"
          value={newEmail}
          onChangeText={setNewEmail}
          fontFamily={questrial}
          onCancel={() => setModalEmailVisible(false)}
          onConfirm={() => {
            if (!newEmail.includes('@')) {
              Alert.alert('Erro', 'Insira um e-mail válido.');
              return;
            }
            setPendingAction('EMAIL');
            setModalEmailVisible(false);
            setCurrentPassword('');
            setModalReauthVisible(true);
          }}
        />

        {/* 2. Confirmar envio de e-mail de redefinição */}
        <AquaConfirmModal
          visible={modalPasswordConfirmVisible}
          title="Alterar senha"
          description={`Enviaremos um link de redefinição de senha para ${maskEmail(userProfile?.email ?? '')}. Verifique sua caixa de entrada e siga as instruções.`}
          confirmLabel="Enviar e-mail"
          icon="lock-closed-outline"
          fontFamily={questrial}
          onCancel={() => setModalPasswordConfirmVisible(false)}
          onConfirm={() => {
            setModalPasswordConfirmVisible(false);
            handlePasswordReset();
          }}
        />

        {/* 3. E-mail de redefinição enviado */}
        <AquaConfirmModal
          visible={modalPasswordSentVisible}
          title="E-mail enviado!"
          description={`Enviamos um link de redefinição de senha para ${maskEmail(userProfile?.email ?? '')}. Verifique sua caixa de entrada e siga as instruções.`}
          confirmLabel="Entendido"
          icon="mail-outline"
          fontFamily={questrial}
          onCancel={() => setModalPasswordSentVisible(false)}
          onConfirm={() => setModalPasswordSentVisible(false)}
        />

        {/* 4. Reautenticação */}
        <AquaInputModal
          visible={modalReauthVisible}
          title="Confirme sua Senha"
          placeholder="Senha atual para autorizar"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          fontFamily={questrial}
          onCancel={() => {
            setModalReauthVisible(false);
            setCurrentPassword('');
            setPendingAction(null);
          }}
          onConfirm={handleReauthenticateAndSubmit}
        />

        {/* 5. Confirmar desativação */}
        <AquaConfirmModal
          visible={modalDeactivateVisible}
          title="Desativar conta"
          description="Sua conta será desativada. Seus dados serão mantidos e você poderá reativá-la fazendo login novamente."
          confirmLabel="Desativar"
          icon="pause-circle-outline"
          fontFamily={questrial}
          onCancel={() => setModalDeactivateVisible(false)}
          onConfirm={() => {
            setModalDeactivateVisible(false);
            setPendingAction('DEACTIVATE');
            setCurrentPassword('');
            setModalReauthVisible(true);
          }}
        />

        {/* 6. Confirmar exclusão */}
        <AquaConfirmModal
          visible={modalDeleteVisible}
          title="Excluir conta"
          description="Atenção! Esta ação é irreversível. Todos os seus dados (medições, ocorrências e perfil) serão permanentemente apagados."
          confirmLabel="Excluir permanentemente"
          confirmDanger
          icon="trash-outline"
          fontFamily={questrial}
          onCancel={() => setModalDeleteVisible(false)}
          onConfirm={() => {
            setModalDeleteVisible(false);
            setPendingAction('DELETE');
            setCurrentPassword('');
            setModalReauthVisible(true);
          }}
        />

        {/* 7. Confirmar saída */}
        <AquaConfirmModal
          visible={modalSignOutVisible}
          title="Sair da conta"
          description="Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o aplicativo."
          confirmLabel="Sair"
          icon="log-out-outline"
          fontFamily={questrial}
          onCancel={() => setModalSignOutVisible(false)}
          onConfirm={() => {
            setModalSignOutVisible(false);
            handleSignOut();
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7f6' },

  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f6' },

  // Header
  header: { overflow: 'hidden' },
  headerSafe: { zIndex: 1 },
  headerTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerLocationText: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  headerLogo: { width: 36, height: 36 },
  headerTitleBlock: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 },
  headerTitle: { fontSize: 30, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 20 },
  waveWhite: { height: 28, backgroundColor: '#f4f7f6', borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 14, letterSpacing: 0.1 },

  // Card
  card: {
    backgroundColor: SURFACE, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  dangerCard: { borderWidth: 1, borderColor: 'rgba(192,57,43,0.15)' },

  // Profile card
  profileCard: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  profileAvatarWrapper: { flexShrink: 0 },
  profileAvatarFallback: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: TEAL_LIGHT,
    borderWidth: 2, borderColor: 'rgba(0,77,72,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarInitial: { fontSize: 36, color: PRIMARY, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  profileCargo: { fontSize: 13, color: TEXT_MUTED, marginBottom: 8, textTransform: 'capitalize' },

  papelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(39,174,96,0.1)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  papelDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#27ae60' },
  papelText: { fontSize: 13, color: '#27ae60', fontWeight: '600' },

  profileDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  detailIcon: { marginRight: 7 },
  profileDetailText: { fontSize: 13, color: '#555', flex: 1 },

  // Impacto
  impactRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  impactCol: { flex: 1, alignItems: 'center' },
  impactDivider: { width: 1, backgroundColor: BORDER, marginHorizontal: 4, alignSelf: 'stretch' },
  impactIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  impactNumber: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', lineHeight: 26 },
  impactLabel: { fontSize: 11, color: TEXT_MUTED, textAlign: 'center', lineHeight: 15, marginTop: 2 },
  impactFootnote: { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },

  // Config row
  configRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 13,
  },
  configLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  configIconCircle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: TEAL_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  configLabel: { fontSize: 14, color: '#1a1a1a' },
  rowDivider: { height: 1, backgroundColor: BORDER },

  // Danger card
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: '#c0392b' },

  // Botão sair
  signOutWrapper: {
    borderRadius: 16, marginBottom: 8,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 17,
  },
  signOutText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.3 },

  // Modal compartilhado
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,77,72,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, elevation: 20 },
  modalIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16,
  },
  modalIconCircleDanger: { backgroundColor: 'rgba(192,57,43,0.1)' },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  modalDescription: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalInput: {
    backgroundColor: '#F5F9F8', borderWidth: 1, borderColor: '#e0f2f1',
    borderRadius: 16, padding: 16, fontSize: 16, color: PRIMARY, marginBottom: 24,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: 14, backgroundColor: '#f0f0f0',
  },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: TEXT_MUTED },
  modalBtnConfirmWrapper: { flex: 1.5, borderRadius: 14, overflow: 'hidden' },
  modalBtnGradient: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  modalBtnConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});