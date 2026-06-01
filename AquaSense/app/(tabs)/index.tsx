import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

export default function TabsIndex() {
    const { tutorial } = useLocalSearchParams<{ tutorial?: string }>();
    const { userProfile, loadingAuth } = useAuth();

    if (loadingAuth) return null;

    const tutorialParam = tutorial === "1";
    const tipo = userProfile?.tipoUsuario;

    if (tipo === "colaborador") {
        const jaViu = userProfile?.hasseenTutorialColaborador === true;
        const href = (!jaViu || tutorialParam)
            ? "/(tabs)/home_collaborator_update?tutorial=1"
            : "/(tabs)/home_collaborator_update";
        return <Redirect href={href as any} />;
    }

    if (tipo === "gestor") {
        return <Redirect href={"/(tabs)/home_manager" as any} />;
    }

    if (tipo === "tecnico") {
        return <Redirect href={"/under-development" as any} />;
    }

    // "comum" ou sem perfil
    const jaViu = userProfile?.hasSeenTutorial === true;
    return <Redirect href={(!jaViu || tutorialParam) ? ("/(tabs)/home?tutorial=1" as any) : ("/(tabs)/home" as any)} />;
}