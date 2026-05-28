# 📊 Script de População de Dados de Teste

Este script popula as coleções `coletaSimples` e `coletaCompleta` com dados de teste para demonstração dos gráficos.

## � Pré-requisito: Credenciais do Firebase

Este script requer acesso às credenciais do Firebase. Você tem duas opções:

### Opção 1: Arquivo Local (Recomendado para Desenvolvimento)

1. Abra o [Firebase Console](https://console.firebase.google.com)
2. Vá para **Project Settings** (engrenagem no topo)
3. Clique em **Service Accounts**
4. Clique em **Generate New Private Key**
5. Salve o arquivo JSON baixado como `serviceAccountKey.json`
6. Coloque-o na pasta: `AquaSense/backend/src/serviceAccountKey.json`

### Opção 2: Variável de Ambiente (Para CI/CD e Produção)

1. Copie o conteúdo do JSON das credenciais
2. Configure a variável de ambiente:
```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```
3. Execute o script

## 🚀 Como Executar

### Pré-requisitos
- ✅ Credenciais do Firebase configuradas (veja acima)
- ✅ Estar na pasta `backend`
- ✅ Conexão com a internet

### Executar o Script

```bash
cd AquaSense/backend
npm run populate-test-data
```

## 📊 Dados Gerados

- **Período**: Últimos 100 dias (desde 100 dias atrás até hoje)
- **Amostras por dia**: 1-5 amostras aleatórias
- **Atributos**: 
  - `data`: timestamp da amostra
  - `nivelAlerta`: 1-4 (distribuição realista)

### Distribuição de Níveis de Alerta
- 🟢 **Boa** (1): 50%
- 🟡 **Normal** (2): 30%
- 🟠 **Atenção** (3): 15%
- 🔴 **Crítico** (4): 5%

## ✅ Resultado Esperado

```
==================================================
🚀 Iniciando população de dados de teste...
==================================================

📅 Gerando dados para os últimos 101 dias...

  [████████████████████] 101/101 dias - ~500 amostras

==================================================
✅ Dados de teste criados com sucesso!
==================================================

📊 Resumo:
   📈 Amostras Simples: ~250
   📊 Amostras Completas: ~250
   📅 Período: últimos 101 dias

📋 Distribuição de Níveis de Alerta:
   🟢 Boa (1):       ~125 amostras
   🟡 Normal (2):    ~150 amostras
   🟠 Atenção (3):   ~75 amostras
   🔴 Crítico (4):   ~50 amostras

🎉 Os gráficos devem agora exibir dados de teste!
   Teste os filtros de 30, 60 e 90 dias no aplicativo!
```

## 📱 Visualizar os Dados

Após executar o script com sucesso:

1. Inicie o app Expo:
   ```bash
   cd AquaSense
   npx expo start
   ```

2. Abra no seu celular/emulador

3. Faça login como um **gestor**

4. Navegue para **Home Manager**

5. Vá à seção **Panorama da Região**

6. Teste os filtros de 30, 60 e 90 dias

7. Observe os gráficos com dados realistas! 📈

## 🧹 Limpar Dados (Opcional)

Se quiser apagar os dados e gerar novos:

### Via Firebase Console
1. Abra o [Firestore Database](https://console.firebase.google.com)
2. Selecione seu projeto
3. Para cada coleção:
   - Clique nos 3 pontos ao lado de `coletaSimples`
   - Selecione **Delete collection**
   - Confirme

### Depois, execute novamente:
```bash
npm run populate-test-data
```

## ❌ Troubleshooting

### Erro: "Credenciais não encontradas"
- [ ] Verifique se o arquivo `serviceAccountKey.json` está em `backend/src/`
- [ ] Ou configure a variável `FIREBASE_SERVICE_ACCOUNT_JSON`

### Erro: "Missing or insufficient permissions"
- [ ] Verifique as Security Rules do Firestore
- [ ] Certifique-se que seu projeto está configurado corretamente
- [ ] Teste as rules:
  ```javascript
  match /coletaSimples/{document=**} {
    allow read, write: if request.auth != null;
  }
  match /coletaCompleta/{document=**} {
    allow read, write: if request.auth != null;
  }
  ```

### Script pode apresentar lentidão
- [ ] É normal! Com 100+ dias de dados, pode levar 30-60 segundos
- [ ] Aguarde até o término

---

