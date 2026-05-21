# 📱 Guia de Implementação UI - Contribuições Ambientais

Este guia explica como usar o sistema de contribuições em suas telas React Native.

## Quick Start

### Exemplo 1: Criar uma Medição Simples

```typescript
import { contributionHelper } from "@/services";
import { useAuth } from "@/contexts/auth-context";

export function TelaRegistroMedicao() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleRegistrar = async () => {
    setLoading(true);
    try {
      // Aqui você coleta dados do formulário
      const dados = {
        latitude: -8.2832,
        longitude: -35.0012,
        usuarioId: user.id,
        usuarioNome: user.name,
        tipo: "medicao" as const,
        descricao: "Medição do Rio Capibaribe",
        pH: 7.2,
        cor: "clara",
        temperatura: 26.5,
      };

      // Fotos coletas da câmera (como Blob)
      const fotos = [...]; // seus blobs aqui

      // Criar contribuição (tudo em um passo!)
      const idCriado = await contributionHelper.criarContribuicaoCompleta(
        dados,
        fotos
      );

      Alert.alert("Sucesso", `Contribuição criada: ${idCriado}`);
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput placeholder="pH" onChangeText={setPH} />
      <TextInput placeholder="Temperatura" onChangeText={setTemp} />
      <TouchableOpacity onPress={handleRegistrar} disabled={loading}>
        <Text>{loading ? "Registrando..." : "Registrar"}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## Telas Sugeridas & Implementação

### 1️⃣ Tela: Registrar Medição

**Localização**: `app/register_measurement.tsx` (ou dentro do tabs)

**Campos do Formulário**:
```typescript
interface FormMedicao {
  pH?: number;          // 0-14
  cor?: string;         // clara, ligeiramente turva, turva, muito turva
  odor?: string;        // sem cheiro, leve, forte, muito forte
  temperatura?: number; // graus celsius
  descricao: string;    // observações adicionais
}
```

**Fluxo**:
1. Obter geolocalização (usar expo-location)
2. Capturar fotos (câmera)
3. Coletar dados do formulário
4. Chamar `contributionHelper.criarContribuicaoCompleta()`
5. Mostrar resultado

**Exemplo Simplificado**:
```typescript
export function RegistroMedicao() {
  const [location, setLocation] = useState(null);
  const [pH, setPH] = useState("");
  const [temp, setTemp] = useState("");
  const [loading, setLoading] = useState(false);

  const capturarLocalizacao = async () => {
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const registrar = async () => {
    try {
      setLoading(true);
      
      await contributionHelper.criarContribuicaoCompleta({
        latitude: location.latitude,
        longitude: location.longitude,
        usuarioId: user.id,
        usuarioNome: user.name,
        tipo: "medicao",
        descricao: "Medição registrada pelo app",
        pH: parseFloat(pH),
        temperatura: parseFloat(temp),
      });

      Alert.alert("Sucesso", "Medição registrada!");
      // Navegar de volta
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Button title="📍 Obter Localização" onPress={capturarLocalizacao} />
      
      <TextInput
        placeholder="pH (0-14)"
        value={pH}
        onChangeText={setPH}
        keyboardType="decimal-pad"
      />
      
      <TextInput
        placeholder="Temperatura (°C)"
        value={temp}
        onChangeText={setTemp}
        keyboardType="decimal-pad"
      />

      <TouchableOpacity 
        style={styles.button}
        onPress={registrar}
        disabled={loading}
      >
        <Text>{loading ? "Processando..." : "Registrar Medição"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

---

### 2️⃣ Tela: Registrar Observação Visual

**Localização**: `app/register_observation.tsx`

**Campos**:
```typescript
interface FormObservacao {
  lixo: boolean;
  animaisMortos: boolean;
  despejosEsgoto: boolean;
  esgotoVisivel: boolean;
  coloracaoAnormal: boolean;
  odorAnormal: boolean;
  espumaOuResiduos: boolean;
  outrasObservacoes: string[];
}
```

**Exemplo**:
```typescript
export function RegistroObservacao() {
  const [checks, setChecks] = useState({
    lixo: false,
    animaisMortos: false,
    despejosEsgoto: false,
    esgotoVisivel: false,
    coloracaoAnormal: false,
    odorAnormal: false,
    espumaOuResiduos: false,
  });

  const [outrasObs, setOutrasObs] = useState("");

  const registrar = async () => {
    try {
      await contributionHelper.criarContribuicaoCompleta({
        latitude: location.latitude,
        longitude: location.longitude,
        usuarioId: user.id,
        usuarioNome: user.name,
        tipo: "observacao",
        descricao: "Observação visual do corpo hídrico",
        observacaoVisual: {
          ...checks,
          outrasObservacoes: outrasObs ? [outrasObs] : [],
        },
      });

      Alert.alert("Sucesso", "Observação registrada!");
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const Checkbox = ({ label, value, onToggle }) => (
    <TouchableOpacity
      style={styles.checkboxContainer}
      onPress={() => onToggle(!value)}
    >
      <View style={[styles.checkbox, value && styles.checked]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <Checkbox
        label="Lixo na água ou margem"
        value={checks.lixo}
        onToggle={(v) => setChecks({ ...checks, lixo: v })}
      />
      <Checkbox
        label="Animais mortos"
        value={checks.animaisMortos}
        onToggle={(v) => setChecks({ ...checks, animaisMortos: v })}
      />
      {/* Mais checkboxes... */}

      <TextInput
        placeholder="Outras observações"
        value={outrasObs}
        onChangeText={setOutrasObs}
        multiline
      />

      <Button title="Registrar Observação" onPress={registrar} />
    </ScrollView>
  );
}
```

---

### 3️⃣ Tela: Minhas Contribuições

**Localização**: `app/(tabs)/profile.tsx` ou nova tab `app/(tabs)/contributions.tsx`

**Função Principal**:
```typescript
export function MinhasContribuicoes() {
  const [contribuicoes, setContribuicoes] = useState<ContribuicaoAmbiental[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    carregarContribuicoes();
  }, []);

  const carregarContribuicoes = async () => {
    try {
      const minhas = await contributionHelper.obterHistoricoUsuario(user.id);
      setContribuicoes(minhas);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator />;

  return (
    <FlatList
      data={contribuicoes}
      keyExtractor={(item) => item.id!}
      renderItem={({ item }) => (
        <ContribuicaoCard
          contribuicao={item}
          onPress={() => navegarParaDetalhe(item.id)}
          onComplementar={() => navegarParaComplementar(item.id)}
          onCancelar={() => cancelar(item.id)}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>Você ainda não tem contribuições</Text>
      }
    />
  );
}

// Componente Card
function ContribuicaoCard({ contribuicao, onPress, onComplementar, onCancelar }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "validada":
        return "#10b981"; // green
      case "pendente":
        return "#f59e0b"; // amber
      case "invalida":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.tipo}>
          {contribuicao.tipo === "medicao" ? "💧 Medição" : "👁️ Observação"}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(contribuicao.status) },
          ]}
        >
          <Text style={styles.statusText}>{contribuicao.status}</Text>
        </View>
      </View>

      <Text style={styles.descricao}>{contribuicao.descricao}</Text>

      <Text style={styles.meta}>
        📍 {contribuicao.ambientalInfo.municipio} • {" "}
        {new Date(contribuicao.dataCriacao).toLocaleDateString("pt-BR")}
      </Text>

      {contribuicao.tipo === "medicao" && (
        <View style={styles.dados}>
          {contribuicao.pH && <Text>pH: {contribuicao.pH}</Text>}
          {contribuicao.temperatura && (
            <Text>Temp: {contribuicao.temperatura}°C</Text>
          )}
        </View>
      )}

      {contribuicao.fotos.length > 0 && (
        <Text style={styles.fotos}>📷 {contribuicao.fotos.length} foto(s)</Text>
      )}

      <View style={styles.actions}>
        {contribuicao.status === "pendente" && (
          <>
            <Button title="Complementar" onPress={onComplementar} />
            <Button title="Cancelar" onPress={onCancelar} color="red" />
          </>
        )}
      </View>
    </Pressable>
  );
}
```

---

### 4️⃣ Tela: Complementar Contribuição

**Localização**: `app/complement_contribution.tsx`

**Função Principal**:
```typescript
export function ComplementarContribuicao({ route }) {
  const { contribuicaoId } = route.params;
  const [contribuicao, setContribuicao] = useState(null);
  const [novosPH, setNovosPH] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarContribuicao();
  }, []);

  const carregarContribuicao = async () => {
    const contrib = await contributions.obterContribuicao(contribuicaoId);
    setContribuicao(contrib);
  };

  const salvarComplementacao = async () => {
    try {
      setLoading(true);
      await contributionHelper.complementarComValidacao(
        contribuicaoId,
        {
          pH: parseFloat(novosPH) || contribuicao.pH,
          descricao: "Dados atualizados",
        },
        user.id
      );

      Alert.alert("Sucesso", "Contribuição complementada!");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      <Text style={styles.title}>Complementar Contribuição</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Descrição Original</Text>
        <Text style={styles.value}>{contribuicao?.descricao}</Text>
      </View>

      <TextInput
        placeholder="Novo pH"
        value={novosPH}
        onChangeText={setNovosPH}
        keyboardType="decimal-pad"
      />

      <Button
        title={loading ? "Salvando..." : "Salvar Complementação"}
        onPress={salvarComplementacao}
        disabled={loading}
      />
    </ScrollView>
  );
}
```

---

### 5️⃣ Tela: Painel de Validação (Técnico)

**Localização**: `app/technician_dashboard.tsx`

**Função Principal**:
```typescript
export function PainelValidacao() {
  const [pendentes, setPendentes] = useState<ContribuicaoAmbiental[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    carregarPendentes();
  }, []);

  const carregarPendentes = async () => {
    try {
      const items = await contributionHelper.obterContribuicoesPendentes();
      setPendentes(items);
    } finally {
      setLoading(false);
    }
  };

  const validar = async (id: string) => {
    try {
      await contributionHelper.validarContribuicaoComSeguranca(
        id,
        user.id,
        user.name
      );
      
      Alert.alert("Sucesso", "Contribuição validada");
      carregarPendentes(); // Recarregar lista
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const invalidar = async (id: string, motivo: string) => {
    try {
      await contributionHelper.invalidarComSeguranca(
        id,
        user.id,
        user.name,
        motivo
      );
      
      Alert.alert("Sucesso", "Contribuição invalidada");
      carregarPendentes();
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  if (loading) return <ActivityIndicator />;

  return (
    <FlatList
      data={pendentes}
      keyExtractor={(item) => item.id!}
      renderItem={({ item }) => (
        <ContribuicaoReview
          contribuicao={item}
          onValidar={() => validar(item.id!)}
          onInvalidar={() => promptMotivo((motivo) => invalidar(item.id!, motivo))}
        />
      )}
      ListEmptyComponent={<Text>Nenhuma contribuição para validar</Text>}
    />
  );
}

function ContribuicaoReview({ contribuicao, onValidar, onInvalidar }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.header}>
        <Text style={styles.tipo}>
          {contribuicao.tipo === "medicao" ? "💧" : "👁️"}
        </Text>
        <Text style={styles.nome}>{contribuicao.usuarioNome}</Text>
        <Text style={styles.data}>
          {new Date(contribuicao.dataCriacao).toLocaleDateString("pt-BR")}
        </Text>
      </View>

      <Text style={styles.descricao}>{contribuicao.descricao}</Text>

      {contribuicao.tipo === "medicao" && (
        <View style={styles.measurementData}>
          <Text>🌡️ pH: {contribuicao.pH}</Text>
          <Text>🌡️ Temperatura: {contribuicao.temperatura}°C</Text>
        </View>
      )}

      {contribuicao.fotos.length > 0 && (
        <ScrollView horizontal style={styles.photoScroll}>
          {contribuicao.fotos.map((foto, idx) => (
            <Image
              key={idx}
              source={{ uri: foto }}
              style={styles.thumbnail}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Button
          title="✅ Validar"
          onPress={onValidar}
          color="#10b981"
        />
        <Button
          title="❌ Invalidar"
          onPress={onInvalidar}
          color="#ef4444"
        />
      </View>
    </View>
  );
}
```

---

## Importações Necessárias

```typescript
// Serviços
import {
  contributions,
  contributionHelper,
  storage,
  ambientalInfo,
} from "@/services";

// Tipos
import {
  ContribuicaoAmbiental,
  CreateContribuicaoDTO,
  UpdateContribuicaoDTO,
} from "@/types/contribution";

// Contexto de autenticação
import { useAuth } from "@/contexts/auth-context";

// React Native
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
```

---

## Padrões Comuns

### 1. Obter Localização

```typescript
import * as Location from "expo-location";

const obterLocalizacao = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permissão negada");
    return;
  }

  const loc = await Location.getCurrentPositionAsync({});
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  };
};
```

### 2. Capturar Foto (Câmera)

```typescript
import * as ImagePicker from "expo-image-picker";

const capturarFoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (!result.canceled) {
    // Converter URI para Blob
    const blob = await fetch(result.assets[0].uri).then((r) => r.blob());
    return blob;
  }
};
```

### 3. Mostrar Modal para Motivo

```typescript
const promptMotivo = async (callback: (motivo: string) => void) => {
  Alert.prompt(
    "Motivo da Invalidação",
    "Por que esta contribuição é inválida?",
    [
      { text: "Cancelar", onPress: () => {} },
      { text: "OK", onPress: callback },
    ],
    "plain-text"
  );
};
```

### 4. Tratamento de Erros

```typescript
const executarComTratamento = async (fn: () => Promise<void>) => {
  try {
    setLoading(true);
    await fn();
    Alert.alert("Sucesso!");
  } catch (error: any) {
    if (error.message.includes("Pernambuco")) {
      Alert.alert("Localização inválida", "Contribuição fora de PE");
    } else if (error.message.includes("permissão")) {
      Alert.alert("Sem permissão", "Verifique as permissões do app");
    } else {
      Alert.alert("Erro", error.message || "Algo deu errado");
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Checklist de Implementação

- [ ] Tela: Registrar Medição
- [ ] Tela: Registrar Observação
- [ ] Tela: Minhas Contribuições
- [ ] Tela: Complementar
- [ ] Painel: Validação (Técnico)
- [ ] Painel: Estatísticas (Gestor)
- [ ] Integração com câmera
- [ ] Integração com localização
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Validação de formulários

---

## Dúvidas Frequentes

**P: Como faço para buscar contribuições de um município específico?**
```typescript
const coletaMunicipio = await contributions.listarContribuicoes({
  municipio: "Recife",
});
```

**P: Como obtenho o histórico de complementações?**
```typescript
const contrib = await contributions.obterContribuicao(id);
console.log(contrib.complementacoes); // Array de edições
```

**P: Posso editar uma contribuição validada?**
Não, o sistema impede isso. Deve-se criar uma nova contribuição ou arquivar e recriar.

**P: Como funciona o soft delete?**
Usando `cancelarComValidacao()` ou `arquivarContribuicao()`. Os dados permanecem no banco com `status: "arquivada"`.

---

**Status**: ✅ Serviços prontos | ⏳ UI em desenvolvimento
