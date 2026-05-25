const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let estoque = [];
let compras = [];
let kits = [];
let historico = [];
let projetosRealizados = [];
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`\n=== CLIENTE CONECTADO ===`);
  console.log(`Socket ID: ${socket.id}`);
  console.log(`Total de clientes: ${connectedClients}\n`);
  
  socket.emit('initial-data', { estoque, compras, kits, historico, projetosRealizados });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('get-stats', () => {
    socket.emit('stats', { clients: connectedClients });
  });

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`\n=== CLIENTE DESCONECTADO ===`);
    console.log(`Socket ID: ${socket.id}`);
    console.log(`Total de clientes: ${connectedClients}\n`);
  });

  socket.on('processar-lote', (operacoes) => {
    console.log('\n\n');
    console.log('='.repeat(50));
    console.log('=== SERVIDOR: Recebeu processar-lote ===');
    console.log('='.repeat(50));
    console.log('Operações recebidas:', JSON.stringify(operacoes, null, 2));
    console.log('Número de operações:', operacoes.length);
    console.log('='.repeat(50));
    console.log('\n');
    
    try {
      let totalProcessado = 0;
      let totalCriado = 0;
      const erros = [];

      operacoes.forEach(op => {
        console.log(`Processando: ${op.produto} - Qtd: ${op.quantidade} - Tipo: ${op.tipo}`);
        
        const produtoIndex = estoque.findIndex(item => 
          item.produto.toLowerCase() === op.produto.toLowerCase()
        );

        console.log(`Produto encontrado no índice: ${produtoIndex}`);

        if (produtoIndex !== -1) {
          const quantidadeAtual = parseInt(estoque[produtoIndex].quantidade);
          
          if (op.tipo === 'entrada') {
            estoque[produtoIndex].quantidade = quantidadeAtual + parseInt(op.quantidade);
            addHistorico(`Entrada em lote: +${op.quantidade} ${estoque[produtoIndex].unidade} de ${op.produto}`);
            console.log(`✓ Entrada processada: ${op.produto} - Nova qtd: ${estoque[produtoIndex].quantidade}`);
            totalProcessado++;
          } else if (op.tipo === 'saida') {
            if (quantidadeAtual >= parseInt(op.quantidade)) {
              estoque[produtoIndex].quantidade = quantidadeAtual - parseInt(op.quantidade);
              addHistorico(`Saída em lote: -${op.quantidade} ${estoque[produtoIndex].unidade} de ${op.produto}`);
              console.log(`✓ Saída processada: ${op.produto} - Nova qtd: ${estoque[produtoIndex].quantidade}`);
              totalProcessado++;
            } else {
              erros.push(`${op.produto}: estoque insuficiente (disponível: ${quantidadeAtual})`);
              console.log(`✗ Estoque insuficiente para ${op.produto}`);
            }
          }
        } else {
          if (op.tipo === 'entrada') {
            const novoProduto = {
              setor: op.setor || '',
              produto: op.produto,
              especificacao: op.especificacao || '',
              quantidade: parseInt(op.quantidade),
              estoqueMinimo: 0,
              ncm: '',
              unidade: op.unidade || 'un',
              precoMedio: 0
            };
            estoque.push(novoProduto);
            addHistorico(`Produto criado via lote: ${op.produto} (${op.quantidade} ${op.unidade})`);
            console.log(`✓ Produto criado: ${op.produto}`);
            totalCriado++;
          } else {
            erros.push(`${op.produto}: produto não encontrado (não é possível dar baixa)`);
            console.log(`✗ Produto não encontrado: ${op.produto}`);
          }
        }
      });

      console.log(`Total processado: ${totalProcessado}, Total criado: ${totalCriado}, Erros: ${erros.length}`);

      if (totalProcessado > 0 || totalCriado > 0) {
        console.log('Emitindo update-estoque para todos os clientes');
        console.log('Estoque atualizado:', estoque);
        io.emit('update-estoque', estoque);
        io.emit('update-historico', historico);
      }

      let mensagem = '';
      if (totalProcessado > 0) {
        mensagem += `${totalProcessado} item(ns) processado(s). `;
      }
      if (totalCriado > 0) {
        mensagem += `${totalCriado} produto(s) criado(s). `;
      }
      if (erros.length > 0) {
        mensagem += `Erros: ${erros.join(', ')}`;
      }

      if (erros.length > 0 && totalProcessado === 0 && totalCriado === 0) {
        socket.emit('lote-processado', {
          sucesso: false,
          mensagem: mensagem
        });
      } else {
        socket.emit('lote-processado', {
          sucesso: true,
          mensagem: mensagem || 'Processamento concluído!'
        });
      }
    } catch (error) {
      console.error('Erro ao processar lote:', error);
      socket.emit('lote-processado', {
        sucesso: false,
        mensagem: 'Erro ao processar lote: ' + error.message
      });
    }
  });

  socket.on('add-estoque', (item) => {
    estoque.push(item);
    addHistorico(`Produto adicionado: ${item.produto} (${item.quantidade} ${item.unidade})`);
    io.emit('update-estoque', estoque);
    io.emit('update-historico', historico);
  });

  socket.on('update-estoque', (updatedEstoque) => {
    estoque = updatedEstoque;
    io.emit('update-estoque', estoque);
  });

  socket.on('delete-estoque', (index) => {
    const item = estoque[index];
    addHistorico(`Produto removido: ${item.produto}`);
    estoque.splice(index, 1);
    io.emit('update-estoque', estoque);
    io.emit('update-historico', historico);
  });

  socket.on('add-compra', (compra) => {
    compras.push(compra);
    
    const produtoIndex = estoque.findIndex(item => 
      item.produto.toLowerCase() === compra.produto.toLowerCase() &&
      item.especificacao === compra.especificacao
    );

    if (produtoIndex !== -1) {
      const estoqueItem = estoque[produtoIndex];
      const quantidadeAtual = parseInt(estoqueItem.quantidade);
      const quantidadeNova = parseInt(compra.quantidade);
      const valorCompra = parseFloat(compra.valor);
      
      const custoAtual = parseFloat(estoqueItem.precoMedio || 0) * quantidadeAtual;
      const custoNovo = valorCompra;
      const quantidadeTotal = quantidadeAtual + quantidadeNova;
      
      estoqueItem.precoMedio = (custoAtual + custoNovo) / quantidadeTotal;
      estoqueItem.quantidade = quantidadeTotal;
      
      addHistorico(`Entrada: ${compra.quantidade} ${compra.unidade} de ${compra.produto} - R$ ${parseFloat(compra.valor).toFixed(2)} (Preço médio atualizado: R$ ${estoqueItem.precoMedio.toFixed(2)})`);
    } else {
      const precoMedio = parseFloat(compra.valor) / parseInt(compra.quantidade);
      estoque.push({
        setor: compra.setor,
        produto: compra.produto,
        especificacao: compra.especificacao,
        quantidade: compra.quantidade,
        quantidadeRestante: compra.quantidadeRestante,
        estoqueMinimo: compra.estoqueMinimo || 0,
        ncm: compra.ncm,
        unidade: compra.unidade,
        precoMedio: precoMedio
      });
      addHistorico(`Entrada (novo produto): ${compra.quantidade} ${compra.unidade} de ${compra.produto} - R$ ${parseFloat(compra.valor).toFixed(2)} (Preço médio: R$ ${precoMedio.toFixed(2)})`);
    }

    io.emit('update-compras', compras);
    io.emit('update-estoque', estoque);
    io.emit('update-historico', historico);
  });

  socket.on('delete-compra', (index) => {
    compras.splice(index, 1);
    io.emit('update-compras', compras);
  });

  socket.on('processar-compras-lote', (comprasLote) => {
    console.log('\n=== SERVIDOR: Recebeu processar-compras-lote ===');
    console.log('Compras recebidas:', comprasLote.length);
    
    try {
      let totalProcessado = 0;
      
      comprasLote.forEach(compra => {
        compras.push(compra);
        
        const produtoIndex = estoque.findIndex(item => 
          item.produto.toLowerCase() === compra.produto.toLowerCase() &&
          item.especificacao === compra.especificacao
        );

        if (produtoIndex !== -1) {
          const estoqueItem = estoque[produtoIndex];
          const quantidadeAtual = parseInt(estoqueItem.quantidade);
          const quantidadeNova = parseInt(compra.quantidade);
          const valorCompra = parseFloat(compra.valor);
          
          const custoAtual = parseFloat(estoqueItem.precoMedio || 0) * quantidadeAtual;
          const custoNovo = valorCompra;
          const quantidadeTotal = quantidadeAtual + quantidadeNova;
          
          estoqueItem.precoMedio = (custoAtual + custoNovo) / quantidadeTotal;
          estoqueItem.quantidade = quantidadeTotal;
          
          addHistorico(`Compra em lote: ${compra.quantidade} ${compra.unidade} de ${compra.produto} - R$ ${parseFloat(compra.valor).toFixed(2)}`);
        } else {
          const precoMedio = parseFloat(compra.valor) / parseInt(compra.quantidade);
          estoque.push({
            setor: compra.setor,
            produto: compra.produto,
            especificacao: compra.especificacao,
            quantidade: compra.quantidade,
            estoqueMinimo: compra.estoqueMinimo || 0,
            ncm: compra.ncm,
            unidade: compra.unidade,
            precoMedio: precoMedio
          });
          addHistorico(`Compra em lote (novo produto): ${compra.quantidade} ${compra.unidade} de ${compra.produto} - R$ ${parseFloat(compra.valor).toFixed(2)}`);
        }
        
        totalProcessado++;
      });

      io.emit('update-compras', compras);
      io.emit('update-estoque', estoque);
      io.emit('update-historico', historico);
      
      socket.emit('compras-lote-processadas', {
        sucesso: true,
        mensagem: `${totalProcessado} compra(s) registrada(s) com sucesso!`
      });
    } catch (error) {
      console.error('Erro ao processar compras em lote:', error);
      socket.emit('compras-lote-processadas', {
        sucesso: false,
        mensagem: 'Erro ao processar compras: ' + error.message
      });
    }
  });

  socket.on('limpar-estoque', () => {
    console.log('\n=== LIMPANDO TODO O ESTOQUE ===');
    estoque = [];
    addHistorico('❌ ESTOQUE COMPLETAMENTE LIMPO');
    io.emit('update-estoque', estoque);
    io.emit('update-historico', historico);
    socket.emit('estoque-limpo');
    console.log('Estoque limpo com sucesso!');
  });

  socket.on('limpar-compras', () => {
    console.log('\n=== LIMPANDO TODO O HISTÓRICO DE COMPRAS ===');
    compras = [];
    addHistorico('❌ HISTÓRICO DE COMPRAS COMPLETAMENTE LIMPO');
    io.emit('update-compras', compras);
    io.emit('update-historico', historico);
    socket.emit('compras-limpas');
    console.log('Histórico de compras limpo com sucesso!');
  });

  socket.on('add-kit', (kit) => {
    kits.push(kit);
    addHistorico(`Kit criado: ${kit.nome}`);
    io.emit('update-kits', kits);
    io.emit('update-historico', historico);
  });

  socket.on('delete-kit', (index) => {
    const kit = kits[index];
    addHistorico(`Kit removido: ${kit.nome}`);
    kits.splice(index, 1);
    io.emit('update-kits', kits);
    io.emit('update-historico', historico);
  });

  socket.on('produzir-kit', (index) => {
    const kit = kits[index];
    let sucesso = true;
    let erros = [];
    let custoTotal = 0;

    kit.itens.forEach(itemKit => {
      const produtoIndex = estoque.findIndex(e => 
        e.produto.toLowerCase() === itemKit.produto.toLowerCase()
      );

      if (produtoIndex === -1) {
        sucesso = false;
        erros.push(`${itemKit.produto} não encontrado no estoque`);
      } else if (parseInt(estoque[produtoIndex].quantidade) < parseInt(itemKit.quantidade)) {
        sucesso = false;
        erros.push(`${itemKit.produto}: estoque insuficiente`);
      } else {
        const precoMedio = parseFloat(estoque[produtoIndex].precoMedio || 0);
        custoTotal += precoMedio * parseInt(itemKit.quantidade);
      }
    });

    if (sucesso) {
      const itensUtilizados = [];
      
      kit.itens.forEach(itemKit => {
        const produtoIndex = estoque.findIndex(e => 
          e.produto.toLowerCase() === itemKit.produto.toLowerCase()
        );
        estoque[produtoIndex].quantidade = parseInt(estoque[produtoIndex].quantidade) - parseInt(itemKit.quantidade);
        
        itensUtilizados.push({
          produto: estoque[produtoIndex].produto,
          quantidade: parseInt(itemKit.quantidade),
          unidade: estoque[produtoIndex].unidade,
          precoMedio: parseFloat(estoque[produtoIndex].precoMedio || 0)
        });
      });

      const projeto = {
        nome: kit.nome,
        descricao: kit.descricao,
        itens: itensUtilizados,
        custoTotal: custoTotal,
        data: new Date().toLocaleString('pt-BR'),
        status: 'Produzido',
        retornoRealizado: false
      };
      
      projetosRealizados.push(projeto);

      addHistorico(`Produção: Kit ${kit.nome} produzido - Custo Total: R$ ${custoTotal.toFixed(2)}`);
      io.emit('update-estoque', estoque);
      io.emit('update-historico', historico);
      io.emit('update-projetos', projetosRealizados);
      socket.emit('producao-sucesso', `Kit ${kit.nome} produzido com sucesso! Custo Total: R$ ${custoTotal.toFixed(2)}`);
    } else {
      socket.emit('producao-erro', erros.join(', '));
    }
  });

  socket.on('retorno-evento', (data) => {
    const { indexProjeto, retornos } = data;
    const projeto = projetosRealizados[indexProjeto];
    
    if (!projeto) {
      socket.emit('retorno-erro', 'Projeto não encontrado');
      return;
    }

    let totalRetornado = 0;
    let totalDescartado = 0;
    let totalDanificado = 0;

    retornos.forEach(retorno => {
      const produtoIndex = estoque.findIndex(e => 
        e.produto.toLowerCase() === retorno.produto.toLowerCase()
      );

      if (produtoIndex !== -1 && retorno.intacta > 0) {
        estoque[produtoIndex].quantidade = parseInt(estoque[produtoIndex].quantidade) + parseInt(retorno.intacta);
        totalRetornado += parseInt(retorno.intacta);
      }

      totalDescartado += parseInt(retorno.descartada || 0);
      totalDanificado += parseInt(retorno.danificada || 0);
    });

    projeto.retornoRealizado = true;
    projeto.status = 'Retorno Processado';
    projeto.retornoData = new Date().toLocaleString('pt-BR');
    projeto.retornoDetalhes = retornos;

    addHistorico(`Retorno de Evento: ${projeto.nome} - ${totalRetornado} itens retornados ao estoque, ${totalDescartado} descartados, ${totalDanificado} danificados`);
    
    io.emit('update-estoque', estoque);
    io.emit('update-projetos', projetosRealizados);
    io.emit('update-historico', historico);
    socket.emit('retorno-sucesso', 'Retorno processado com sucesso!');
  });

  socket.on('comprar-necessidade', (data) => {
    const { produto, quantidade, valor } = data;
    
    const produtoIndex = estoque.findIndex(item => 
      item.produto.toLowerCase() === produto.toLowerCase()
    );

    if (produtoIndex !== -1) {
      const estoqueItem = estoque[produtoIndex];
      const quantidadeAtual = parseInt(estoqueItem.quantidade);
      const quantidadeNova = parseInt(quantidade);
      const valorCompra = parseFloat(valor);
      
      const custoAtual = parseFloat(estoqueItem.precoMedio || 0) * quantidadeAtual;
      const custoNovo = valorCompra;
      const quantidadeTotal = quantidadeAtual + quantidadeNova;
      
      estoqueItem.precoMedio = (custoAtual + custoNovo) / quantidadeTotal;
      estoqueItem.quantidade = quantidadeTotal;
      
      addHistorico(`Compra de necessidade: ${quantidade} ${estoqueItem.unidade} de ${produto} - R$ ${parseFloat(valor).toFixed(2)}`);
      
      compras.push({
        setor: estoqueItem.setor,
        produto: produto,
        especificacao: estoqueItem.especificacao,
        quantidade: quantidade,
        quantidadeRestante: estoqueItem.quantidadeRestante,
        estoqueMinimo: estoqueItem.estoqueMinimo,
        ncm: estoqueItem.ncm,
        unidade: estoqueItem.unidade,
        valor: valor
      });

      io.emit('update-estoque', estoque);
      io.emit('update-compras', compras);
      io.emit('update-historico', historico);
    }
  });
});

function addHistorico(mensagem) {
  const data = new Date();
  const dataFormatada = data.toLocaleString('pt-BR');
  historico.unshift({ data: dataFormatada, mensagem });
  if (historico.length > 100) {
    historico.pop();
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 SERVIDOR INICIADO COM SUCESSO!`);
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
  console.log(`${'='.repeat(50)}\n`);
});
