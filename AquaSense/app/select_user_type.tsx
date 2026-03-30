import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Pressable,
    Platform,
    Image,
    Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Stack, useRouter } from "expo-router";

// Captura a altura da tela para garantir que o conteúdo ocupe
// pelo menos toda área visível do dispositivo.
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Define o formato de cada perfil exibido na tela.
type ProfileType = {
    id: string;
    route: string;
    description: string;

};

const PROFILES: ProfileType[] = [
    {
        id: "comum",
        label:"Usuário Comum",
        route: "/cadatro-comum",
        description: "Registra observações visuais sobre a qualidade da água, como cor, odor e presença de lixo ou contaminantes. Ideal para cidadãos que querem contribuir com sua comunidade.",
    },
    {
        id: "colaborador",
        label: "Usuário Colaborador",
        route: "/cadastro-colaborador",
        description: "Vinculado a comunidades ou iniciativas locais, contribui com observações e registros contínuos no sistema. Atua como ponte entre a população e os especialistas.",
    },
    {
        id: "técnico",
        label: "Equipe Técnica",
        route: "/cadastro-tecnico",
        description: "Responsável por análises técnicas detalhadas, acompanhamento de dados e validações especializadas. Utiliza ferramentas avançadas de monitoramento",
        
    },
    {
        id: "gestor",
        label: "Usuário Gestor",
        route: "/cadastro-gestor",
        description: "Responsável pelo monitoramento geral, visualização de informações estratégicas e suporte à tomada de decisão em nível institucional ou municipal.",
    },
];

// Componente principal da tela de seleção de perfil. 
// Aqui ficam concentradas a navegação, o controle do modal
// e a renderização da estrutura central da interface.
export default function SelectUserType() {
    const router = useRouter();
    const [activeInfo, setActiveInfo] = useState<ProfileType | null>(null);

    // Carrega a fonte personalizada para o aplicativo.
    const [fontsLoaded] = useFonts({
        Questrial_400Regular,
    });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    return (
<>
<Stack.Screen options={{ headerShown: false }} />
  <SafeAreaView style={styles.safeArea}>
    <StatusBar
      barStyle="light-content"
      translucent
      backgroundColor="transparent"
    />

    <LinearGradient
      colors={["#004d48", "#3ff3e7"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />

    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      
    > 
      <View style={styles.logoSection}>
        <Image
          source={require("../assets/images/aquasense-logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
          tintColor="#FFFFFF"
        />

        <Text style={[styles.supportText, { fontFamily: questrial }]}>
          Selecione o perfil que melhor representa você
        </Text>
      </View>
        
      <View style={styles.profileSection}>
        {PROFILES.map((profile) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            fontFamily={questrial}
            onSelect={() => router.push(profile.route as any)}
            onInfo={() => setActiveInfo(profile)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { fontFamily: questrial }]}>
          Já tem uma conta?{" "}
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/login" as any)}
          activeOpacity={0.7}
        >
          <Text style={[styles.footerLink, { fontFamily: questrial }]}>
            Entrar
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Modal controlado pelo estado `activeInfo`.
    Quando um perfil é selecionado no ícone de informação,
    seu conteúdo é exibido aqui. */}
    <InfoModal
      profile={activeInfo}
      fontFamily={questrial}
      onClose={() => setActiveInfo(null)}
    />
  </SafeAreaView>
</>
    );
}

