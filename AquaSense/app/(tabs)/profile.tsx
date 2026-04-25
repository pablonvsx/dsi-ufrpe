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
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Questrial_400Regular } from '@expo-google-fonts/questrial';
import { Stack, useRouter } from 'expo-router';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';

// ── Design tokens ──────────────────────────────────────────
const PRIMARY      = '#004d48';
const BORDER_LIGHT = '#e0f2f1';
const TEXT_MUTED   = '#6b7a7a';
const SURFACE      = '#F5F9F8';

const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png');

// ── Componente de Modal Customizado ─────────────────────────
interface CustomModalProps {
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

const AquaModal = ({
  visible, title, placeholder, value, onChangeText,
  onConfirm, onCancel, secureTextEntry, fontFamily,
}: CustomModalProps) => (
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
            <Text style={[styles.modalBtnText, { color: TEXT_MUTED, fontFamily }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={styles.modalBtnConfirmWrapper}>
            <LinearGradient colors={['#004d48', '#0a6b5e']} style={styles.modalBtnConfirm}>
              <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily }]}>Confirmar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ── Modal de Confirmação ───────────────────────
interface ConfirmModalProps {
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
}: ConfirmModalProps) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {icon && (
          <View style={[styles.confirmIconCircle, confirmDanger && styles.confirmIconCircleDanger]}>
            <Ionicons name={icon as any} size={28} color={confirmDanger ? '#c0392b' : PRIMARY} />
          </View>
        )}
        <Text style={[styles.modalTitle, { fontFamily, color: confirmDanger ? '#c0392b' : PRIMARY }]}>{title}</Text>
        <Text style={[styles.confirmDescription, { fontFamily }]}>{description}</Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity onPress={onCancel} style={styles.modalBtnCancel}>
            <Text style={[styles.modalBtnText, { color: TEXT_MUTED, fontFamily }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={styles.modalBtnConfirmWrapper}>
            <LinearGradient
              colors={confirmDanger ? ['#8b1a1a', '#c0392b'] : ['#004d48', '#0a6b5e']}
              style={styles.modalBtnConfirm}
            >
              <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily }]}>{confirmLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default function PerfilScreen() {
  const [fontsLoaded] = useFonts({ Questrial_400Regular });
  const questrial = fontsLoaded ? 'Questrial_400Regular' : undefined;
  const router = useRouter();

  const [loading, setLoading]         = useState(true);
  const [userData, setUserData]       = useState({ nome: '', cidade: '', uf: '', email: '' });
  const [rios, setRios]               = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState<{ total: number; rios: string[] }>({ total: 0, rios: [] });

  // Estados para os Modais e Fluxo de Autenticação
  const [modalEmailVisible,  setModalEmailVisible]  = useState(false);
  const [modalPassVisible,   setModalPassVisible]   = useState(false);
  const [modalReauthVisible, setModalReauthVisible] = useState(false);
  const [modalDeactivateVisible, setModalDeactivateVisible] = useState(false);
  const [modalDeleteVisible,     setModalDeleteVisible]     = useState(false);

  const [newEmail,       setNewEmail]       = useState('');
  const [newPassword,    setNewPassword]    = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [pendingAction,  setPendingAction]  = useState<'EMAIL' | 'PASSWORD' | 'DEACTIVATE' | 'DELETE' | null>(null);

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
      }
    });

    const fetchData = async (uid: string) => {
      setLoading(true);
      try {
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

        const qRios    = query(collection(db, 'corposHidricos'), where('uid', '==', uid));
        const riosSnap = await getDocs(qRios);
        setRios(riosSnap.docs.map(d => d.data().nome));

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

  // ── Lógica de Reautenticação e Atualização ──────────────────
  const handleReauthenticateAndSubmit = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user || !user.email || !currentPassword) {
      Alert.alert('Erro', 'Por favor, insira sua senha atual.');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      if (pendingAction === 'EMAIL') {
        await updateEmail(user, newEmail);
        const userRef = doc(db, 'usuarios', user.uid);
        await updateDoc(userRef, { email: newEmail });
        setUserData(prev => ({ ...prev, email: newEmail }));
        Alert.alert('Sucesso', 'E-mail atualizado com sucesso!');
      } else if (pendingAction === 'PASSWORD') {
        await updatePassword(user, newPassword);
        Alert.alert('Sucesso', 'Senha atualizada com sucesso!');
      } else if (pendingAction === 'DEACTIVATE') {
        const userRef = doc(db, 'usuarios', user.uid);
        await updateDoc(userRef, { desativada: true, desativadaEm: new Date().toISOString() });
        Alert.alert('Conta desativada', 'Sua conta foi desativada. Você pode reativá-la fazendo login novamente.');
        router.replace('/login'); 
      } else if (pendingAction === 'DELETE') {
        const batch = writeBatch(db);

        const qRios = query(collection(db, 'corposHidricos'), where('uid', '==', user.uid));
        const riosSnap = await getDocs(qRios);
        riosSnap.docs.forEach(d => batch.delete(d.ref));

        const qObs = query(collection(db, 'observacoes'), where('uid', '==', user.uid));
        const obsSnap = await getDocs(qObs);
        obsSnap.docs.forEach(d => batch.delete(d.ref));

        batch.delete(doc(db, 'usuarios', user.uid));
        await batch.commit();

        await deleteUser(user);
        router.replace('/login');
      }

      setModalReauthVisible(false);
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setPendingAction(null);

    } catch (error: any) {
      console.error(error);
      let msg = 'Ocorreu um erro na operação.';
      if (error.code === 'auth/wrong-password') msg = 'Senha atual incorreta.';
      if (error.code === 'auth/invalid-email')  msg = 'E-mail inválido.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Desativar conta ──────────────────────────────────────────
  const handleDeactivate = () => setModalDeactivateVisible(true);

  // ── Excluir conta ────────────────────────────────────────────
  const handleDelete = () => setModalDeleteVisible(true);

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
            {/* Logo + botão de voltar na mesma linha */}
            <View style={styles.logoRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Image
                source={logoImg}
                style={styles.headerLogo}
                resizeMode="contain"
                tintColor="#FFFFFF"
              />
              {/* Espaço para centralizar o logo */}
              <View style={styles.backBtnPlaceholder} />
            </View>

            {/* Avatar e nome */}
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
          {loading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={[styles.loadingText, { fontFamily: questrial }]}>Carregando perfil...</Text>
            </View>
          ) : (
            <>
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
                    rios.map((rio, i) => (
                      <View key={i} style={styles.detailRow}>
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
                    observacoes.rios.map((rio, i) => (
                      <View key={i} style={styles.detailRow}>
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
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { setNewEmail(userData.email); setModalEmailVisible(true); }}
                  >
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
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { setNewPassword(''); setModalPassVisible(true); }}
                  >
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
                <TouchableOpacity style={styles.actionBtnWrapper} activeOpacity={0.82} onPress={handleDeactivate}>
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

                <TouchableOpacity style={styles.actionBtnWrapper} activeOpacity={0.82} onPress={handleDelete}>
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
            </>
          )}
        </ScrollView>

        {/* ── 1. Modal: Novo E-mail ── */}
        <AquaModal
          visible={modalEmailVisible}
          title="Editar E-mail"
          placeholder="Digite o novo e-mail"
          value={newEmail}
          onChangeText={setNewEmail}
          fontFamily={questrial}
          onCancel={() => setModalEmailVisible(false)}
          onConfirm={() => {
            if (!newEmail.includes('@')) return Alert.alert('Erro', 'Insira um e-mail válido.');
            setPendingAction('EMAIL');
            setModalEmailVisible(false);
            setModalReauthVisible(true);
          }}
        />

        {/* ── 2. Modal: Nova Senha ── */}
        <AquaModal
          visible={modalPassVisible}
          title="Alterar Senha"
          placeholder="Digite a nova senha"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          fontFamily={questrial}
          onCancel={() => setModalPassVisible(false)}
          onConfirm={() => {
            if (newPassword.length < 6) return Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres.');
            setPendingAction('PASSWORD');
            setModalPassVisible(false);
            setModalReauthVisible(true);
          }}
        />

        {/* ── 3. Modal: Reautenticação ── */}
        <AquaModal
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

        {/* ── 4. Modal: Confirmar Desativação ── */}
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

        {/* ── 5. Modal: Confirmar Exclusão ── */}
        <AquaConfirmModal
          visible={modalDeleteVisible}
          title="Excluir conta"
          description="Atenção! Esta ação é irreversível. Todos os seus dados (corpos hídricos, observações e perfil) serão permanentemente apagados."
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  inlineLoading: { paddingTop: 60, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: PRIMARY, fontSize: 14 },

  // Header
  headerGradient: { overflow: 'hidden' },
  tealOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  headerSafeArea: { paddingBottom: 0, zIndex: 1 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -10,
    marginBottom: 4,
  },
  headerLogo: { width: 140, height: 80 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPlaceholder: { width: 36 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28, gap: 16 },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, color: '#FFFFFF', fontWeight: '700' },
  avatarInfo: { flex: 1 },
  headerName: { fontSize: 22, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  headerLocation: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  waveWhite: { height: 28, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  // Body
  body: { flex: 1, backgroundColor: '#FFFFFF' },
  bodyContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY, marginTop: 18, marginBottom: 12, letterSpacing: 0.2 },

  // Card
  card: {
    backgroundColor: SURFACE, borderRadius: 20, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(63,243,231,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitle: { flex: 1, fontSize: 15, color: PRIMARY, fontWeight: '600' },
  cardNumber: { fontSize: 26, fontWeight: '700', color: PRIMARY },
  cardDivider: { height: 1, backgroundColor: BORDER_LIGHT, marginVertical: 12 },
  cardDetails: { paddingLeft: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  detailItem: { fontSize: 13, color: '#444', lineHeight: 19, flex: 1 },
  detailEmpty: { fontSize: 13, color: TEXT_MUTED, fontStyle: 'italic' },

  // Configurações
  configRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  configLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  configIconCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(63,243,231,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  configLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 1 },
  configValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  configBtn: {
    borderRadius: 50, paddingVertical: 8, paddingHorizontal: 14,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  configBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },

  // Botões de ação
  actionRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  actionBtnWrapper: { flex: 1 },
  actionBtn: {
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  actionBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700', textAlign: 'center', lineHeight: 19 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 77, 72, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, elevation: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  modalInput: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER_LIGHT,
    borderRadius: 16, padding: 16, fontSize: 16, color: PRIMARY, marginBottom: 24,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#f0f0f0' },
  modalBtnConfirmWrapper: { flex: 1.5 },
  modalBtnConfirm: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  modalBtnText: { fontSize: 15, fontWeight: '700' },

  // Modal de confirmação
  confirmIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(63,243,231,0.15)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  confirmIconCircleDanger: {
    backgroundColor: 'rgba(192,57,43,0.1)',
  },
  confirmDescription: {
    fontSize: 14, color: TEXT_MUTED, textAlign: 'center',
    lineHeight: 21, marginBottom: 24,
  },
});