# Guia de Inicialização - Projeto AquaSense

Este guia mostra o passo a passo para iniciar o projeto AquaSense, partindo da pasta raiz `dsi-ufrpe`.

O projeto é composto por duas partes: 

- **Aplicativo mobile** (Expo / React Native)
- **Backend** (Node.js)

Por isso, é necessário rodar **dois terminais simultaneamente**:
- uma para o backend
- um para o aplicativo

## 1. Acesse a pasta do projeto

Partindo da raiz do respositório: 

```bash
cd AquaSense
```

## 2. Configure a versão do Node.js

O projeto utiliza o [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm) para garantir a versão correta do Node.js.

### Linux/macOS
1. Instale o NVM, se ainda não tiver:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   # Reinicie o terminal ou rode:
   export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   ```
2. Na pasta `AquaSense`, rode:
   ```bash
   nvm install 22
   nvm use 22
   ```
   Isso garante que você está usando a versão correta do Node (definida em `.nvmrc`).

### Windows
  1. Recomenda-se usar o [nvm-windows](https://github.com/coreybutler/nvm-windows):
  2. Baixe e instale o nvm-windows.
     No terminal, dentro da pasta `AquaSense`, rode:
     ```cmd
     nvm install 22
     nvm use 22
     ```
## Verificando versão
```cmd
node -v
```
Deve aparecer algo como:
v22.x.x
  

## 3. Instale as dependências
Dentro da pasta do AquaSense, rode:
```bash
npm install
```
Este comando instala todas as dependências do projeto. 

## Instalando novas bibliotecas/dependências durante o desenvolvimento

Sempre instale novas dependências dentro da pasta `AquaSense`, pois é onde está o arquivo `package.json` do projeto.

**Passos:**
1. Certifique-se de estar na pasta correta:
   ```bash
   cd /caminho/para/dsi-ufrpe/AquaSense
   ```
2. Instale a biblioteca normalmente, por exemplo:
   ```bash
   npm install nome-da-biblioteca
   ```

**Nunca rode comandos de instalação de dependências na raiz do repositório ou fora da pasta `AquaSense`, assim, todas as dependências ficam centralizadas.**

**Importante:**
Sempre que algum membro do grupo adicionar uma nova dependência (ou atualizar o arquivo `package.json`), rode o comando abaixo dentro da pasta `AquaSense` para garantir que todas as dependências estejam instaladas corretamente no seu ambiente:
```bash
npm install
```
Assim, você evita erros de dependências faltando ao rodar ou desenvolver o projeto.

## 5. Executando o projeto
**IMPORTANTE**: O backend deve ser sempre iniciado antes do aplicativo. 

**Por que isso é necessário?**
O app depende do backend para funcionalidades como:
- enviar e-mail de verificação de conta
- enviar e-mail de redefinição de senha
- utilizar o Firebse Admin para gerar links e ações relacionadas à autenticação

Por isso, o backend precisa estar rodando antes de testar fluxos que envolvem envio de e-mail. 

## Terminal 1 - Backend
Abra um terminal dentro de Aquasense: 

```bash
cd backend
npm run dev
```
O backend deve iniciar e mostrar os seguintes logs no terminal: 
(atualizar os logs e colocar aqui) 

**Não feche esse terminal**.

## Terminal 2 - Aplicativo (Expo)
Abra outro terminal e volta para a pasta principal:

```bash
cd AquaSense
```
Agora rode: 

```bash
npx expo start
```

- O padrão do projeto é rodar no aplicativo **Expo Go** (Android/iOS):
   1. Instale o app [Expo Go](https://expo.dev/go) no seu celular.
   2. Após rodar o comando acima, escaneie o QR Code exibido no terminal ou navegador usando o Expo Go.
   3. O app será carregado diretamente no seu dispositivo.
 

---

**Dicas:**
- Sempre use a versão do Node indicada em `.nvmrc`.
- Se tiver problemas, tente rodar:
  ```bash
  npx expo start --reset-cache
  ```
  ou:
  ```bash
  npx expo start --clear
  ```
- Depêndencia faltando:
  ```bash
  npm install
  ```
- Backend não responde:
  verifique se o Terminal 1 está rodando:
  ```bash
  npm run dev
  ```

--- 

**Para o projeto funcionar corretamente:
- Backend precisa estar ativo
- Expo precisa estar rodando
- Dois terminais devem permanecer abertos
  


