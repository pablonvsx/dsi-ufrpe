import React, { useRef, useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Platform,
    Animated,
    Dimensions,
    Image,
    Modal,
    LayoutAnimation,
    UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRIMARY = "#004d48";
const TEAL_MED = "#0d6e52";
const TEXT_MUTED = "#6b7a7a";
const ORANGE = "#e07b1e";
const BLUE_ACTION = "#2563c7";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type TabKey = "home" | "mapa" | "painel" | "perfil";

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
    {
        q: "Como faço uma medição simples?",
        a: "Escolha o parâmetro que deseja medir (temperatura, pH ou observação visual), siga os passos do guia disponível nesta tela e registre o resultado pelo botão "+" na tela inicial. Quanto mais detalhes, melhor!",
    },
    {
        q: "O que significa medir o pH da água?",
        a: "O pH indica se a água é ácida, neutra ou alcalina, em uma escala de 0 a 14. O valor 7 é neutro. Para rios e lagos, a faixa saudável é entre 6,0 e 9,0 (CONAMA 357/2005). Valores fora disso podem sinalizar contaminação.",
    },
    {
        q: "O que devo observar antes de registrar uma contribuição?",
        a: "Observe a cor da água, se há espuma, resíduos ou odor incomum. Anote as condições do tempo (sol, chuva recente) e registre o local com o maior nível de detalhe possível. Fotografar o ponto é sempre recomendado.",
    },
    {
        q: "Posso enviar uma contribuição sem foto?",
        a: "Sim. A foto é opcional, mas ajuda muito a equipe técnica a confirmar as informações. Se não for possível fotografar, descreva o que viu com detalhes no campo de observações.",
    },
    {
        q: "Quando devo fazer uma denúncia?",
        a: "Faça uma denúncia quando identificar sinais claros de contaminação: despejo de esgoto, chorume, resíduos industriais, odor químico intenso ou mortandade de peixes. Nessa situação, registre com fotos e descreva o que foi observado.",
    },
    {
        q: "O que acontece depois que envio uma contribuição?",
        a: "Sua contribuição é analisada pela equipe técnica do AquaSense. Os dados são cruzados com outras fontes para gerar alertas e relatórios de qualidade hídrica. Você pode acompanhar o status pelo painel da comunidade.",
    },
    {
        q: "Como sei se uma água está em situação de atenção?",
        a: "No mapa do AquaSense, pontos em amarelo ou vermelho indicam situação de atenção ou risco. Você também pode verificar o histórico de medições de um ponto específico ao tocá-lo no mapa.",
    },
    {
        q: "Posso registrar informações de mais de um corpo hídrico?",
        a: "Sim! Não há limite de contribuições. Você pode registrar observações em quantos pontos quiser — rios, córregos, lagos ou reservatórios. Cada registro é vinculado automaticamente à localização informada.",
    },
];

// ─── Conteúdo do Guia Completo ────────────────────────────────────────────────

