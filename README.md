# AquaSense: Monitoramento Hídrico Colaborativo e Ciência Cidadã

Repositório vinculado ao componente curricular **Desenvolvimento de Sistemas de Informação (BSI/UFRPE)**. O AquaSense é uma plataforma *mobile* voltada para o monitoramento participativo da qualidade da água em corpos hídricos de Pernambuco, integrando dados oficiais e registros da comunidade para democratizar a informação e subsidiar a governança hídrica.

---

## 👥 Equipe e Orientação

* **Docentes Orientadores:** Prof. Dr. Gabriel Alves de Albuquerque Júnior; Profa. Dra. Maria da Conceição Moraes Batista
* **Discentes:**
    * Ana Clara Souza da Silva
    * Lucas Gabriel Ferreira de Santana
    * Maria Laura Lopes Cordeiro
    * Matheus Costa Sales
    * Pablo Guilherme de Melo Neves

---

## 📝 Resumo do Projeto

A água ocupa um lugar central como componente das identidades culturais e dos modos de vida das comunidades nordestinas, sendo essencial para a subsistência e memória coletiva. Alinhado ao **Objetivo de Desenvolvimento Sustentável n. 6 (ODS 6)** da Agenda 2030, o AquaSense busca a gestão sustentável da água com ênfase na participação comunitária.

O sistema é organizado em quatro perfis de usuário com níveis crescentes de acesso e capacidade de coleta:
* **Usuário Comum:** Realiza registros observacionais georreferenciados.
* **Colaborador:** Insere medições quantitativas com equipamentos de baixo custo.
* **Equipe Técnica:** Registra análises laboratoriais e valida dados.
* **Gestor Público:** Consolida informações para decisões institucionais.

Esta arquitetura de ciência cidadã amplia a capilaridade do monitoramento hídrico e democratiza o acesso à informação ambiental.

---

## ⚠️ O Problema

A gestão hídrica depende da incorporação das comunidades nos processos de monitoramento e decisão, conforme a **Lei n. 9.433/1997**, mas ainda é limitada pela fragmentação dos dados e dificuldade de comunicação entre os atores envolvidos. O AquaSense aborda a lacuna de assiduidade nas análises hídricas, permitindo que a participação dos usuários complemente as informações de fontes oficiais.

---

## 🛠️ Stack Tecnológica

O projeto utiliza tecnologias modernas para garantir escalabilidade e suporte a operações em campo:

* **Framework:** [React Native](https://reactnative.dev/) com Expo (Desenvolvimento multiplataforma Android/iOS)].
* **Banco de Dados:** [Firebase Firestore](https://firebase.google.com/docs/firestore) (NoSQL orientado a documentos).
* **Autenticação:** Firebase Auth (Controle de permissões por perfil).
* **Mapas e Geoprocessamento:** [Google Maps API](https://developers.google.com/maps) integrada via `react-native-maps`.

---

## 🎯 Objetivos

### Geral
* Desenvolver um aplicativo mobile funcional que integre ciência cidadã, georreferenciamento e persistência de dados em nuvem para ampliar o monitoramento hídrico colaborativo em Pernambuco.

### Específicos
* Implementar quatro perfis de usuário com controle de permissões via Firebase.
* Construir módulo de mapa interativo com visualização dos status de qualidade hídrica.
* Desenvolver formulários de coleta adaptados, do registro qualitativo à análise técnica.
* Estruturar base de dados georreferenciada com atributos territoriais e ambientais como bacia hidrográfica e município.

---

## 📚 Referências Bibliográficas

* BONNEY, R. et al. **Citizen Science: A Developing Tool for Expanding Science Knowledge**. BioScience, 2014.
* BRASIL. **Lei n. 9.433, de 8 de janeiro de 1997**. Institui a Política Nacional de Recursos Hídricos. Brasília, 1997.
* CUNHA, S. B.; GUERRA, A. J. T. **A Questão Ambiental: Diferentes Abordagens**. Rio de Janeiro: Bertrand Brasil, 2012.
* JACOBI, P. R. **Governança da Água no Brasil**. São Paulo: Annablume, 2009.
* ONU. **Agenda 2030 para o Desenvolvimento Sustentável**. Nova York: ONU, 2015.
