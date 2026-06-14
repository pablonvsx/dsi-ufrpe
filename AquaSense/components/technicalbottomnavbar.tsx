import React, { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const PRIMARY      = '#004d48';
const BORDER_LIGHT = '#e0f2f1';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type TechNavTab = 'home' | 'analises' | 'alertas' | 'profile';

interface TechnicalBottomNavProps {
    /** Aba atualmente ativa — destaca o ícone correspondente. */
    active: TechNavTab;
    /** Família tipográfica opcional (ex: Questrial). */
    fontFamily?: string;
}

// ─── Definição das abas ───────────────────────────────────────────────────────
const LEFT_TABS: {
    key: TechNavTab;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    route: string;
}[] = [
    { key: 'home',     icon: 'home-outline',          label: 'Home',     route: '/(tabs)/home_technician' },
    { key: 'analises', icon: 'document-text-outline', label: 'Análises', route: '/(tabs)/analyses_union'  },
];

const RIGHT_TABS: typeof LEFT_TABS = [
    { key: 'alertas', icon: 'notifications-outline', label: 'Alertas', route: '/alerts'          },
    { key: 'profile', icon: 'person-outline',        label: 'Perfil',  route: '/(tabs)/profile'  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
/**
 * Navbar inferior padronizada para todas as telas do fluxo técnico.
 *
 * Uso:
 *   <TechnicalBottomNav active="home" />
 *   <TechnicalBottomNav active="analises" />
 *   <TechnicalBottomNav active="alertas" />
 *   <TechnicalBottomNav active="profile" />
 */
const TechnicalBottomNav: React.FC<TechnicalBottomNavProps> = ({ active, fontFamily }) => {
    const router = useRouter();

    const handleTab = useCallback(
        (route: string, key: TechNavTab) => {
            // Se já estamos na aba, não redireciona
            if (key === active) return;

            // home e profile usam replace para limpar o stack
            if (key === 'home' || key === 'profile') {
                router.replace(route as any);
            } else {
                router.push(route as any);
            }
        },
        [active, router],
    );

    // ── MUDANÇA: botão "+" navega para a tela de Nova Análise Técnica ──────────
    const handleAdd = useCallback(() => {
        router.push('/(tabs)/new_analyses' as any);
    }, [router]);

    const renderTab = (tab: typeof LEFT_TABS[0]) => {
        const isActive = active === tab.key;
        // Remove "-outline" para o ícone ativo (versão preenchida)
        const iconName = isActive
            ? (tab.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
            : tab.icon;

        return (
            <TouchableOpacity
                key={tab.key}
                style={styles.navTabItem}
                onPress={() => handleTab(tab.route, tab.key)}
                activeOpacity={0.7}
            >
                <Ionicons name={iconName} size={23} color={isActive ? PRIMARY : '#aaa'} />
                <Text
                    style={[
                        styles.navTabLabel,
                        fontFamily ? { fontFamily } : undefined,
                        isActive && styles.navTabLabelActive,
                    ]}
                >
                    {tab.label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.tabBar}>
            {LEFT_TABS.map(renderTab)}

            {/* Botão FAB central */}
            <TouchableOpacity style={styles.tabAddBtn} onPress={handleAdd} activeOpacity={0.85}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {RIGHT_TABS.map(renderTab)}
        </View>
    );
};

export default TechnicalBottomNav;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 0 : 8,
        paddingTop: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: BORDER_LIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 12,
    },
    navTabItem: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: 2,
    },
    navTabLabel: {
        fontSize: 11,
        color: '#aaa',
        marginTop: 3,
    },
    navTabLabelActive: {
        color: PRIMARY,
        fontWeight: '600',
    },
    tabAddBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
        elevation: 8,
    },
});