// app/(tabs)/perfil.tsx
import React, { useEffect, useState} from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient'; 
import { db } from '../../config/firebase'; 
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png'); 

export default function PerfilScreen() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({ nome: '', cidade: '', uf: '', email: '' });
  const [rios, setRios] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState<{ total: number, rios: string[] }>({ total: 0, rios: [] });

  // Função para mascarar o e-mail (ex: ama****@gmail.com)
  const maskEmail = (email: string) => {
    if (!email) return "";
    const [user, domain] = email.split('@');
    return `${user.substring(0, 3)}****@${domain}`;
  };

 useEffect(() => {
  const fetchData = async () => {
    try {
      console.log("---------------------------------");
      console.log("Iniciando busca para UID:", "2jy2bmooO9O7mGMOPWJBfNBx0dE2");

      const amandaUid = "2jy2bmooO9O7mGM0PWJBfNBx0dE2"; 
      
      // 1. Dados do Usuário
      const userRef = doc(db, "usuarios", amandaUid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        console.log("Usuário encontrado no Firestore!");
        const data = userSnap.data();
        setUserData({
          nome: data.nome || 'Usuário',     
          cidade: data.cidade || 'Cidade não informada', 
          uf: "PE",
          email: data.email || '' 
        });
      } else {
        console.warn("⚠️ Documento não existe na coleção 'usuarios' com esse ID.");
      }

      // 2. Corpos Hídricos
      console.log("Buscando Corpos Hídricos...");
      const qRios = query(collection(db, "corposHidricos"), where("uid", "==", amandaUid));
      const riosSnap = await getDocs(qRios);
      const listaRios = riosSnap.docs.map(doc => doc.data().nome);
      console.log(`${listaRios.length} rios encontrados.`);
      setRios(listaRios);

      // 3. Observações
      console.log("Buscando Observações...");
      const qObs = query(collection(db, "observacoes"), where("uid", "==", amandaUid));
      const obsSnap = await getDocs(qObs);
      
      const totalObs = obsSnap.size; 
      const riosComObs = Array.from(new Set(obsSnap.docs.map(doc => doc.data().nomeRio)));
      
      console.log(`${totalObs} observações em ${riosComObs.length} rios.`);
      setObservacoes({ total: totalObs, rios: riosComObs });

    } catch (error) {
      // Se houver erro de permissão (Rules) ou rede, aparecerá aqui
      console.error("Erro crítico na conexão:", error);
    } finally {
      setLoading(false);
      console.log("---------------------------------");
    }
  };

  fetchData();
}, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FBFB' }}>
        <ActivityIndicator size="large" color="#004d48" />
        <Text style={{ marginTop: 10, color: '#004d48' }}>Carregando perfil...</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#004d48", "#3ff3e7"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView>
          <View style={styles.headerContent}>
            {/* Logo */}
            <Image 
                source={logoImg} 
                style={styles.logoImage} 
                resizeMode="contain" 
            />
            
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                {/* Pega a primeira letra do nome dinamicamente */}
                <Text style={styles.avatarText}>
                  {userData.nome ? userData.nome.charAt(0).toUpperCase() : 'A'}
                </Text>
              </View>
              <View>
                <Text style={styles.userName}>{userData.nome}</Text>
                <Text style={styles.userLocation}>{`${userData.cidade} - ${userData.uf}`}</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Área Branca Arredondada */}
      <ScrollView 
        style={styles.contentScroll} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Visão geral</Text>

        {/* Card Corpos Hídricos */}
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                    <Ionicons name="water" size={24} color="#00A896" />
                </View>
                <Text style={styles.cardTitle}>Corpos hídricos registrados</Text>
                {/* Quantidade dinâmica baseada no array vindo do banco */}
                <Text style={styles.cardNumber}>{rios.length}</Text>
            </View>
            
            <View style={styles.cardDetails}>
                {rios.length > 0 ? (
                  rios.map((rio, index) => (
                    <Text key={index} style={styles.detailItem}>• {rio}</Text>
                  ))
                ) : (
                  <Text style={styles.detailItem}>Nenhum corpo hídrico encontrado.</Text>
                )}
            </View>
        </View>

        {/* Card Observações Feitas */}
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: '#E0F7F8' }]}>
                    <Ionicons name="create-outline" size={24} color="#00A896" />
                </View>
                <Text style={styles.cardTitle}>Observações feitas</Text>
                <Text style={styles.cardNumber}>{observacoes.total}</Text>
            </View>
            <View style={styles.cardDetails}>
                {observacoes.rios.length > 0 ? (
                  observacoes.rios.map((rio, index) => (
                    <View key={index} style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color="#00A896" />
                      <Text style={styles.detailItem}>{rio}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.detailItem}>Nenhuma observação registrada.</Text>
                )}
            </View>
        </View>
        {/* Seção Configurações da Conta */}
        <Text style={styles.sectionTitle}>Configurações da conta</Text>
        <View style={styles.card}>
          <View style={styles.configRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.configLabel}>E-mail: 
                <Text style={styles.configValue}>  {maskEmail(userData.email)}</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Editar e-mail</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.configRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.configLabel}>Senha: 
                <Text style={styles.configValue}>  ********</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Alterar senha</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botões de Perigo */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.btnExcluir]}>
            <Text style={styles.buttonText}>Excluir conta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.btnDesativar]}>
            <Text style={[styles.buttonText, styles.btnTextEscuro]}>Desativar conta</Text>
          </TouchableOpacity>
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFB', 
  },
  headerGradient: {
    height: 285, 
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerContent: {
    paddingTop: 0,
    alignItems: 'center',
    width: '100%',
  },
  logoImage: {
    width: 130,    
    height: 110,    
    alignSelf: 'center',
    marginBottom: 5,
    marginTop: -37,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: '100%',
    paddingLeft: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  avatarText: { 
    fontSize: 48, 
    color: '#FFF', 
    fontWeight: 'bold' 
  },
  userName: { 
    fontSize: 26, 
    color: '#FFF', 
    fontWeight: 'bold' 
  },
  userLocation: { 
    fontSize: 16, 
    color: '#FFF', 
    opacity: 0.8 
  },
  contentScroll: {
    flex: 1,
    marginTop: -25, 
    backgroundColor: '#F8FBFB',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 100, 
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#004d48',
    marginTop: 25,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    // Sombra
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  cardNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDetails: {
    paddingLeft: 62,
  },
  detailItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 6 
},
  // Estilos da seção de Configurações
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  configLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  configValue: { 
    fontWeight: 'normal', 
    color: '#666' 
},
divider: { 
    height: 1, 
    backgroundColor: '#F5F5F5', 
    marginVertical: 4 
},
  editButton: {
    backgroundColor: '#E0F7F8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#00A896',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  actionButton: {
    flex: 0.48,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  btnExcluir: {
    backgroundColor: '#D90429',
  },
  btnDesativar: {
    backgroundColor: '#A8DADC',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnTextEscuro: {
    color: '#1D3557',
  }
});