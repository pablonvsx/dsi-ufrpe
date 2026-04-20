import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    StatusBar,
    Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Questrial_400Regular } from "@expo-google-fonts/questrial";
import MapView, { Marker, Circle } from "react-native-maps";
import * as Location from "expo-location";

import { salvarPontoDeUso } from "@/services/firestore/water_bodies";
import { obterContextoGeografico } from "@/services/geoService";
import { PontoDeUso, TipoUsoAgua } from "@/types/water_bodies";

const TIPOS_USO_AGUA: TipoUsoAgua[] = [
    "Abastecimento Humano",
    "Irrigação",
    "Dessedentação Animal",
    "Pesca",
    "Lazer / Balneabilidade",
    "Lançamento de Efluentes",
];

type FrequenciaUso = NonNullable<PontoDeUso["frequenciaUso"]>;

const FREQUENCIAS_USO: FrequenciaUso[] = [
    "Diária",
    "Semanal",
    "Mensal",
    "Apenas na Seca",
    "Apenas na Chuva",
];

const DEFAULT_REGION = {
    latitude: -8.0476,
    longitude: -34.8770,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
};

interface FormErrors {
    tiposDeUso?: string;
    latitude?: string;
    longitude?: string;
}

interface FormData {
    tiposDeUso: TipoUsoAgua[];
    nomeLocalPopular: string;
    nomeCorpoHidricoReferencia: string;
    frequenciaUso: FrequenciaUso | "";
    comentario: string;
    latitude: string;
    longitude: string;
    municipio: string;
}

