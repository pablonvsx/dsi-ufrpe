# ⚡ QUICK START: Nova Contribuição Ambiental

## 🚀 Comece em 5 Minutos

### Passo 1: Instale a Dependência (2 min)
```bash
cd AquaSense
npm install @react-native-community/slider@^4.5.0
```

### Passo 2: Teste a Tela (3 min)
```bash
# Abra em qualquer arquivo da app
import { useRouter } from "expo-router";

const router = useRouter();
router.push("new_environmental_contribution");
```

✅ **Pro\nto!** A tela está funcionando.

---

## 📱 Funcionalidades Principais

### 1️⃣ Selecione um Corpo Hídrico
- Toque em "Selecione um corpo hídrico..."
- Modal abre com lista completa
- Busque por nome ou município
- Toque para selecionar

### 2️⃣ Escolha o Tipo
```
⚗️ MEDIÇÃO SIMPLES
├─ pH: Botões +/- (0-14)
├─ Temperatura: Slider (15-35°C)
├─ Cor: 4 emojis (Clara → Muito turva)
└─ Odor: 3 emojis (😊 😐 😖)

----- OU -----

👁️ OBSERVAÇÃO VISUAL
├─ 🗑️  Lixo
├─ 🐟 Animais mortos
├─ 💧 Despejos
├─ ⚠️  Esgoto visível
├─ 🎨 Coloração
├─ 👃 Odor
└─ 🫧 Espuma
```

### 3️⃣ Adicione Descrição (Opcional)
- Máximo 300 caracteres
- Contador automático
- Deixe em branco se preferir

### 4️⃣ Tire Fotos (Opcional)
- Câmera 📷 ou Galeria 🖼️
- Até 5 fotos
- Máximo 5MB cada
- Preview antes de enviar

### 5️⃣ Envie
- Toque "Enviar contribuição"
- Verá ID da contribuição
- Dados salvos em Firestore
- Fotos no Supabase

---

## 🔄 Integrações Automáticas

✅ **Localização**
- Obtém coordenadas ao abrir
- Botão ↻ para atualizar
- Valida se está em Pernambuco

✅ **Firestore**
- Salva em collection `coletaSimples`
- Timestamps automáticos
- Status inicial: "pendente"

✅ **Supabase**
- Fotos em bucket `aquasense-contribuicoes`
- URLs geradas automaticamente
- Documento atualizado com URLs

✅ **Autenticação**
- Usa UID do usuário logado
- Nome do usuário no registro
- Segurança via Firebase

---

## 🎨 Design & Estilos

| Aspecto | Detalhe |
|--------|---------|
| Cor Primária | Verde escuro #004d48 |
| Gradiente | Verde → Verde claro |
| Tipografia | Questrial (quando disponível) |
| Ícones | Ionicons + Emojis |
| Cards | Sombra suave, borda clara |
| Animações | Transições suaves |

---

## 🧪 Teste Rápido

### Cenário 1: Medição Completa
```
1. Abra a tela
2. Selecione "Canal do Fragoso, Olinda - PE"
3. pH: 7.5
4. Temperatura: 25°C
5. Cor: "Levemente turva"
6. Odor: "Odor leve"
7. Descrição: "Água levemente turva mas sem odor forte"
8. Toque 3 fotos
9. Envie

Resultado: ID gerado, dados no Firestore, fotos no Supabase
```

### Cenário 2: Observação Rápida
```
1. Abra a tela
2. Selecione um corpo
3. Mude para "Observação visual"
4. Marque: Lixo + Espuma
5. Envie

Resultado: ID gerado, dados salvos
```

### Cenário 3: Validações
```
Tente enviar SEM corpo hídrico
→ Erro: "Selecione um corpo hídrico"

pH = 15
→ Erro: "pH deve estar entre 0 e 14"

Localização fora do PE
→ Erro: "Localização deve estar em Pernambuco"
```

---

## 🐛 Se Algo Não Funcionar

| Problema | Solução |
|----------|---------|
| "Cannot find module slider" | `npm install @react-native-community/slider` |
| Modal não abre | Verifique Firestore `corposHidricos` |
| Localização não funciona | Dê permissão em Settings > App |
| Fotos não salvam | Verifique Supabase RLS policies |
| Dados não salvam | Cheque console logs para erro específico |
| Formulário congela | Tente fechar e abrir novamente |

---

## 📂 Arquivos Relacionados

```
AquaSense/
├─ app/
│  └─ new_environmental_contribution.tsx  ← TELA PRINCIPAL
├─ components/
│  └─ GaleriaUpload.tsx                   ← FOTOS
├─ services/
│  ├─ firestore/
│  │  ├─ contributions.ts                 ← CRUD
│  │  └─ water_bodies.ts                  ← CORPOS
│  ├─ storage/
│  │  └─ supabaseStorage.ts               ← UPLOAD
│  └─ contributionHelper.ts               ← ORQUESTRAÇÃO
├─ types/
│  └─ contribution.ts                     ← TIPOS
└─ config/
   └─ supabase.ts                         ← CONFIG
```

---

## 🔐 Segurança & Validações

✅ **Entrada**
- Corpo hídrico obrigatório
- pH validado (0-14)
- Temperatura dentro de range (15-35°C)
- Descrição máximo 300 caracteres

✅ **Localização**
- Coordenadas validadas contra limites PE
- Falha gracefully se não disponível
- Aceita manual refresh

✅ **Armazenamento**
- Firestore com RLS rules
- Supabase com RLS policies
- Timestamps de servidor
- Audit trail via complementações

---

## 🚀 Próximas Features

Após a tela de "Nova Contribuição", implemente (em ordem):

1. **Minhas Contribuições** - Ver histórico
2. **Complementar** - Editar pendentes
3. **Validação** - Dashboard técnico
4. **Mapa** - Visualizar no mapa

---

## 📞 Suporte Rápido

### Dúvidas sobre Funcionalidade?
👉 Leia: [NEW_CONTRIBUTION_IMPLEMENTATION.md](./NEW_CONTRIBUTION_IMPLEMENTATION.md)

### Como Integrar na App?
👉 Leia: [NEW_CONTRIBUTION_NEXT_STEPS.md](./NEW_CONTRIBUTION_NEXT_STEPS.md)

### Exemplos de Código?
👉 Veja: [INTEGRATION_EXAMPLES.tsx](./INTEGRATION_EXAMPLES.tsx)

### Resumo Completo?
👉 Veja: [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)

---

## ✨ Características Destacadas

🎯 **UI/UX**
- Design limpo e intuitivo
- Feedback visual imediato
- Mensagens de erro claras
- Loading states

⚡ **Performance**
- Lazy loading do modal
- Animações otimizadas
- Sem travamentos
- Validação local rápida

🔒 **Segurança**
- Autenticação Firebase
- RLS no Firestore/Supabase
- Validação de coordenadas
- Sanitização de entrada

📱 **Compatibilidade**
- iOS + Android
- Tablets + Phones
- Portrait + Landscape
- Notch/Safe areas

---

## 🎉 Você Está Pronto!

```
✅ Tela criada
✅ Funcionalidades completas
✅ Integração pronta
✅ Documentação disponível
✅ Exemplos fornecidos

→ Instale a dependência
→ Teste em seu simulador
→ Integre à navegação
→ Comemore! 🎊
```

---

**Tempo estimado para produção**: 1-2 horas  
**Complexidade**: Média (mas tudo já está feito!)  
**Suporte**: Documentação completa disponível  

🚀 **Bora codar!**
