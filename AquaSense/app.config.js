const { config } = require('dotenv');

require('dotenv').config();

module.exports = {
  expo: {
    name: "AquaSense",
    slug: "AquaSense",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "aquasense", // Essencial para resolver o aviso de Linking
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pablonvsx.aquasense",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY
      },
      infoPlist: {
        NSCameraUsageDescription: "O AquaSense precisa de acesso à câmera para você tirar fotos ao registrar uma denúncia.",
        NSPhotoLibraryUsageDescription: "O AquaSense precisa de acesso às suas fotos para anexar imagens à denúncia.",
        NSLocationWhenInUseUsageDescription: "O AquaSense precisa da sua localização para registrar onde o problema ambiental ocorreu."
      }
    },
    android: {
      package: "com.pablonvsx.aquasense",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY
        }
      },
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "O AquaSense precisa de acesso às suas fotos para anexar imagens à denúncia.",
          "cameraPermission": "O AquaSense precisa de acesso à câmera para você tirar fotos ao registrar uma denúncia."
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "O AquaSense precisa da sua localização para registrar onde o problema ambiental ocorreu."
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    }
  }
};