export default function RegisterPou() {
    const [formData, setFormData] = useState<FormData>({
        tiposDeUso: [],
        nomeLocalPopular: "",
        nomeCorpoHidricoReferencia: "",
        frequenciaUso: "",
        comentario: "",
        latitude: "",
        longitude: "",
        municipio: "",
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);
    const [tipoUsoModalVisible, setTipoUsoModalVisible] = useState(false);
    const [frequenciaModalVisible, setFrequenciaModalVisible] = useState(false);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);

    const latitudeRef = useRef<TextInput>(null);
    const longitudeRef = useRef<TextInput>(null);
    const mapViewRef = useRef<MapView>(null);

    const [fontsLoaded] = useFonts({ Questrial_400Regular });
    const questrial = fontsLoaded ? "Questrial_400Regular" : undefined;

    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    console.warn("Permissão de localização negada");
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                const { latitude, longitude } = location.coords;
                const contextoGeo = obterContextoGeografico(latitude, longitude);

                setUserLocation({ latitude, longitude });
                setMapRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                });

                setFormData((prev) => ({
                    ...prev,
                    municipio: contextoGeo.municipio,
                }));
            } catch (error) {
                console.warn("Erro ao obter localização inicial:", error);
            }
        })();
    }, []);

    useEffect(() => {
        if (mapModalVisible && userLocation && mapViewRef.current) {
            mapViewRef.current.animateToRegion(
                {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                },
                1000
            );
        }
    }, [mapModalVisible, userLocation]);

    async function handleGetUserLocation() {
        setGettingLocation(true);
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const { latitude, longitude } = location.coords;
            const contextoGeo = obterContextoGeografico(latitude, longitude);

            setUserLocation({ latitude, longitude });
            setFormData((prev) => ({
                ...prev,
                latitude: latitude.toFixed(6),
                longitude: longitude.toFixed(6),
                municipio: contextoGeo.municipio,
            }));

            setMapRegion({
                latitude,
                longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            });

            setErrors((prev) => ({
                ...prev,
                latitude: undefined,
                longitude: undefined,
            }));

            Alert.alert("Sucesso", `Localização obtida: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch (error: any) {
            console.error("Erro ao obter localização:", error);
            Alert.alert("Erro", "Não foi possível obter sua localização. Ative o GPS.");
        } finally {
            setGettingLocation(false);
        }
    }

    function handleConfirmMapLocation() {
        const { latitude, longitude } = mapRegion;
        const contextoGeo = obterContextoGeografico(latitude, longitude);

        setFormData((prev) => ({
            ...prev,
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            municipio: contextoGeo.municipio,
        }));

        setErrors((prev) => ({
            ...prev,
            latitude: undefined,
            longitude: undefined,
        }));

        setMapModalVisible(false);
    }

    function validateField(field: keyof FormErrors): string | null {
        switch (field) {
            case "tiposDeUso":
                return formData.tiposDeUso.length === 0 ? "Selecione pelo menos um tipo de uso" : null;
            case "latitude": {
                const lat = parseFloat(formData.latitude);
                if (formData.latitude.trim() === "") return "Latitude é obrigatória";
                if (isNaN(lat) || lat < -90 || lat > 90) return "Latitude inválida (-90 a 90)";
                return null;
            }
            case "longitude": {
                const lon = parseFloat(formData.longitude);
                if (formData.longitude.trim() === "") return "Longitude é obrigatória";
                if (isNaN(lon) || lon < -180 || lon > 180) return "Longitude inválida (-180 a 180)";
                return null;
            }
            default:
                return null;
        }
    }

    function handleBlur(field: keyof FormErrors) {
        const error = validateField(field);
        setErrors((prev) => ({ ...prev, [field]: error ?? undefined }));
    }

    function validateAll(): boolean {
        const newErrors: FormErrors = {
            tiposDeUso: validateField("tiposDeUso") ?? undefined,
            latitude: validateField("latitude") ?? undefined,
            longitude: validateField("longitude") ?? undefined,
        };
        setErrors(newErrors);
        return !Object.values(newErrors).some(Boolean);
    }

    function toggleTipoDeUso(tipo: TipoUsoAgua) {
        setFormData((prev) => {
            const tipos = prev.tiposDeUso.includes(tipo)
                ? prev.tiposDeUso.filter((item) => item !== tipo)
                : [...prev.tiposDeUso, tipo];
            return { ...prev, tiposDeUso: tipos };
        });

        if (errors.tiposDeUso) {
            setErrors((prev) => ({ ...prev, tiposDeUso: undefined }));
        }
    }

    async function handleRegister() {
        if (!validateAll()) return;

        setLoading(true);
        try {
            const latitude = parseFloat(formData.latitude);
            const longitude = parseFloat(formData.longitude);
            const contextoGeo = obterContextoGeografico(latitude, longitude);

            const pontoDeUso: Omit<PontoDeUso, "id" | "dataCriacao"> = {
                tipoDeUso: formData.tiposDeUso,
                latitude,
                longitude,
                bioma: contextoGeo.bioma,
                macroRH: contextoGeo.macroRH,
                mesoRH: contextoGeo.mesoRH,
                microRH: contextoGeo.microRH,
                municipio: formData.municipio || contextoGeo.municipio,
                cadastroValido: false,
                criadoPor: "anonymous",
            };

            const nomeLocalPopular = formData.nomeLocalPopular.trim();
            if (nomeLocalPopular) {
                pontoDeUso.nomeLocalPopular = nomeLocalPopular;
            }

            const nomeCorpoHidricoReferencia = formData.nomeCorpoHidricoReferencia.trim();
            if (nomeCorpoHidricoReferencia) {
                pontoDeUso.nomeCorpoHidricoReferencia = nomeCorpoHidricoReferencia;
            }

            if (formData.frequenciaUso) {
                pontoDeUso.frequenciaUso = formData.frequenciaUso;
            }

            const comentario = formData.comentario.trim();
            if (comentario) {
                pontoDeUso.comentario = comentario;
            }

            const id = await salvarPontoDeUso(pontoDeUso);

            Alert.alert(
                "Ponto de uso cadastrado!",
                `O ponto de uso foi cadastrado com sucesso!\n\nID: ${id}`,
                [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
            );
        } catch (err: any) {
            console.error("ERRO:", err);
            Alert.alert(
                "Erro no cadastro",
                `${err?.message ?? "Erro desconhecido ao cadastrar ponto de uso"}`
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient
                colors={["#004d48", "#1a8c80", "#3ff3e7"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <StatusBar
                    barStyle="light-content"
                    translucent
                    backgroundColor="transparent"
                />

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={[styles.title, { fontFamily: questrial }]}>Cadastrar Ponto de Uso</Text>

                        <View style={styles.formWrapper}>
                            <FieldLabel label="Localização do ponto de uso:" fontFamily={questrial} />

                            <View style={styles.locationButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.locationButton, styles.buttonPrimary]}
                                    onPress={handleGetUserLocation}
                                    activeOpacity={0.85}
                                    disabled={gettingLocation}
                                >
                                    {gettingLocation ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="location" size={18} color="#FFFFFF" />
                                            <Text style={[styles.locationButtonText, { fontFamily: questrial }]}>Meu Local</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.locationButton, styles.buttonSecondary]}
                                    onPress={() => setMapModalVisible(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="map" size={18} color="#FFFFFF" />
                                    <Text style={[styles.locationButtonText, { fontFamily: questrial }]}>Usar Mapa</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.coordinatesRow}>
                                <View style={styles.coordinateInputContainer}>
                                    <FieldLabel label="Latitude:" fontFamily={questrial} />
                                    <TextInput
                                        ref={latitudeRef}
                                        style={[
                                            styles.input,
                                            styles.coordinateInput,
                                            { fontFamily: questrial },
                                            errors.latitude ? styles.inputError : null,
                                        ]}
                                        placeholder="Ex: -8.0476"
                                        placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                        value={formData.latitude}
                                        onChangeText={(text) => {
                                            setFormData((prev) => ({ ...prev, latitude: text }));
                                            if (errors.latitude) {
                                                setErrors((prev) => ({ ...prev, latitude: undefined }));
                                            }
                                        }}
                                        onBlur={() => handleBlur("latitude")}
                                        keyboardType="decimal-pad"
                                        returnKeyType="next"
                                        onSubmitEditing={() => longitudeRef.current?.focus()}
                                    />
                                    <ErrorText message={errors.latitude} fontFamily={questrial} />
                                </View>

                                <View style={styles.coordinateInputContainer}>
                                    <FieldLabel label="Longitude:" fontFamily={questrial} />
                                    <TextInput
                                        ref={longitudeRef}
                                        style={[
                                            styles.input,
                                            styles.coordinateInput,
                                            { fontFamily: questrial },
                                            errors.longitude ? styles.inputError : null,
                                        ]}
                                        placeholder="Ex: -34.8770"
                                        placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                        value={formData.longitude}
                                        onChangeText={(text) => {
                                            setFormData((prev) => ({ ...prev, longitude: text }));
                                            if (errors.longitude) {
                                                setErrors((prev) => ({ ...prev, longitude: undefined }));
                                            }
                                        }}
                                        onBlur={() => handleBlur("longitude")}
                                        keyboardType="decimal-pad"
                                        returnKeyType="done"
                                    />
                                    <ErrorText message={errors.longitude} fontFamily={questrial} />
                                </View>
                            </View>

                            <FieldLabel label="Município:" fontFamily={questrial} />
                            <View style={[styles.input, styles.municipioField]}>
                                <Text style={[styles.municipioText, { fontFamily: questrial }]}>
                                    {formData.municipio || "Será preenchido automaticamente"}
                                </Text>
                            </View>

                            <FieldLabel label="Tipo de uso da água:" fontFamily={questrial} />
                            <TouchableOpacity
                                style={[
                                    styles.input,
                                    styles.selectRow,
                                    errors.tiposDeUso ? styles.inputError : null,
                                ]}
                                onPress={() => setTipoUsoModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.selectText,
                                        formData.tiposDeUso.length === 0 && styles.placeholderText,
                                        { fontFamily: questrial },
                                    ]}
                                >
                                    {formData.tiposDeUso.length === 0
                                        ? "Selecione tipos de uso..."
                                        : `${formData.tiposDeUso.length} selecionado(s)`}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <ErrorText message={errors.tiposDeUso} fontFamily={questrial} />

                            <FieldLabel label="Nome local popular (opcional):" fontFamily={questrial} />
                            <TextInput
                                style={[styles.input, { fontFamily: questrial }]}
                                placeholder="Ex: Prainha do Rio"
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={formData.nomeLocalPopular}
                                onChangeText={(text) =>
                                    setFormData((prev) => ({ ...prev, nomeLocalPopular: text }))
                                }
                                maxLength={100}
                            />

                            <FieldLabel label="Corpo hídrico de referência (opcional):" fontFamily={questrial} />
                            <TextInput
                                style={[styles.input, { fontFamily: questrial }]}
                                placeholder="Ex: Rio Capibaribe"
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={formData.nomeCorpoHidricoReferencia}
                                onChangeText={(text) =>
                                    setFormData((prev) => ({ ...prev, nomeCorpoHidricoReferencia: text }))
                                }
                                maxLength={120}
                            />

                            <FieldLabel label="Frequência de uso (opcional):" fontFamily={questrial} />
                            <TouchableOpacity
                                style={[styles.input, styles.selectRow]}
                                onPress={() => setFrequenciaModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.selectText,
                                        !formData.frequenciaUso && styles.placeholderText,
                                        { fontFamily: questrial },
                                    ]}
                                >
                                    {formData.frequenciaUso || "Selecione uma frequência..."}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>

                            <FieldLabel label="Comentário (opcional):" fontFamily={questrial} />
                            <TextInput
                                style={[styles.input, styles.descricaoInput, { fontFamily: questrial }]}
                                placeholder="Adicione observações sobre o ponto de uso..."
                                placeholderTextColor="rgba(107, 122, 122, 0.6)"
                                value={formData.comentario}
                                onChangeText={(text) => setFormData((prev) => ({ ...prev, comentario: text }))}
                                maxLength={300}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleRegister}
                                activeOpacity={0.85}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#004d48" />
                                ) : (
                                    <Text style={[styles.buttonText, { fontFamily: questrial }]}>CADASTRAR PONTO DE USO</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                <Modal
                    visible={tipoUsoModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setTipoUsoModalVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setTipoUsoModalVisible(false)}
                    >
                        <Pressable style={styles.cityModal} onPress={(e) => e.stopPropagation()}>
                            <Text style={[styles.cityModalTitle, { fontFamily: questrial }]}>Selecione os tipos de uso</Text>
                            <View style={styles.modalDivider} />
                            <FlatList
                                data={TIPOS_USO_AGUA}
                                keyExtractor={(item) => item}
                                showsVerticalScrollIndicator
                                style={styles.cityList}
                                nestedScrollEnabled
                                scrollEnabled
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.cityItem}
                                        onPress={() => toggleTipoDeUso(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.checkboxContainer}>
                                            <View
                                                style={[
                                                    styles.checkboxUso,
                                                    formData.tiposDeUso.includes(item) && styles.checkboxUsoChecked,
                                                ]}
                                            >
                                                {formData.tiposDeUso.includes(item) && (
                                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                                )}
                                            </View>
                                            <Text style={[styles.cityItemText, { fontFamily: questrial }]}> 
                                                {item}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.citySeparator} />}
                            />
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setTipoUsoModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>Concluir</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                <Modal
                    visible={frequenciaModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setFrequenciaModalVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setFrequenciaModalVisible(false)}
                    >
                        <Pressable style={styles.cityModal} onPress={(e) => e.stopPropagation()}>
                            <Text style={[styles.cityModalTitle, { fontFamily: questrial }]}>Selecione a frequência</Text>
                            <View style={styles.modalDivider} />
                            <FlatList
                                data={FREQUENCIAS_USO}
                                keyExtractor={(item) => item}
                                showsVerticalScrollIndicator
                                style={styles.cityList}
                                nestedScrollEnabled
                                scrollEnabled
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.cityItem,
                                            formData.frequenciaUso === item && styles.selectedItem,
                                        ]}
                                        onPress={() => {
                                            setFormData((prev) => ({ ...prev, frequenciaUso: item }));
                                            setFrequenciaModalVisible(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.cityItemText,
                                                formData.frequenciaUso === item && styles.selectedItemText,
                                                { fontFamily: questrial },
                                            ]}
                                        >
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.citySeparator} />}
                            />
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => {
                                    setFormData((prev) => ({ ...prev, frequenciaUso: "" }));
                                    setFrequenciaModalVisible(false);
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalButtonText, { fontFamily: questrial }]}>Limpar seleção</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                <Modal
                    visible={mapModalVisible}
                    transparent={false}
                    animationType="slide"
                    onRequestClose={() => setMapModalVisible(false)}
                >
                    <View style={styles.mapContainer}>
                        <View style={styles.mapHeader}>
                            <TouchableOpacity
                                onPress={() => setMapModalVisible(false)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={[styles.mapHeaderTitle, { fontFamily: questrial }]}>Selecione o Local</Text>
                            <View style={{ width: 28 }} />
                        </View>

                        <MapView
                            ref={mapViewRef}
                            style={styles.map}
                            initialRegion={mapRegion}
                            onRegionChange={setMapRegion}
                            provider="google"
                            mapType="satellite"
                        >
                            {userLocation && (
                                <>
                                    <Circle
                                        center={{
                                            latitude: userLocation.latitude,
                                            longitude: userLocation.longitude,
                                        }}
                                        radius={50}
                                        fillColor="rgba(66, 133, 244, 0.15)"
                                        strokeColor="rgba(66, 133, 244, 0.3)"
                                        strokeWidth={2}
                                    />
                                    <Circle
                                        center={{
                                            latitude: userLocation.latitude,
                                            longitude: userLocation.longitude,
                                        }}
                                        radius={10}
                                        fillColor="#4285F4"
                                        strokeColor="#FFFFFF"
                                        strokeWidth={3}
                                    />
                                </>
                            )}

                            <Marker
                                coordinate={{
                                    latitude: mapRegion.latitude,
                                    longitude: mapRegion.longitude,
                                }}
                                title="Localização Selecionada"
                                description="Arraste o mapa para ajustar"
                                pinColor="red"
                            />
                        </MapView>

                        <View style={styles.mapCenterPin}>
                            <Ionicons name="location" size={48} color="#ff4444" />
                        </View>

                        {userLocation && (
                            <TouchableOpacity
                                style={styles.myLocationButton}
                                onPress={() => {
                                    mapViewRef.current?.animateToRegion(
                                        {
                                            latitude: userLocation.latitude,
                                            longitude: userLocation.longitude,
                                            latitudeDelta: 0.015,
                                            longitudeDelta: 0.015,
                                        },
                                        1000
                                    );
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="locate" size={24} color="#004d48" />
                            </TouchableOpacity>
                        )}

                        <View style={styles.mapButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.mapButton, styles.mapButtonCancel]}
                                onPress={() => setMapModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.mapButtonText, { fontFamily: questrial }]}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.mapButton, styles.mapButtonConfirm]}
                                onPress={handleConfirmMapLocation}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                                <Text
                                    style={[
                                        styles.mapButtonText,
                                        styles.mapButtonTextConfirm,
                                        { fontFamily: questrial },
                                    ]}
                                >
                                    Confirmar
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.mapCoordinatesBox}>
                            <Text style={[styles.mapCoordinatesText, { fontFamily: questrial }]}>Lat: {mapRegion.latitude.toFixed(6)}</Text>
                            <Text style={[styles.mapCoordinatesText, { fontFamily: questrial }]}>Lon: {mapRegion.longitude.toFixed(6)}</Text>
                        </View>
                    </View>
                </Modal>
            </LinearGradient>
        </>
    );
}

function FieldLabel({
    label,
    fontFamily,
}: {
    label: string;
    fontFamily?: string;
}) {
    return <Text style={[styles.fieldLabel, { fontFamily }]}>{label}</Text>;
}

function ErrorText({
    message,
    fontFamily,
}: {
    message?: string;
    fontFamily?: string;
}) {
    if (!message) return null;
    return <Text style={[styles.errorText, { fontFamily }]}>{message}</Text>;
}

const PRIMARY = "#004d48";
const BORDER_RADIUS = 50;

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gradient: { flex: 1 },

    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 36,
        paddingTop: Platform.OS === "android" ? 16 : 20,
        paddingBottom: 40,
        alignItems: "center",
    },

    title: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 0.5,
        textAlign: "left",
        marginBottom: 20,
        marginTop: 30,
        lineHeight: 24,
        alignSelf: "flex-start",
    },

    formWrapper: {
        width: "100%",
        marginTop: 8,
    },

    fieldLabel: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 5,
        marginLeft: 6,
        letterSpacing: 0.3,
    },

    input: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 50,
        paddingHorizontal: 20,
        fontSize: 14,
        color: "#6b7a7a",
        borderWidth: 1.5,
        borderColor: "transparent",
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },

    inputError: {
        borderColor: "#ff6b6b",
        backgroundColor: "rgba(255, 255, 255, 0.92)",
    },

    descricaoInput: {
        height: 100,
        paddingVertical: 12,
    },

    coordinatesRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 4,
    },

    coordinateInputContainer: {
        flex: 1,
    },

    coordinateInput: {
        height: 50,
    },

    municipioField: {
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        justifyContent: "center",
        marginBottom: 10,
    },

    municipioText: {
        fontSize: 14,
        color: "#6b7a7a",
        fontWeight: "500",
    },

    errorText: {
        color: "#ffe0e0",
        fontSize: 11,
        marginLeft: 8,
        marginBottom: 6,
        marginTop: -5,
    },

    selectRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingRight: 16,
    },

    selectText: {
        fontSize: 14,
        color: "#6b7a7a",
        flex: 1,
    },

    placeholderText: {
        color: "rgba(107, 122, 122, 0.6)",
    },

    button: {
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: BORDER_RADIUS,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },

    buttonText: {
        color: "#6b7a7a",
        fontSize: 15,
        fontWeight: "700",
        letterSpacing: 2,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
    },

    modalDivider: {
        height: 1,
        backgroundColor: "#e0f2f1",
        marginBottom: 16,
    },

    modalButton: {
        backgroundColor: PRIMARY,
        borderRadius: BORDER_RADIUS,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
        marginHorizontal: 20,
        marginBottom: 18,
    },

    modalButtonText: {
        fontSize: 15,
        color: "#FFFFFF",
        fontWeight: "600",
        letterSpacing: 0.3,
    },

    cityModal: {
        backgroundColor: "#fff",
        borderRadius: 20,
        width: "100%",
        maxHeight: "72%",
        paddingTop: 22,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 12,
    },

    cityModalTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: PRIMARY,
        textAlign: "center",
        marginBottom: 14,
        paddingHorizontal: 20,
    },

    cityList: {
        flexGrow: 0,
        maxHeight: 280,
        paddingHorizontal: 0,
    },

    cityItem: {
        paddingVertical: 14,
        paddingHorizontal: 22,
    },

    selectedItem: {
        backgroundColor: "#f0f8f7",
    },

    cityItemText: {
        fontSize: 14,
        color: "#555",
    },

    selectedItemText: {
        color: PRIMARY,
        fontWeight: "600",
    },

    citySeparator: {
        height: 1,
        backgroundColor: "#f0f0f0",
    },

    modalCloseButton: {
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 18,
        backgroundColor: PRIMARY,
        borderRadius: BORDER_RADIUS,
        paddingVertical: 13,
        alignItems: "center",
    },

    modalCloseButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
        letterSpacing: 0.3,
    },

    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },

    checkboxUso: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: PRIMARY,
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },

    checkboxUsoChecked: {
        backgroundColor: PRIMARY,
        borderColor: PRIMARY,
    },

    locationButtonsContainer: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 14,
    },

    locationButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: BORDER_RADIUS,
        paddingVertical: 12,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },

    buttonPrimary: {
        backgroundColor: "#00a896",
    },

    buttonSecondary: {
        backgroundColor: "#0088aa",
    },

    locationButtonText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.5,
    },

    mapContainer: {
        flex: 1,
        backgroundColor: "#000",
    },

    mapHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: PRIMARY,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: Platform.select({ ios: 12, android: 16 }),
    },

    mapHeaderTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#FFFFFF",
        flex: 1,
        textAlign: "center",
    },

    map: {
        flex: 1,
    },

    mapCenterPin: {
        position: "absolute",
        top: "50%",
        left: "50%",
        marginTop: -24,
        marginLeft: -24,
        zIndex: 10,
    },

    mapButtonsContainer: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        flexDirection: "row",
        gap: 12,
        zIndex: 20,
    },

    mapButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    mapButtonCancel: {
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.5)",
    },

    mapButtonConfirm: {
        backgroundColor: PRIMARY,
    },

    mapButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 0.5,
    },

    mapButtonTextConfirm: {
        color: "#FFFFFF",
    },

    mapCoordinatesBox: {
        position: "absolute",
        top: 80,
        right: 16,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: PRIMARY,
        zIndex: 15,
    },

    mapCoordinatesText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "600",
        marginVertical: 2,
    },

    myLocationButton: {
        position: "absolute",
        top: 100,
        left: 16,
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: 30,
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 15,
    },
});