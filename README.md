# Sistema de Controle de Estoque

Sistema web de controle de estoque com comunicação em tempo real usando Node.js e Socket.io.

## 🚀 Funcionalidades

- ✅ Controle de Estoque em tempo real
- ✅ Registro de Compras com cálculo de preço médio
- ✅ Sistema de Necessidades (alertas automáticos)
- ✅ Kits de Produção com baixa em lote
- ✅ Retorno de Evento (Logística Reversa)
- ✅ Dashboard com estatísticas
- ✅ Paste Inteligente (Ctrl+V) para entrada/saída em lote
- ✅ Tema Escuro e Tema Neon (Easter Egg)
- ✅ Ambiente 3D interativo com Three.js
- ✅ Sincronização em tempo real entre múltiplos terminais

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- NPM (versão 6 ou superior)

## 🔧 Instalação Local

1. Clone o repositório ou baixe os arquivos
2. Navegue até a pasta do projeto:
```bash
cd cauaestoque
```

3. Instale as dependências:
```bash
npm install
```

4. Inicie o servidor:
```bash
npm start
```

5. Acesse no navegador:
```
http://localhost:3000
```

## ☁️ Deploy em Nuvem

### Render.com (Recomendado - Gratuito)

1. Crie uma conta em [render.com](https://render.com)
2. Clique em "New +" → "Web Service"
3. Conecte seu repositório GitHub
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Clique em "Create Web Service"

### Heroku

1. Instale o Heroku CLI
2. Faça login: `heroku login`
3. Crie o app: `heroku create nome-do-seu-app`
4. Faça deploy: `git push heroku main`

### Railway.app

1. Crie uma conta em [railway.app](https://railway.app)
2. Clique em "New Project" → "Deploy from GitHub"
3. Selecione o repositório
4. O deploy é automático!

## 🎮 Como Usar

### Ctrl+V Mágico
- **Na aba Estoque**: Cole planilhas para entrada/saída em lote
- **Na aba Compras**: Cole planilhas para registrar compras em lote

### Formato da Planilha (6 colunas)
```
Setor	Produto	Especificação	Quantidade	Unidade	Valor Total
Ferragens	Parafuso	3/4	200	peça	R$ 580,00
```

### Easter Egg
Clique 5 vezes rápido em "Criado por Cauã Granchelli" no modal de informações para ativar o Modo Neon! 🎨

## 🛠️ Tecnologias Utilizadas

- Node.js
- Express
- Socket.io
- Three.js
- HTML5
- CSS3 (Glassmorphism)
- JavaScript (ES6+)

## 📝 Versão

**2.26.1.1** - Sistema completo com todas as funcionalidades

## 👨‍💻 Autor

**Cauã Granchelli**

## 📄 Licença

ISC License
# ControleEstoque
