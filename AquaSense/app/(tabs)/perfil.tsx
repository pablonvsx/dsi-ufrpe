// app/(tabs)/perfil.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Para os ícones de mapa e alertas
import { LinearGradient } from 'expo-linear-gradient'; // Para o gradiente no topo
const logoImg = require('../../assets/images/AquaSenseLogoAlinhada.png'); 

export default function PerfilScreen() {
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
                <Text style={styles.avatarText}>A</Text>
              </View>
              <View>
                <Text style={styles.userName}>Ana Souza</Text>
                <Text style={styles.userLocation}>Recife - PE</Text>
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
            {/* Conteúdo do Card */}
            <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                    <Ionicons name="water" size={24} color="#00A896" />
                </View>
                <Text style={styles.cardTitle}>Corpos hídricos registrados</Text>
                <Text style={styles.cardNumber}>2</Text>
            </View>
            <View style={styles.cardDetails}>
                <Text style={styles.detailItem}>• Rio Capibaribe</Text>
                <Text style={styles.detailItem}>• Rio Moxotó</Text>
            </View>
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
    fontSize: 20,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
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