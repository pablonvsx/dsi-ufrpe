/**
 * Componente: Galeria de Upload de Fotos
 * Reutilizável em qualquer tela de contribuição
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { FotoUpload, useUploadFotos } from "@/hooks/useUploadFotos";

interface GaleriaUploadProps {
  contribuicaoId: string;
  maxFotos?: number;
  maxTamanhoMB?: number;
  onFotosChange?: (urls: string[]) => void;
  estilo?: any;
}

/**
 * Componente para gerenciar upload de fotos
 * 
 * Uso:
 * ```tsx
 * <GaleriaUpload
 *   contribuicaoId="contrib_123"
 *   onFotosChange={(urls) => setFotos(urls)}
 * />
 * ```
 */
export function GaleriaUpload({
  contribuicaoId,
  maxFotos = 5,
  maxTamanhoMB = 5,
  onFotosChange,
  estilo,
}: GaleriaUploadProps) {
  const {
    fotos,
    error,
    totalFotos,
    podeAdicionarMais,
    capturarFoto,
    selecionarDaGaleria,
    remover,
  } = useUploadFotos({
    contribuicaoId,
    maxFotos,
    maxTamanhoMB,
  });

  // Notificar mudanças
  React.useEffect(() => {
    onFotosChange?.(fotos.filter((f) => f.url).map((f) => f.url!));
  }, [fotos, onFotosChange]);

  return (
    <View style={[styles.container, estilo]}>
      {/* Título e contador */}
      <View style={styles.header}>
        <Text style={styles.titulo}>📷 Fotos</Text>
        <Text style={styles.contador}>
          {totalFotos}/{maxFotos}
        </Text>
      </View>

      {/* Erro */}
      {error && (
        <View style={styles.erro}>
          <MaterialIcons name="error-outline" size={20} color="#ef4444" />
          <Text style={styles.erroTexto}>{error}</Text>
        </View>
      )}

      {/* Botões de ação */}
      {podeAdicionarMais && (
        <View style={styles.botoes}>
          <TouchableOpacity
            style={[styles.botao, styles.botaoPrimario]}
            onPress={capturarFoto}
          >
            <MaterialIcons name="camera-alt" size={20} color="white" />
            <Text style={styles.botaoTexto}>Câmera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.botao, styles.botaoSecundario]}
            onPress={selecionarDaGaleria}
          >
            <MaterialIcons name="photo-library" size={20} color="white" />
            <Text style={styles.botaoTexto}>Galeria</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de fotos */}
      {fotos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollFotos}
        >
          {fotos.map((foto, idx) => (
            <FotoCard
              key={foto.uri}
              foto={foto}
              indice={idx + 1}
              onRemover={() => remover(foto.uri)}
            />
          ))}
        </ScrollView>
      )}

      {/* Estado vazio */}
      {fotos.length === 0 && (
        <View style={styles.vazio}>
          <MaterialIcons name="image" size={40} color="#d1d5db" />
          <Text style={styles.vazioTexto}>Nenhuma foto selecionada</Text>
          <Text style={styles.vazioSubtexto}>
            Adicione fotos da câmera ou galeria
          </Text>
        </View>
      )}

      {/* Informações */}
      <View style={styles.info}>
        <Text style={styles.infoTexto}>
          📏 Máx. {maxTamanhoMB}MB por foto
        </Text>
        <Text style={styles.infoTexto}>
          🖼️ Até {maxFotos} fotos
        </Text>
      </View>
    </View>
  );
}

/**
 * Card individual de foto
 */
function FotoCard({
  foto,
  indice,
  onRemover,
}: {
  foto: FotoUpload;
  indice: number;
  onRemover: () => void;
}) {
  return (
    <View style={styles.fotoCard}>
      {/* Imagem */}
      <Image source={{ uri: foto.uri }} style={styles.fotoImagem} />

      {/* Status */}
      {foto.uploading && (
        <View style={styles.uploadando}>
          <ActivityIndicator color="white" />
          <Text style={styles.uploadandoTexto}>Enviando...</Text>
        </View>
      )}

      {foto.error && (
        <View style={styles.fotoErro}>
          <MaterialIcons name="error" size={24} color="white" />
          <Text style={styles.fotoErroTexto}>Falha</Text>
        </View>
      )}

      {foto.url && !foto.uploading && (
        <View style={styles.fotoBadge}>
          <MaterialIcons name="check-circle" size={20} color="#10b981" />
        </View>
      )}

      {/* Número */}
      <View style={styles.fotoNumero}>
        <Text style={styles.fotoNumeroTexto}>{indice}</Text>
      </View>

      {/* Botão deletar */}
      <TouchableOpacity style={styles.fotoDeletar} onPress={onRemover}>
        <MaterialIcons name="close" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  titulo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },

  contador: {
    fontSize: 12,
    color: "#6b7280",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },

  erro: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  erroTexto: {
    color: "#dc2626",
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },

  botoes: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  botao: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },

  botaoPrimario: {
    backgroundColor: "#3b82f6",
  },

  botaoSecundario: {
    backgroundColor: "#8b5cf6",
  },

  botaoTexto: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },

  scrollFotos: {
    marginBottom: 12,
  },

  fotoCard: {
    position: "relative",
    marginRight: 12,
    borderRadius: 8,
    overflow: "hidden",
  },

  fotoImagem: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },

  uploadando: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  uploadandoTexto: {
    color: "white",
    fontSize: 10,
    marginTop: 4,
  },

  fotoErro: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(239, 68, 68, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },

  fotoErroTexto: {
    color: "white",
    fontSize: 10,
    marginTop: 4,
  },

  fotoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
  },

  fotoNumero: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  fotoNumeroTexto: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },

  fotoDeletar: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  vazio: {
    alignItems: "center",
    paddingVertical: 32,
  },

  vazioTexto: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
    marginTop: 8,
  },

  vazioSubtexto: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },

  info: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  infoTexto: {
    fontSize: 12,
    color: "#6b7280",
  },
});
