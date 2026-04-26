// Contexto global de autenticação e perfil do usuário.
// Inclui o ID do último corpo hídrico acessado para que a Home
// possa reagir imediatamente sem precisar refazer consulta ao Firestore.

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { onAuthStateChanged, reload, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { updateLastWaterBody } from "@/services/firestore/users";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export interface UserProfile {
    uid: string;
    nome: string;
    email: string;
    cidade: string;
    tipoUsuario: string;
    statusConta: string;
    hasSeenTutorial: boolean;

    /**
     * Referência ao último corpo hídrico acessado pelo usuário.
     *
     * DECISÃO ARQUITETURAL: guardamos apenas o ID, nunca o objeto completo.
     * Isso garante que a Home sempre busque dados frescos do Firestore,
     * evitando inconsistência entre o snapshot salvo e o estado atual do corpo.
     */
    ultimoCorpoHidricoAcessadoId?: string;

    
    ultimoCorpoHidricoAcessadoEm?: any;
}

interface AuthContextData {
    user: User | null;
    userProfile: UserProfile | null;
    loadingAuth: boolean;

    /**
     * Atualiza o último corpo hídrico acessado simultaneamente:
     *   1. No estado em memória (reação imediata na Home)
     *   2. No Firestore (persistência entre sessões)
     *
     * Chamada pelo Mapa quando o usuário abre o modal de um corpo hídrico.
     */
    setLastWaterBody: (corpoHidricoId: string) => Promise<void>;
}

// ─────────────────────────────────────────────
// CONTEXTO
// ─────────────────────────────────────────────

const AuthContext = createContext<AuthContextData>({
    user: null,
    userProfile: null,
    loadingAuth: true,
    setLastWaterBody: async () => {},
});

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Recarrega para obter emailVerified atualizado.
                await reload(firebaseUser);
                const freshUser = auth.currentUser;

                if (freshUser) {
                    setUser(freshUser);

                    const docRef = doc(db, "usuarios", freshUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data() as UserProfile;

                        // Sincronização automática: se o Firebase Auth diz que o e-mail
                        // foi verificado mas o Firestore ainda não reflete isso, atualiza.
                        if (
                            freshUser.emailVerified &&
                            data.statusConta === "pendente_verificacao"
                        ) {
                            await updateDoc(docRef, { statusConta: "ativo" });
                            setUserProfile({ ...data, statusConta: "ativo" });
                        } else {
                            setUserProfile(data);
                        }
                    }
                }
            } else {
                setUser(null);
                setUserProfile(null);
            }

            setLoadingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    /**
     * ATUALIZAÇÃO EM DOIS NÍVEIS — O que acontece quando o usuário abre um corpo hídrico:
     *
     * 1. Estado em memória (setUserProfile): a Home reage imediatamente sem esperar
     *    o round-trip do Firestore. O card aparece instantaneamente ao voltar.
     *
     * 2. Firestore (updateLastWaterBody): persiste a referência para que, na próxima
     *    sessão (após fechar e reabrir o app), a Home ainda exiba o último corpo acessado.
     */
    const setLastWaterBody = useCallback(async (corpoHidricoId: string) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        // Atualiza imediatamente o estado em memória
        setUserProfile((prev) =>
            prev ? { ...prev, ultimoCorpoHidricoAcessadoId: corpoHidricoId } : prev
        );

        // Persiste no Firestore em background (falha silenciosa no serviço)
        await updateLastWaterBody(uid, corpoHidricoId);
    }, []);

    return (
        <AuthContext.Provider value={{ user, userProfile, loadingAuth, setLastWaterBody }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useAuth() {
    return useContext(AuthContext);
}