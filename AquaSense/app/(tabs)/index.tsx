import { Redirect } from "expo-router";

/**
 * Garante o redirecionamento para /select_user_type também dentro das tabs,
 * pois no Android o app ainda acessava essa rota mesmo com o Redirect em app/index.tsx.
 * 
 */


export default function TabsIndex() {
  return <Redirect href="/select_user_type" />;
}
