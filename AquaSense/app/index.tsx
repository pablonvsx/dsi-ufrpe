import { Redirect } from "expo-router";

/**
 * Ponto de entrada principal do app.
 * Redireciona automaticamente para a tela de seleção de perfil.
 */

export default function Index() {
    //return <Redirect href="/select_user_type" />;
    //return <Redirect href="/register_water_body" />;
    //return <Redirect href="/register_pou" />;
    return <Redirect href="/(tabs)" />;
    //Descomente a linha acima para redirecionar para a tela inicial das abas

}
