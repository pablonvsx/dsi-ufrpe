import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

export default function TabsIndex() {
    const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();
    const { userProfile, loadingAuth } = useAuth();

    // Aguarda carregar o perfil antes de redirecionar
    if (loadingAuth) return null;

    const tutorialParam = tutorial === "1";

    switch (userProfile?.tipoUsuario) {
        case "colaborador":
            return <Redirect href={tutorialParam ? "/home_collaborator?tutorial=1" : "/home_collaborator"} />;
        default:
            return <Redirect href={tutorialParam ? "/home?tutorial=1" : "/home"} />;
    }
}