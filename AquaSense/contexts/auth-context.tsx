import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { onAuthStateChanged, reload, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";

interface UserProfile {
    uid: string;
    nome: string;
    email: string;
    cidade: string;
    tipoUsuario: string;
    statusConta: string;
    hasSeenTutorial: boolean;    // ← campo novo
}

interface AuthContextData {
    user: User | null;
    userProfile: UserProfile | null;
    loadingAuth: boolean;
}

const AuthContext = createContext<AuthContextData>({
    user: null,
    userProfile: null,
    loadingAuth: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Recarrega o usuário para pegar o emailVerified atualizado.
                // Importante: se o usuário verificou o e-mail e voltou ao app,
                // o Firebase local ainda pode ter o estado antigo.
                await reload(firebaseUser);
                const freshUser = auth.currentUser;

                if (freshUser) {
                    setUser(freshUser);

                    const docRef = doc(db, "usuarios", freshUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data() as UserProfile;

                        // Se o Firebase Auth diz que o e-mail está verificado
                        // mas o Firestore ainda está como "pendente_verificacao",
                        // atualiza agora (sincronização automática).
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

    return (
        <AuthContext.Provider value={{ user, userProfile, loadingAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}