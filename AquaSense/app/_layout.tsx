import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // AuthProvider envolve todo o app para que qualquer tela consiga
    // acessar o usuário logado e o perfil do Firestore via useAuth()
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          

          
          <Stack.Screen name="index" options={{ headerShown: false }} />

          {/* necessário para a splash conseguir navegar para o login */}
          <Stack.Screen name="login" options={{ headerShown: false }} />

          <Stack.Screen name="select_user_type" options={{ headerShown: false }} />
          

          {/* Tela exibida após o cadastro enquanto o usuário ainda não
              confirmou o e-mail. Fica fora das tabs pois é um passo
              intermediário do fluxo de autenticação. */}
          <Stack.Screen name="awaiting-verification" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false}} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}