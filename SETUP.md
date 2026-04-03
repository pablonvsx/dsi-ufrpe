# Guia de Inicialização do Projeto AquaSense

Este guia mostra o passo a passo para iniciar o projeto AquaSense, partindo da pasta raiz `dsi-ufrpe`.

## 1. Acesse a pasta do projeto

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
   nvm install
   nvm use
   ```
   Isso garante que você está usando a versão correta do Node (definida em `.nvmrc`).

### Windows
- Recomenda-se usar o [nvm-windows](https://github.com/coreybutler/nvm-windows):
  1. Baixe e instale o nvm-windows.
  2. No terminal, dentro da pasta `AquaSense`, rode:
     ```cmd
     nvm install 22
     nvm use 22
     ```

## 3. Instale as dependências

```bash
npm install
```


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

## 5. Inicie o projeto

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