const GUIDE_STEPS = [
    {
        step: 1,
        icon: "thermometer-outline" as const,
        iconBg: "#e6f5ef",
        iconColor: TEAL_MED,
        title: "Temperatura da água",
        intro: "A temperatura é um dos parâmetros mais importantes da qualidade da água. Ela influencia diretamente a solubilidade do oxigênio, a velocidade das reações químicas e a vida aquática.",
        how: [
            "Use um termômetro calibrado ou sensor digital de temperatura.",
            "Mergulhe o sensor a pelo menos 20 cm de profundidade, longe da margem.",
            "Aguarde a leitura estabilizar (aproximadamente 1 minuto).",
            "Registre o valor em graus Celsius (°C).",
        ],
        reference: "Faixa ideal para corpos hídricos: 15°C a 25°C. Temperaturas acima de 30°C podem indicar poluição térmica ou impacto ambiental.",
        tip: "Evite medir em horários de sol intenso direto sobre a água. Prefira manhã cedo ou fim de tarde.",
    },
    {
        step: 2,
        icon: "water-outline" as const,
        iconBg: "#e8f0ff",
        iconColor: BLUE_ACTION,
        title: "pH da água",
        intro: "O pH mede a acidez ou alcalinidade da água em uma escala de 0 a 14. O valor 7 é neutro, abaixo de 7 é ácido e acima de 7 é alcalino.",
        how: [
            "Use fitas reagentes de pH ou um pHmetro digital.",
            "Colete uma amostra de água em recipiente limpo.",
            "Se usar fitas: mergulhe por 2 segundos e compare a cor com a escala.",
            "Se usar pHmetro: calibre o aparelho antes e mergulhe o eletrodo na amostra.",
            "Registre o valor com uma casa decimal (ex: 7,2).",
        ],
        reference: "Faixa adequada para água doce: pH entre 6,0 e 9,0 (Resolução CONAMA 357/2005). Valores fora dessa faixa podem indicar contaminação.",
        tip: "Lave bem o recipiente de coleta com a própria água do local antes de coletar a amostra.",
    },
    {
        step: 3,
        icon: "eye-outline" as const,
        iconBg: "#f0faf5",
        iconColor: "#2e8b6a",
        title: "Observações visuais",
        intro: "As observações visuais permitem identificar alterações visíveis na qualidade da água sem necessidade de equipamentos especializados.",
        how: [
            "Cor: observe a tonalidade da água (incolor, amarelada, esverdeada, avermelhada, acinzentada ou escura).",
            "Transparência: verifique se é possível ver o fundo, se a água é turva ou muito opaca.",
            "Espuma: observe se há espuma na superfície e se ela persiste.",
            "Resíduos: verifique a presença de lixo, óleo, algas, plantas em excesso ou outros materiais.",
            "Margem: anote o estado das margens (vegetação, erosão, construções, descarte irregular).",
        ],
        reference: "Água com coloração intensa, espuma persistente ou grande quantidade de algas pode indicar eutrofização ou descarte de efluentes.",
        tip: "Fotografe o local durante o registro. Imagens complementam muito as informações textuais.",
    },
    {
        step: 4,
        icon: "alert-circle-outline" as const,
        iconBg: "#fff8f0",
        iconColor: ORANGE,
        title: "Odor da água",
        intro: "O odor é um indicador sensorial importante. Muitas formas de contaminação produzem cheiros característicos que podem ser detectados sem equipamentos.",
        how: [
            "Aproxime-se do corpo hídrico com cuidado e inale suavemente o ar próximo à superfície.",
            "Classifique o odor: ausente, leve, moderado ou forte.",
            "Descreva o tipo: sem odor, terra molhada, sulfuroso (ovo podre), químico, esgotos, peixe ou outro.",
            "Registre a intensidade e o tipo no formulário de contribuição.",
        ],
        reference: "Odor de ovo podre pode indicar falta de oxigênio e decomposição. Odor químico pode indicar contaminação industrial ou agrícola.",
        tip: "Nunca inale profundamente diretamente sobre a água. Mantenha distância segura e avalie o ar ao redor.",
    },
    {
        step: 5,
        icon: "create-outline" as const,
        iconBg: "#f5f0fa",
        iconColor: "#7c3aed",
        title: "Registro de informações",
        intro: "Um registro bem feito é fundamental para que os dados coletados sejam úteis para análise pelos técnicos e gestores ambientais.",
        how: [
            "Anote a data e horário exato da coleta.",
            "Registre as condições climáticas (sol, nublado, chuva recente).",
            "Informe o ponto de coleta com o maior detalhe possível (nome do local, referências, coordenadas GPS se disponível).",
            "Preencha todos os campos do formulário, mesmo que o valor seja 'não observado'.",
            "Adicione fotos sempre que possível.",
            "Se houver algo incomum, descreva com suas próprias palavras no campo de observações.",
        ],
        reference: "Dados incompletos reduzem a confiabilidade da análise. Quanto mais contexto, melhor a interpretação pelos especialistas.",
        tip: "Registre os dados imediatamente após a observação, enquanto as informações estão frescas na memória.",
    },
];

// ─── Dados dos itens da lista ─────────────────────────────────────────────────

