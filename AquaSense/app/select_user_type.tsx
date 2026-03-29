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


