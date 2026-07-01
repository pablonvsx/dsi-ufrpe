# Guia de Inicialização – Projeto AquaSense

Este guia apresenta todas as etapas necessárias para configurar e executar o projeto **AquaSense** pela primeira vez.

## Pré-requisitos

Antes de iniciar, certifique-se de que você possui instalado em sua máquina:

- Git
- Node.js (utilizando o NVM)
- npm (instalado junto com o Node.js)
- Expo Go (Android ou iOS), caso deseje executar o aplicativo em um dispositivo físico

---

## 1. Clone o repositório

Clone o repositório do projeto para sua máquina:

```bash
git clone https://github.com/pablonvsx/dsi-ufrpe.git
```

Após finalizar o download, acesse a pasta do repositório:

```bash
cd dsi-ufrpe
```

---

## 2. Acesse a pasta do projeto

O aplicativo está localizado dentro da pasta **AquaSense**.

Entre na pasta do projeto:

```bash
cd AquaSense
```

A partir deste ponto, todos os comandos deste guia deverão ser executados dentro da pasta **AquaSense**.

---

## 3. Configure a versão do Node.js

O projeto utiliza o **NVM (Node Version Manager)** para garantir que todos os desenvolvedores utilizem a mesma versão do Node.js.

### Linux/macOS

Caso ainda não possua o NVM instalado:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Reinicie o terminal ou execute:

```bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

Depois, dentro da pasta **AquaSense**, execute:

```bash
nvm install 22
nvm use 22
```

### Windows

Recomenda-se utilizar o **nvm-windows**.

Após instalar o NVM, execute:

```bash
nvm install 22
nvm use 22
```

### Verificando a versão instalada

```bash
node -v
```

O resultado deverá ser semelhante a:

```text
v22.x.x
```

---

## 4. Instale as dependências

Ainda dentro da pasta **AquaSense**, execute:

```bash
npm install
```

Esse comando instalará todas as dependências necessárias para executar o projeto.

---

## 5. Executando o projeto

Com todas as dependências instaladas, execute:

```bash
npx expo start
```

Esse comando iniciará automaticamente o ambiente de desenvolvimento do AquaSense.

Após alguns instantes será exibido um QR Code no terminal e também será aberta uma página no navegador com o Expo.

### Executando no celular

1. Instale o aplicativo **Expo Go** em seu dispositivo Android ou iOS.
2. Certifique-se de que o computador e o celular estejam conectados à mesma rede Wi-Fi.
3. Abra o Expo Go.
4. Escaneie o QR Code exibido no terminal ou no navegador.

O aplicativo será carregado automaticamente no dispositivo.

### Executando no emulador Android

Caso esteja utilizando um emulador Android aberto, pressione a tecla **A** no terminal onde o Expo está sendo executado.

### Executando no simulador iOS (macOS)

Caso esteja utilizando o simulador do iOS, pressione a tecla **I** no terminal.

---

## 6. Instalando novas dependências

Sempre instale novas bibliotecas dentro da pasta **AquaSense**, pois é nela que está localizado o arquivo `package.json`.

Exemplo:

```bash
npm install nome-da-biblioteca
```

Nunca instale dependências na raiz do repositório.

Sempre que algum membro da equipe adicionar ou atualizar dependências do projeto, execute novamente:

```bash
npm install
```

Isso garante que seu ambiente permanecerá sincronizado com o restante da equipe.

---

## Solução de problemas

### Limpar o cache do Expo

Caso ocorram problemas durante a execução, tente:

```bash
npx expo start --reset-cache
```

ou

```bash
npx expo start --clear
```

### Erros de dependências

Execute:

```bash
npm install
```

### Verifique a versão do Node

Caso ocorram erros inesperados, confirme se está utilizando a versão definida no arquivo `.nvmrc`:

```bash
node -v
```

---

## Boas práticas

- Utilize sempre a versão do Node definida no arquivo `.nvmrc`.
- Execute `npm install` sempre que houver alterações no arquivo `package.json`.
- Mantenha o Expo Go atualizado.
- Caso tenha problemas após atualizar dependências, limpe o cache do Expo antes de iniciar novamente o projeto.
