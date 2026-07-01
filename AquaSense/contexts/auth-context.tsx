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
import { updateLastWaterBody, markTutorialAsSeen } from "@/services/firestore/users";

export interface UserProfile {
    uid: string;
    nome: string;
    email: string;
    cidade: string;
    estado?: string;
    bairro?: string;
    areaChave?: string;
    latitude?: number;
    longitude?: number;
    tipoUsuario: string;
    statusConta: string;
    hasSeenTutorial: boolean;
    hasseenTutorialColaborador: boolean;
    ultimoCorpoHidricoAcessadoId?: string;
    ultimoCorpoHidricoAcessadoEm?: any;
}

interface AuthContextData {
    user: User | null;
    userProfile: UserProfile | null;
    loadingAuth: boolean;
    setLastWaterBody: (corpoHidricoId: string) => Promise<void>;
    markTutorialSeen: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({
    user: null,
    userProfile: null,
    loadingAuth: true,
    setLastWaterBody: async () => {},
    markTutorialSeen: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                await reload(firebaseUser);
                const freshUser = auth.currentUser;

                if (freshUser) {
                    setUser(freshUser);

                    const docRef = doc(db, "usuarios", freshUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data() as UserProfile;

                        if (
                            freshUser.emailVerified &&
                            data.statusConta === "pendente_verificacao"
                        ) {
                            await updateDoc(docRef, { statusConta: "ativo" });
                            setUserProfile({ ...data, uid: freshUser.uid, statusConta: "ativo" });
                        } else {
                            setUserProfile({ ...data, uid: freshUser.uid });
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

    const setLastWaterBody = useCallback(async (corpoHidricoId: string) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        setUserProfile((prev) =>
            prev ? { ...prev, ultimoCorpoHidricoAcessadoId: corpoHidricoId } : prev
        );

        await updateLastWaterBody(uid, corpoHidricoId);
    }, []);

    const markTutorialSeen = useCallback(async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        await markTutorialAsSeen(uid);

        setUserProfile((prev) =>
            prev ? { ...prev, hasSeenTutorial: true } : prev
        );
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, userProfile, loadingAuth, setLastWaterBody, markTutorialSeen }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}