const LEARN_ITEMS = GUIDE_STEPS.map((s) => ({
    icon: s.icon,
    iconBg: s.iconBg,
    iconColor: s.iconColor,
    title: s.title,
    desc: s.step === 1
        ? "Como medir e registrar corretamente."
        : s.step === 2
        ? "Entenda a escala e como medir."
        : s.step === 3
        ? "Cor, transparência, presença de resíduos e mais."
        : s.step === 4
        ? "Como identificar e descrever o odor."
        : "Dicas para registrar dados completos e confiáveis.",
    guideIndex: s.step - 1,
}));

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function LearningCenter() {
    const router = useRouter();
    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    // Guia modal state
    const [guideVisible, setGuideVisible] = useState(false);
    const [guideStep, setGuideStep] = useState(0);

    // Param modal state
    const [paramVisible, setParamVisible] = useState(false);
    const [paramIndex, setParamIndex] = useState(0);

    // FAQ state
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(22)).current;
    const cardFade = useRef(new Animated.Value(0)).current;
    const cardSlide = useRef(new Animated.Value(24)).current;
    const guideStepFade = useRef(new Animated.Value(1)).current;
    const guideStepSlide = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 520, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(cardFade, { toValue: 1, duration: 420, useNativeDriver: true }),
                Animated.timing(cardSlide, { toValue: 0, duration: 420, useNativeDriver: true }),
            ]),
        ]).start();
    }, []);

    function handleTabPress(tab: TabKey) {
        switch (tab) {
            case "home": router.replace("/home_collaborator_update" as any); break;
            case "mapa": router.push("/map" as any); break;
            case "painel": router.push("/community_panel" as any); break;
            case "perfil": router.push("/profile" as any); break;
        }
    }

    function openGuide(startStep = 0) {
        setGuideStep(startStep);
        guideStepFade.setValue(1);
        guideStepSlide.setValue(0);
        setGuideVisible(true);
    }

    function animateGuideStep(next: number) {
        Animated.parallel([
            Animated.timing(guideStepFade, { toValue: 0, duration: 160, useNativeDriver: true }),
            Animated.timing(guideStepSlide, { toValue: -16, duration: 160, useNativeDriver: true }),
        ]).start(() => {
            setGuideStep(next);
            guideStepSlide.setValue(16);
            Animated.parallel([
                Animated.timing(guideStepFade, { toValue: 1, duration: 220, useNativeDriver: true }),
                Animated.timing(guideStepSlide, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start();
        });
    }

    function openParam(idx: number) {
        setParamIndex(idx);
        setParamVisible(true);
    }

    function toggleFaq(idx: number) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenFaqIndex(openFaqIndex === idx ? null : idx);
    }

    const currentGuide = GUIDE_STEPS[guideStep];
    const currentParam = GUIDE_STEPS[paramIndex];
    const isLastGuideStep = guideStep === GUIDE_STEPS.length - 1;

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.root}>
                {/* ── HEADER ─────────────────────────────────────────── */}
                <LinearGradient
                    colors={["#0d5c47", "#0d4a3e", "#0a3d32"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={["top"]} style={styles.headerSafe}>
                        <Animated.View
                            style={[
                                styles.headerTopRow,
                                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                            ]}
                        >
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <Text style={[styles.headerTitle, { fontFamily: questrial }]}>
                                    Central de Aprendizagem
                                </Text>
                                <Text style={[styles.headerSubtitle, { fontFamily: questrial }]}>
                                    Aprenda a realizar medições simples{"\n"}e contribuir com o monitoramento ambiental.
                                </Text>
                            </View>
                            <View style={styles.logoCircle}>
                                <Image
                                    source={require("../../assets/images/aquasense.png")}
                                    style={styles.logoHeader}
                                    resizeMode="contain"
                                />
                            </View>
                        </Animated.View>
                    </SafeAreaView>
                </LinearGradient>

                {/* ── BODY ───────────────────────────────────────────── */}
                <ScrollView
                    style={styles.scrollBody}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>

                        {/* ── CARD PRINCIPAL ─────────────────────────── */}
                        <View style={styles.mainCard}>
                            <View style={styles.ilustracaoWrap}>
                                <LinearGradient
                                    colors={["#c8e6d4", "#a8d5be", "#8ec4a8"]}
                                    style={styles.ilustracaoGrad}
                                >
                                    <View style={styles.ilustracaoIconsRow}>
                                        <View style={[styles.ilustracaoIcon, { backgroundColor: "rgba(13,110,82,0.18)" }]}>
                                            <Ionicons name="flask" size={28} color={TEAL_MED} />
                                        </View>
                                        <View style={[styles.ilustracaoIcon, { backgroundColor: "rgba(37,99,199,0.16)" }]}>
                                            <Ionicons name="thermometer" size={24} color={BLUE_ACTION} />
                                        </View>
                                    </View>
                                    <View style={[styles.ilustracaoIcon, { backgroundColor: "rgba(13,110,82,0.22)", marginTop: 8 }]}>
                                        <Ionicons name="water" size={32} color="#0a5c3a" />
                                    </View>
                                </LinearGradient>
                            </View>

                            <View style={styles.mainCardContent}>
                                <View style={styles.mainCardTitleRow}>
                                    <View style={styles.mainCardIconCircle}>
                                        <Ionicons name="flask-outline" size={18} color={TEAL_MED} />
                                    </View>
                                    <Text style={[styles.mainCardTitle, { fontFamily: questrial }]}>
                                        Guia de{"\n"}Medições Simples
                                    </Text>
                                </View>
                                <Text style={[styles.mainCardDesc, { fontFamily: questrial }]}>
                                    Aprenda como registrar temperatura, pH, odor, cor da água e observações visuais de forma adequada.
                                </Text>
                                <TouchableOpacity
                                    style={styles.iniciarBtn}
                                    onPress={() => openGuide(0)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.iniciarBtnText, { fontFamily: questrial }]}>Iniciar guia</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── O QUE VOCÊ VAI APRENDER ────────────────── */}
                        <Text style={[styles.sectionTitle, { fontFamily: questrial }]}>
                            O que você vai aprender
                        </Text>

                        <View style={styles.learnCard}>
                            {LEARN_ITEMS.map((item, idx) => (
                                <LearnItem
                                    key={item.title}
                                    icon={item.icon}
                                    iconBg={item.iconBg}
                                    iconColor={item.iconColor}
                                    title={item.title}
                                    desc={item.desc}
                                    fontFamily={questrial}
                                    isLast={idx === LEARN_ITEMS.length - 1}
                                    onPress={() => openParam(item.guideIndex)}
                                />
                            ))}
                        </View>

                        {/* ── RECOMENDAÇÃO ───────────────────────────── */}
                        <View style={styles.recomCard}>
                            <View style={styles.recomIconCircle}>
                                <Ionicons name="bulb-outline" size={22} color={TEAL_MED} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.recomTitle, { fontFamily: questrial }]}>
                                    Recomendação da Equipe Técnica
                                </Text>
                                <Text style={[styles.recomBody, { fontFamily: questrial }]}>
                                    Antes de realizar uma medição, observe as condições do local e registre informações complementares sempre que possível. Isso ajuda a gerar dados mais precisos!
                                </Text>
                            </View>
                            <View style={styles.recomDecor}>
                                <Ionicons name="leaf" size={42} color="#b6dfc9" style={{ opacity: 0.5 }} />
                            </View>
                        </View>

                        {/* ── DÚVIDAS FREQUENTES ─────────────────────── */}
                        <View style={styles.faqHeaderRow}>
                            <View style={styles.faqHeaderIconCircle}>
                                <Ionicons name="help-circle-outline" size={20} color={TEAL_MED} />
                            </View>
                            <Text style={[styles.sectionTitle, { fontFamily: questrial, marginBottom: 0, marginTop: 0 }]}>
                                Dúvidas frequentes
                            </Text>
                        </View>

                        <View style={styles.faqCard}>
                            {FAQ_ITEMS.map((item, idx) => (
                                <FaqItem
                                    key={idx}
                                    question={item.q}
                                    answer={item.a}
                                    isOpen={openFaqIndex === idx}
                                    isLast={idx === FAQ_ITEMS.length - 1}
                                    fontFamily={questrial}
                                    onToggle={() => toggleFaq(idx)}
                                />
                            ))}
                        </View>

                    </Animated.View>
                </ScrollView>

                {/* ── NAVBAR ─────────────────────────────────────────── */}
                <SafeAreaView edges={["bottom"]} style={styles.navWrapper}>
                    <View style={styles.navBar}>
                        <NavItem icon="home" iconOutline="home-outline" label="Home" active={false} fontFamily={questrial} onPress={() => handleTabPress("home")} />
                        <NavItem icon="map" iconOutline="map-outline" label="Mapa" active={false} fontFamily={questrial} onPress={() => handleTabPress("mapa")} />
                        <View style={styles.fabSpacer}>
                            <TouchableOpacity style={styles.fab} onPress={() => router.push("/register_observation" as any)} activeOpacity={0.85}>
                                <View style={styles.fabInner}>
                                    <Ionicons name="add" size={32} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>
                        <NavItem icon="people" iconOutline="people-outline" label="Painel" active={false} fontFamily={questrial} onPress={() => handleTabPress("painel")} />
                        <NavItem icon="person" iconOutline="person-outline" label="Perfil" active={false} fontFamily={questrial} onPress={() => handleTabPress("perfil")} />
                    </View>
                </SafeAreaView>
            </View>

            {/* ══════════════════════════════════════════════════════════
                MODAL — GUIA COMPLETO DE MEDIÇÕES
            ══════════════════════════════════════════════════════════ */}
            <Modal visible={guideVisible} transparent animationType="slide" onRequestClose={() => setGuideVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.guideCard}>
                        {/* Header do guia */}
                        <LinearGradient
                            colors={["#0d5c47", "#0d4a3e"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.guideHeader}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.guideHeaderLabel, { fontFamily: questrial }]}>
                                    Guia de Medições Simples
                                </Text>
                                <Text style={[styles.guideHeaderStep, { fontFamily: questrial }]}>
                                    Passo {guideStep + 1} de {GUIDE_STEPS.length}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setGuideVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </LinearGradient>

                        {/* Dots */}
                        <View style={styles.guideDotsRow}>
                            {GUIDE_STEPS.map((_, i) => (
                                <TouchableOpacity key={i} onPress={() => animateGuideStep(i)} activeOpacity={0.7}>
                                    <View style={[styles.guideDot, i === guideStep && styles.guideDotActive]} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Conteúdo animado */}
                        <ScrollView
                            style={styles.guideScrollBody}
                            contentContainerStyle={styles.guideScrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <Animated.View style={{ opacity: guideStepFade, transform: [{ translateY: guideStepSlide }] }}>
                                {/* Ícone e título */}
                                <View style={styles.guideStepHeader}>
                                    <View style={[styles.guideStepIconCircle, { backgroundColor: currentGuide.iconBg }]}>
                                        <Ionicons name={currentGuide.icon} size={28} color={currentGuide.iconColor} />
                                    </View>
                                    <Text style={[styles.guideStepTitle, { fontFamily: questrial }]}>
                                        {currentGuide.title}
                                    </Text>
                                </View>

                                {/* Introdução */}
                                <Text style={[styles.guideIntro, { fontFamily: questrial }]}>
                                    {currentGuide.intro}
                                </Text>

                                {/* Como fazer */}
                                <View style={styles.guideSection}>
                                    <View style={styles.guideSectionTitleRow}>
                                        <Ionicons name="list-outline" size={16} color={TEAL_MED} />
                                        <Text style={[styles.guideSectionTitle, { fontFamily: questrial }]}>Como fazer</Text>
                                    </View>
                                    {currentGuide.how.map((step, i) => (
                                        <View key={i} style={styles.guideHowItem}>
                                            <View style={styles.guideHowNumber}>
                                                <Text style={[styles.guideHowNumberText, { fontFamily: questrial }]}>{i + 1}</Text>
                                            </View>
                                            <Text style={[styles.guideHowText, { fontFamily: questrial }]}>{step}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Referência */}
                                <View style={styles.guideReferenceBox}>
                                    <View style={styles.guideReferenceTitleRow}>
                                        <Ionicons name="bar-chart-outline" size={15} color={BLUE_ACTION} />
                                        <Text style={[styles.guideReferenceTitle, { fontFamily: questrial }]}>Referência técnica</Text>
                                    </View>
                                    <Text style={[styles.guideReferenceText, { fontFamily: questrial }]}>
                                        {currentGuide.reference}
                                    </Text>
                                </View>

                                {/* Dica */}
                                <View style={styles.guideTipBox}>
                                    <Ionicons name="bulb-outline" size={16} color={ORANGE} style={{ marginTop: 1, flexShrink: 0 }} />
                                    <Text style={[styles.guideTipText, { fontFamily: questrial }]}>
                                        {currentGuide.tip}
                                    </Text>
                                </View>
                            </Animated.View>
                        </ScrollView>

                        {/* Botões de navegação */}
                        <View style={styles.guideBtnsRow}>
                            {guideStep > 0 ? (
                                <TouchableOpacity style={styles.guideBtnBack} onPress={() => animateGuideStep(guideStep - 1)} activeOpacity={0.75}>
                                    <Ionicons name="chevron-back" size={16} color={TEAL_MED} />
                                    <Text style={[styles.guideBtnBackText, { fontFamily: questrial }]}>Anterior</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={{ flex: 1 }} />
                            )}
                            {isLastGuideStep ? (
                                <TouchableOpacity style={styles.guideBtnFinish} onPress={() => setGuideVisible(false)} activeOpacity={0.85}>
                                    <Text style={[styles.guideBtnNextText, { fontFamily: questrial }]}>Concluir</Text>
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.guideBtnNext} onPress={() => animateGuideStep(guideStep + 1)} activeOpacity={0.85}>
                                    <Text style={[styles.guideBtnNextText, { fontFamily: questrial }]}>Próximo</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════
                MODAL — DETALHE DE PARÂMETRO
            ══════════════════════════════════════════════════════════ */}
            <Modal visible={paramVisible} transparent animationType="slide" onRequestClose={() => setParamVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.paramCard}>
                        {/* Header */}
                        <LinearGradient
                            colors={["#0d5c47", "#0d4a3e"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.paramHeader}
                        >
                            <View style={[styles.paramHeaderIcon, { backgroundColor: currentParam.iconBg }]}>
                                <Ionicons name={currentParam.icon} size={22} color={currentParam.iconColor} />
                            </View>
                            <Text style={[styles.paramHeaderTitle, { fontFamily: questrial }]}>
                                {currentParam.title}
                            </Text>
                            <TouchableOpacity onPress={() => setParamVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView
                            style={styles.paramScrollBody}
                            contentContainerStyle={styles.paramScrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Intro */}
                            <Text style={[styles.guideIntro, { fontFamily: questrial }]}>
                                {currentParam.intro}
                            </Text>

                            {/* Como fazer */}
                            <View style={styles.guideSection}>
                                <View style={styles.guideSectionTitleRow}>
                                    <Ionicons name="list-outline" size={16} color={TEAL_MED} />
                                    <Text style={[styles.guideSectionTitle, { fontFamily: questrial }]}>Como fazer</Text>
                                </View>
                                {currentParam.how.map((step, i) => (
                                    <View key={i} style={styles.guideHowItem}>
                                        <View style={styles.guideHowNumber}>
                                            <Text style={[styles.guideHowNumberText, { fontFamily: questrial }]}>{i + 1}</Text>
                                        </View>
                                        <Text style={[styles.guideHowText, { fontFamily: questrial }]}>{step}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Referência */}
                            <View style={styles.guideReferenceBox}>
                                <View style={styles.guideReferenceTitleRow}>
                                    <Ionicons name="bar-chart-outline" size={15} color={BLUE_ACTION} />
                                    <Text style={[styles.guideReferenceTitle, { fontFamily: questrial }]}>Referência técnica</Text>
                                </View>
                                <Text style={[styles.guideReferenceText, { fontFamily: questrial }]}>
                                    {currentParam.reference}
                                </Text>
                            </View>

                            {/* Dica */}
                            <View style={styles.guideTipBox}>
                                <Ionicons name="bulb-outline" size={16} color={ORANGE} style={{ marginTop: 1, flexShrink: 0 }} />
                                <Text style={[styles.guideTipText, { fontFamily: questrial }]}>
                                    {currentParam.tip}
                                </Text>
                            </View>

                            {/* Botão ver no guia completo */}
                            <TouchableOpacity
                                style={styles.paramGuideBtn}
                                onPress={() => { setParamVisible(false); openGuide(paramIndex); }}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="book-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={[styles.paramGuideBtnText, { fontFamily: questrial }]}>
                                    Ver no guia completo
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

// ─── FaqItem ──────────────────────────────────────────────────────────────────

function FaqItem({
    question, answer, isOpen, isLast, fontFamily, onToggle,
}: {
    question: string;
    answer: string;
    isOpen: boolean;
    isLast: boolean;
    fontFamily?: string;
    onToggle: () => void;
}) {
    return (
        <View style={[styles.faqItem, !isLast && styles.faqItemBorder]}>
            <TouchableOpacity
                style={styles.faqRow}
                onPress={onToggle}
                activeOpacity={0.72}
            >
                <View style={[styles.faqDot, isOpen && styles.faqDotActive]} />
                <Text style={[styles.faqQuestion, { fontFamily, color: isOpen ? PRIMARY : "#1a2e26" }]}>
                    {question}
                </Text>
                <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={isOpen ? TEAL_MED : "#ccc"}
                />
            </TouchableOpacity>
            {isOpen && (
                <View style={styles.faqAnswerWrap}>
                    <Text style={[styles.faqAnswer, { fontFamily }]}>{answer}</Text>
                </View>
            )}
        </View>
    );
}

// ─── LearnItem ────────────────────────────────────────────────────────────────

function LearnItem({
    icon, iconBg, iconColor, title, desc, fontFamily, isLast, onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    title: string;
    desc: string;
    fontFamily?: string;
    isLast: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={[styles.learnItem, !isLast && styles.learnItemBorder]} onPress={onPress} activeOpacity={0.75}>
            <View style={[styles.learnIconBox, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.learnTitle, { fontFamily }]}>{title}</Text>
                <Text style={[styles.learnDesc, { fontFamily }]}>{desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>
    );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
    icon, iconOutline, label, active, fontFamily, onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    label: string;
    active: boolean;
    fontFamily?: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
            <Ionicons name={active ? icon : iconOutline} size={24} color={active ? PRIMARY : "#b0c4c2"} />
            <Text style={[styles.navLabel, { fontFamily, color: active ? PRIMARY : "#b0c4c2" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#f5f7f5" },

    // Header
    headerGradient: {},
    headerSafe: { paddingBottom: 24 },
    headerTopRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 14 },
    headerTitle: { fontSize: 26, color: "#ffffff", fontWeight: "700", marginBottom: 6, lineHeight: 30 },
    headerSubtitle: { fontSize: 14, color: "#a8dac8", lineHeight: 20 },
    logoCircle: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
    logoHeader: { width: 48, height: 48 },

    // Scroll
    scrollBody: { flex: 1, backgroundColor: "#f5f7f5" },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
    sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1a2e26", marginBottom: 12, marginTop: 4 },

    // Card principal
    mainCard: {
        backgroundColor: "#fff", borderRadius: 18, padding: 16,
        flexDirection: "row", gap: 14, marginBottom: 20,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
    },
    ilustracaoWrap: { width: 110, flexShrink: 0 },
    ilustracaoGrad: { flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingVertical: 14, minHeight: 120 },
    ilustracaoIconsRow: { flexDirection: "row", gap: 10 },
    ilustracaoIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    mainCardContent: { flex: 1 },
    mainCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    mainCardIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#e6f5ef", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    mainCardTitle: { fontSize: 17, fontWeight: "700", color: "#1a2e26", lineHeight: 22, flex: 1 },
    mainCardDesc: { fontSize: 13, color: TEXT_MUTED, lineHeight: 18, marginBottom: 14 },
    iniciarBtn: { flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY, borderRadius: 24, paddingVertical: 10, paddingHorizontal: 18, alignSelf: "flex-start", gap: 4 },
    iniciarBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },

    // Learn list
    learnCard: {
        backgroundColor: "#fff", borderRadius: 18, padding: 4, marginBottom: 16,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    learnItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    learnItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    learnIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    learnTitle: { fontSize: 14, fontWeight: "700", color: "#1a2e26", marginBottom: 2 },
    learnDesc: { fontSize: 12, color: TEXT_MUTED, lineHeight: 16 },

    // Recomendação
    recomCard: {
        backgroundColor: "#edf6f0", borderRadius: 18, padding: 16,
        flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 20,
        borderWidth: 1, borderColor: "#c6e8d4", overflow: "hidden",
    },
    recomIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#c6e8d4", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    recomTitle: { fontSize: 14, fontWeight: "700", color: "#0d4a3e", marginBottom: 6 },
    recomBody: { fontSize: 13, color: "#2a7a5c", lineHeight: 19 },
    recomDecor: { position: "absolute", right: -6, bottom: -6 },

    // FAQ
    faqHeaderRow: {
        flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12,
    },
    faqHeaderIconCircle: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "#e6f5ef", alignItems: "center", justifyContent: "center",
    },
    faqCard: {
        backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", marginBottom: 14,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    faqItem: { paddingHorizontal: 16 },
    faqItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    faqRow: {
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingVertical: 15,
    },
    faqDot: {
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: "#d0e8df", flexShrink: 0,
    },
    faqDotActive: { backgroundColor: TEAL_MED },
    faqQuestion: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },
    faqAnswerWrap: {
        paddingBottom: 14, paddingLeft: 17,
    },
    faqAnswer: {
        fontSize: 13, color: TEXT_MUTED, lineHeight: 20,
    },

    // Progresso
    progressCard: {
        backgroundColor: "#fff", borderRadius: 18, padding: 16,
        flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14,
        borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    progressCircleWrap: { flexShrink: 0 },
    progressCircleOuter: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: "#d0e8df", alignItems: "center", justifyContent: "center" },
    progressCircleInner: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f5f7f5" },
    progressTitle: { fontSize: 15, fontWeight: "700", color: "#1a2e26", marginBottom: 3 },
    progressGuia: { fontSize: 13, color: TEXT_MUTED, marginBottom: 5 },
    progressStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    progressDotGray: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#b0c4c2" },
    progressStatusText: { fontSize: 12, color: TEXT_MUTED },

    // Navbar
    navWrapper: {
        backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
        shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07, shadowRadius: 10, elevation: 12,
    },
    navBar: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 4 : 10, paddingHorizontal: 8,
    },
    navItem: { width: "20%", alignItems: "center", justifyContent: "center", paddingVertical: 4 },
    navLabel: { fontSize: 11, marginTop: 3, letterSpacing: 0.1 },
    fabSpacer: { width: "20%", alignItems: "center", justifyContent: "center" },
    fab: { width: 56, height: 56, borderRadius: 28, marginTop: -22, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
    fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },

    // ── Modais compartilhados ──────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },

    // Guia completo
    guideCard: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: SCREEN_H * 0.88,
        overflow: "hidden",
        shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
    },
    guideHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
    guideHeaderLabel: { fontSize: 15, color: "#fff", fontWeight: "700" },
    guideHeaderStep: { fontSize: 12, color: "#a8dac8", marginTop: 2 },
    guideDotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 14, paddingBottom: 6 },
    guideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#dce8e5" },
    guideDotActive: { width: 22, backgroundColor: TEAL_MED },
    guideScrollBody: { flexGrow: 0 },
    guideScrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    guideStepHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    guideStepIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    guideStepTitle: { fontSize: 19, fontWeight: "700", color: "#1a2e26", flex: 1, lineHeight: 24 },
    guideIntro: { fontSize: 14, color: TEXT_MUTED, lineHeight: 21, marginBottom: 18 },
    guideSection: { marginBottom: 16 },
    guideSectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    guideSectionTitle: { fontSize: 14, fontWeight: "700", color: "#1a2e26" },
    guideHowItem: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
    guideHowNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#e6f5ef", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
    guideHowNumberText: { fontSize: 11, fontWeight: "700", color: TEAL_MED },
    guideHowText: { fontSize: 13, color: "#2a3d36", lineHeight: 19, flex: 1 },
    guideReferenceBox: { backgroundColor: "#eef4ff", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#d0e0f8" },
    guideReferenceTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    guideReferenceTitle: { fontSize: 13, fontWeight: "700", color: BLUE_ACTION },
    guideReferenceText: { fontSize: 13, color: "#2a3d6a", lineHeight: 19 },
    guideTipBox: { backgroundColor: "#fff8f0", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderColor: "#ede0cc" },
    guideTipText: { fontSize: 13, color: "#7a4a1a", lineHeight: 19, flex: 1 },
    guideBtnsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, gap: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
    guideBtnBack: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: TEAL_MED, borderRadius: 50, paddingVertical: 12 },
    guideBtnBackText: { fontSize: 14, color: TEAL_MED, fontWeight: "600" },
    guideBtnNext: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: TEAL_MED, borderRadius: 50, paddingVertical: 12, gap: 4 },
    guideBtnFinish: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY, borderRadius: 50, paddingVertical: 12, gap: 4 },
    guideBtnNextText: { fontSize: 14, color: "#fff", fontWeight: "700" },

    // Modal parâmetro
    paramCard: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: SCREEN_H * 0.85,
        overflow: "hidden",
        shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
    },
    paramHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
    paramHeaderIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    paramHeaderTitle: { flex: 1, fontSize: 16, color: "#fff", fontWeight: "700" },
    paramScrollBody: { flexGrow: 0 },
    paramScrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
    paramGuideBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: TEAL_MED, borderRadius: 24, paddingVertical: 13, marginTop: 8 },
    paramGuideBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },
});