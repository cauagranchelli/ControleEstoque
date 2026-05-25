const socket = io();

let estoqueAtual = [];
let comprasAtual = [];
let kitsAtual = [];
let historicoAtual = [];
let projetosAtual = [];
let filtroSetorAtivo = 'todos';
let clickCount = 0;
let clickTimer = null;
let serverStartTime = Date.now();
let threeScene, threeCamera, threeRenderer, threeMeshes = [];
let parsedPasteData = [];

socket.on('connect', () => {
    console.log('✅ Socket conectado! ID:', socket.id);
});

socket.on('disconnect', () => {
    console.log('❌ Socket desconectado!');
});

socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão:', error);
});

document.addEventListener('paste', (event) => {
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' || 
                          activeElement.tagName === 'TEXTAREA' || 
                          activeElement.isContentEditable;
    
    if (isInputFocused) {
        return;
    }
    
    event.preventDefault();
    
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    
    if (!pastedText || pastedText.trim() === '') {
        return;
    }
    
    console.log('Texto colado:', pastedText);
    
    const activeTab = document.querySelector('.tab-content.active');
    const isComprasTab = activeTab && activeTab.id === 'compras';
    
    console.log('Aba ativa:', activeTab ? activeTab.id : 'nenhuma');
    console.log('É aba de compras?', isComprasTab);
    
    const parsedItems = parseClipboardData(pastedText);
    
    if (parsedItems.length > 0) {
        parsedPasteData = parsedItems;
        if (isComprasTab) {
            showPasteModalCompras(parsedItems);
        } else {
            showPasteModal(parsedItems);
        }
    } else {
        alert('⚠️ Não foi possível identificar produtos válidos no texto colado.');
    }
});

function parseClipboardData(text) {
    const items = [];
    
    if (text.includes('\t')) {
        console.log('Detectado formato de planilha (TSV)');
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach((line, index) => {
            if (index === 0 && (line.toLowerCase().includes('produto') || line.toLowerCase().includes('quantidade'))) {
                console.log('Pulando linha de cabeçalho:', line);
                return;
            }
            
            const columns = line.split('\t');
            
            console.log(`Linha ${index}:`, columns);
            
            if (columns.length >= 4) {
                const setor = columns[0] ? columns[0].trim() : '';
                const produto = columns[1] ? columns[1].trim() : '';
                const especificacao = columns[2] ? columns[2].trim() : '';
                const quantidadeStr = columns[3] ? columns[3].trim() : '';
                const unidade = columns[4] ? columns[4].trim() : 'un';
                const valorTotal = columns[5] ? columns[5].trim() : '';
                
                const quantidade = parseInt(quantidadeStr.replace(/[^0-9]/g, ''));
                
                if (produto && !isNaN(quantidade) && quantidade > 0) {
                    const produtoEstoque = findProductInStock(produto, especificacao);
                    
                    items.push({
                        setor: setor,
                        produto: produto,
                        especificacao: especificacao,
                        quantidade: quantidade,
                        unidade: unidade,
                        valorTotal: valorTotal,
                        encontrado: produtoEstoque !== null,
                        produtoEstoque: produtoEstoque
                    });
                    
                    console.log(`✓ Item adicionado: ${quantidade} ${unidade} de ${produto}`);
                } else {
                    console.log(`✗ Item ignorado (produto vazio ou quantidade inválida):`, { produto, quantidade });
                }
            } else {
                console.log(`✗ Linha ignorada (menos de 4 colunas):`, columns);
            }
        });
    } else {
        console.log('Detectado formato de texto livre');
        
        const regex = /(\d+)\s*([a-záàâãéêíóôõúç\s]+)/gi;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const quantidade = parseInt(match[1]);
            const produto = match[2].trim();
            
            if (!isNaN(quantidade) && produto.length > 2) {
                const produtoEstoque = findProductInStock(produto, '');
                items.push({
                    setor: '',
                    produto: produto,
                    especificacao: '',
                    quantidade: quantidade,
                    unidade: 'un',
                    valorTotal: '',
                    encontrado: produtoEstoque !== null,
                    produtoEstoque: produtoEstoque
                });
            }
        }
    }
    
    console.log(`Total de itens parseados: ${items.length}`);
    return items;
}

function findProductInStock(searchTerm, especificacao) {
    const searchLower = searchTerm.toLowerCase().trim();
    const especLower = especificacao ? especificacao.toLowerCase().trim() : '';
    
    const exactMatch = estoqueAtual.find(item => {
        const produtoMatch = item.produto.toLowerCase() === searchLower;
        const especMatch = !especLower || (item.especificacao && item.especificacao.toLowerCase() === especLower);
        return produtoMatch && especMatch;
    });
    
    if (exactMatch) return exactMatch;
    
    const partialMatch = estoqueAtual.find(item => {
        const produtoMatch = item.produto.toLowerCase().includes(searchLower) ||
                            searchLower.includes(item.produto.toLowerCase());
        return produtoMatch;
    });
    
    return partialMatch || null;
}

function showPasteModal(items) {
    const container = document.getElementById('paste-items-list');
    container.innerHTML = '';
    
    console.log('=== ABRINDO MODAL ===');
    console.log('Exibindo modal com', items.length, 'itens');
    
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'paste-item' + (item.encontrado ? '' : ' not-found');
        
        const icon = item.encontrado ? '✅' : '⚠️';
        const unidade = item.unidade || 'un';
        const produtoNome = item.encontrado ? item.produtoEstoque.produto : item.produto;
        const especificacao = item.especificacao ? ` - ${item.especificacao}` : '';
        
        let infoExtra = '';
        if (item.setor) {
            infoExtra += `<span style="font-size: 0.85em; color: var(--text-secondary); margin-left: 10px;">[${item.setor}]</span>`;
        }
        if (item.valorTotal) {
            infoExtra += `<span style="font-size: 0.85em; color: #27ae60; margin-left: 10px; font-weight: bold;">${item.valorTotal}</span>`;
        }
        
        div.innerHTML = `
            <span class="paste-item-icon">${icon}</span>
            <span class="paste-item-quantity">${item.quantidade}</span>
            <span class="paste-item-unit">${unidade}</span>
            <span class="paste-item-name">${produtoNome}${especificacao}</span>
            ${infoExtra}
            ${!item.encontrado ? '<span class="paste-item-alert">⚠️ Será criado no estoque</span>' : ''}
        `;
        
        container.appendChild(div);
    });
    
    const modal = document.getElementById('modal-paste');
    console.log('Modal element:', modal);
    console.log('Modal display antes:', modal.style.display);
    modal.style.display = 'block';
    console.log('Modal display depois:', modal.style.display);
    console.log('Modal deve estar visível agora!');
}

function closeModalPaste() {
    document.getElementById('modal-paste').style.display = 'none';
    parsedPasteData = [];
}

function showPasteModalCompras(items) {
    const container = document.getElementById('paste-compras-items-list');
    container.innerHTML = '';
    
    console.log('=== ABRINDO MODAL DE COMPRAS ===');
    console.log('Exibindo modal com', items.length, 'itens');
    
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'paste-item';
        
        const unidade = item.unidade || 'un';
        const produtoNome = item.produto;
        const especificacao = item.especificacao ? ` - ${item.especificacao}` : '';
        
        let infoExtra = '';
        if (item.setor) {
            infoExtra += `<span style="font-size: 0.85em; color: var(--text-secondary); margin-left: 10px;">[${item.setor}]</span>`;
        }
        if (item.valorTotal) {
            infoExtra += `<span style="font-size: 0.85em; color: #27ae60; margin-left: 10px; font-weight: bold;">${item.valorTotal}</span>`;
        }
        
        div.innerHTML = `
            <span class="paste-item-icon">💰</span>
            <span class="paste-item-quantity">${item.quantidade}</span>
            <span class="paste-item-unit">${unidade}</span>
            <span class="paste-item-name">${produtoNome}${especificacao}</span>
            ${infoExtra}
        `;
        
        container.appendChild(div);
    });
    
    const modal = document.getElementById('modal-paste-compras');
    modal.style.display = 'block';
}

function closeModalPasteCompras() {
    document.getElementById('modal-paste-compras').style.display = 'none';
    parsedPasteData = [];
}

function processarPasteCompras() {
    console.log('=== PROCESSANDO COMPRAS EM LOTE ===');
    console.log('Dados parseados:', parsedPasteData);
    
    if (parsedPasteData.length === 0) {
        alert('⚠️ Nenhum produto para processar!');
        return;
    }
    
    const compras = parsedPasteData.map(item => ({
        setor: item.setor,
        produto: item.produto,
        especificacao: item.especificacao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor: item.valorTotal ? parseFloat(item.valorTotal.replace(/[^0-9,]/g, '').replace(',', '.')) : 0,
        estoqueMinimo: 0,
        ncm: ''
    }));
    
    console.log('Enviando compras via socket:', compras);
    socket.emit('processar-compras-lote', compras);
    
    closeModalPasteCompras();
}

function limparEstoque() {
    console.log('=== INICIANDO LIMPEZA DE ESTOQUE ===');
    if (confirm('⚠️ ATENÇÃO!\n\nDeseja APAGAR TODOS os itens do estoque?\n\nEsta ação não pode ser desfeita!')) {
        if (confirm('❌ TEM CERTEZA ABSOLUTA?\n\nTodos os produtos serão removidos permanentemente!')) {
            console.log('Usuário confirmou - Enviando socket emit limpar-estoque');
            socket.emit('limpar-estoque');
        } else {
            console.log('Usuário cancelou na segunda confirmação');
        }
    } else {
        console.log('Usuário cancelou na primeira confirmação');
    }
}

function limparCompras() {
    console.log('=== INICIANDO LIMPEZA DE COMPRAS ===');
    if (confirm('⚠️ ATENÇÃO!\n\nDeseja APAGAR TODO o histórico de compras?\n\nEsta ação não pode ser desfeita!')) {
        if (confirm('❌ TEM CERTEZA ABSOLUTA?\n\nTodo o histórico será removido permanentemente!')) {
            console.log('Usuário confirmou - Enviando socket emit limpar-compras');
            socket.emit('limpar-compras');
        } else {
            console.log('Usuário cancelou na segunda confirmação');
        }
    } else {
        console.log('Usuário cancelou na primeira confirmação');
    }
}

socket.on('estoque-limpo', () => {
    console.log('=== ESTOQUE LIMPO - Atualizando tela ===');
    alert('✅ Estoque limpo com sucesso!');
});

socket.on('compras-limpas', () => {
    console.log('=== COMPRAS LIMPAS - Atualizando tela ===');
    alert('✅ Histórico de compras limpo com sucesso!');
});

socket.on('compras-lote-processadas', (resultado) => {
    console.log('=== COMPRAS EM LOTE PROCESSADAS ===');
    console.log('Resultado:', resultado);
    if (resultado.sucesso) {
        alert(`✅ ${resultado.mensagem}`);
    } else {
        alert(`❌ Erro: ${resultado.mensagem}`);
    }
});

function processarPaste(tipo) {
    console.log('=== PROCESSANDO PASTE ===');
    console.log('Tipo:', tipo);
    console.log('Dados parseados:', parsedPasteData);
    
    const itensValidos = parsedPasteData.filter(item => item.encontrado);
    const itensNaoEncontrados = parsedPasteData.filter(item => !item.encontrado);
    
    console.log('Itens válidos:', itensValidos.length);
    console.log('Itens não encontrados:', itensNaoEncontrados.length);
    
    if (parsedPasteData.length === 0) {
        alert('⚠️ Nenhum produto para processar!');
        return;
    }
    
    if (itensNaoEncontrados.length > 0 && itensValidos.length === 0) {
        const confirmar = confirm(
            `⚠️ ATENÇÃO: Nenhum produto foi encontrado no estoque!\n\n` +
            `${itensNaoEncontrados.length} produto(s) serão CRIADOS no estoque.\n\n` +
            `Deseja continuar?`
        );
        
        if (!confirmar) {
            console.log('Usuário cancelou');
            return;
        }
    } else if (itensNaoEncontrados.length > 0) {
        const confirmar = confirm(
            `⚠️ ATENÇÃO:\n\n` +
            `${itensValidos.length} produto(s) encontrado(s) no estoque\n` +
            `${itensNaoEncontrados.length} produto(s) NÃO encontrado(s) (serão criados)\n\n` +
            `Deseja continuar?`
        );
        
        if (!confirmar) {
            console.log('Usuário cancelou');
            return;
        }
    }
    
    const operacoes = parsedPasteData.map(item => ({
        produto: item.encontrado ? item.produtoEstoque.produto : item.produto,
        setor: item.setor,
        especificacao: item.especificacao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        tipo: tipo,
        encontrado: item.encontrado
    }));
    
    console.log('Enviando operações via socket:', operacoes);
    console.log('Socket conectado?', socket.connected);
    console.log('Socket ID:', socket.id);
    
    if (!socket.connected) {
        alert('❌ Erro: Socket não está conectado ao servidor!');
        console.error('Socket desconectado! Tentando reconectar...');
        socket.connect();
        return;
    }
    
    console.log('>>> EMITINDO EVENTO: processar-lote');
    socket.emit('processar-lote', operacoes);
    console.log('>>> EVENTO EMITIDO!');
    
    setTimeout(() => {
        console.log('⏰ Timeout: Verificando se recebeu resposta...');
    }, 2000);
    
    closeModalPaste();
}

socket.on('lote-processado', (resultado) => {
    console.log('=== LOTE PROCESSADO ===');
    console.log('Resultado:', resultado);
    if (resultado.sucesso) {
        alert(`✅ ${resultado.mensagem}`);
        console.log('Processamento bem-sucedido!');
    } else {
        alert(`❌ Erro: ${resultado.mensagem}`);
        console.log('Erro no processamento');
    }
});

function toggleTheme() {
    document.body.classList.remove('neon-mode');
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const icon = document.querySelector('.theme-icon');
    icon.textContent = isDark ? '☀️' : '🌙';
}

function openInfoModal() {
    document.getElementById('modal-info').style.display = 'block';
    initThreeJS();
    startTypewriter();
    updateServerStats();
    setInterval(updateServerStats, 1000);
}

function closeInfoModal() {
    document.getElementById('modal-info').style.display = 'none';
    if (threeRenderer) {
        threeRenderer.dispose();
    }
}

function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    threeRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    threeRenderer.setSize(width, height);
    threeRenderer.setClearColor(0x000000, 0);

    const cylinderGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2, 32);
    const cylinderMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x667eea, 
        emissive: 0x667eea,
        emissiveIntensity: 0.3,
        shininess: 100 
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.position.set(-3, 0, 0);
    threeScene.add(cylinder);
    threeMeshes.push(cylinder);

    const boxGeometry = new THREE.BoxGeometry(3, 0.2, 1.5);
    const boxMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x764ba2,
        emissive: 0x764ba2,
        emissiveIntensity: 0.3,
        shininess: 100 
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(0, 0, 0);
    threeScene.add(box);
    threeMeshes.push(box);

    const torusGeometry = new THREE.TorusGeometry(1, 0.3, 16, 100);
    const torusMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4CAF50,
        emissive: 0x4CAF50,
        emissiveIntensity: 0.3,
        shininess: 100 
    });
    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    torus.position.set(3, 0, 0);
    threeScene.add(torus);
    threeMeshes.push(torus);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    threeScene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 5, 5);
    threeScene.add(pointLight);

    threeCamera.position.z = 8;

    canvas.addEventListener('mousemove', onMouseMove);

    animate();
}

let mouseX = 0;
let mouseY = 0;

function onMouseMove(event) {
    const canvas = document.getElementById('three-canvas');
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function animate() {
    requestAnimationFrame(animate);

    threeMeshes.forEach((mesh, index) => {
        mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.01;
        mesh.position.y = Math.sin(Date.now() * 0.001 + index) * 0.5;
    });

    threeCamera.position.x += (mouseX * 2 - threeCamera.position.x) * 0.05;
    threeCamera.position.y += (mouseY * 2 - threeCamera.position.y) * 0.05;
    threeCamera.lookAt(threeScene.position);

    threeRenderer.render(threeScene, threeCamera);
}

function startTypewriter() {
    const text = `- Comunicação Socket.io em tempo real implementada
- Nova interface Glassmorphism com efeito de vidro fosco
- Ambiente 3D interativo com Three.js
- Sistema de precificação automática por preço médio
- Módulo de Retorno de Evento (Logística Reversa)
- Custo real por projeto calculado automaticamente
- Dashboard com estatísticas em tempo real
- Tema escuro e tema neon (Easter Egg)
- Sistema de Kits de Produção com baixa em lote
- Aba de Necessidades com alertas inteligentes`;
    
    const element = document.getElementById('changelog-text');
    element.textContent = '';
    
    let index = 0;
    const speed = 30;
    
    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

function updateServerStats() {
    const pingStart = Date.now();
    socket.emit('ping');
    
    socket.once('pong', () => {
        const ping = Date.now() - pingStart;
        document.getElementById('ping-value').textContent = `${ping} ms`;
    });
    
    socket.emit('get-stats');
    
    const uptime = Date.now() - serverStartTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    document.getElementById('uptime-value').textContent = `${hours}h ${minutes}m ${seconds}s`;
}

socket.on('stats', (data) => {
    document.getElementById('clients-value').textContent = data.clients;
});

document.addEventListener('DOMContentLoaded', () => {
    const authorText = document.getElementById('author-text');
    if (authorText) {
        authorText.addEventListener('click', () => {
            clickCount++;
            
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 2000);
            
            if (clickCount === 5) {
                activateNeonMode();
                clickCount = 0;
            }
        });
    }
});

function activateNeonMode() {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('neon-mode');
    localStorage.setItem('theme', 'neon');
    
    const particles = [];
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = '5px';
        particle.style.height = '5px';
        particle.style.background = '#00ff88';
        particle.style.borderRadius = '50%';
        particle.style.boxShadow = '0 0 10px #00ff88';
        particle.style.left = Math.random() * window.innerWidth + 'px';
        particle.style.top = Math.random() * window.innerHeight + 'px';
        particle.style.zIndex = '9999';
        particle.style.pointerEvents = 'none';
        document.body.appendChild(particle);
        particles.push(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 2000);
    }
    
    alert('🎉 MODO NEON ATIVADO! 🎉');
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-icon').textContent = '☀️';
    } else if (savedTheme === 'neon') {
        document.body.classList.add('neon-mode');
    }
});

socket.on('initial-data', (data) => {
    estoqueAtual = data.estoque;
    comprasAtual = data.compras;
    kitsAtual = data.kits;
    historicoAtual = data.historico;
    projetosAtual = data.projetosRealizados || [];
    renderEstoque(estoqueAtual);
    renderCompras(comprasAtual);
    renderKits(kitsAtual);
    renderNecessidades();
    renderDashboard();
    renderHistorico(historicoAtual);
    renderProjetosRetorno();
    renderProjetosCustos();
});

socket.on('update-estoque', (estoque) => {
    console.log('=== RECEBEU UPDATE-ESTOQUE ===');
    console.log('Estoque recebido do servidor:', estoque);
    console.log('Total de itens:', estoque.length);
    estoqueAtual = estoque;
    renderEstoque(estoque);
    renderNecessidades();
    renderDashboard();
    console.log('Estoque renderizado na tela');
});

socket.on('update-compras', (compras) => {
    comprasAtual = compras;
    renderCompras(compras);
    renderDashboard();
});

socket.on('update-kits', (kits) => {
    kitsAtual = kits;
    renderKits(kits);
});

socket.on('update-historico', (historico) => {
    historicoAtual = historico;
    renderHistorico(historico);
});

socket.on('update-projetos', (projetos) => {
    projetosAtual = projetos;
    renderProjetosRetorno();
    renderProjetosCustos();
});

socket.on('producao-sucesso', (mensagem) => {
    alert(mensagem);
});

socket.on('producao-erro', (mensagem) => {
    alert('Erro: ' + mensagem);
});

socket.on('retorno-sucesso', (mensagem) => {
    alert(mensagem);
    closeModalRetorno();
});

socket.on('retorno-erro', (mensagem) => {
    alert('Erro: ' + mensagem);
});

function openTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

function increaseQuantity(type) {
    const input = document.getElementById(`quantidade-${type}`);
    input.value = parseInt(input.value) + 1;
}

function decreaseQuantity(type) {
    const input = document.getElementById(`quantidade-${type}`);
    if (parseInt(input.value) > 0) {
        input.value = parseInt(input.value) - 1;
    }
}

document.getElementById('form-estoque').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const item = {
        setor: document.getElementById('setor-estoque').value,
        produto: document.getElementById('produto-estoque').value,
        especificacao: document.getElementById('especificacao-estoque').value,
        quantidade: document.getElementById('quantidade-estoque').value,
        estoqueMinimo: document.getElementById('estoque-minimo-estoque').value,
        ncm: document.getElementById('ncm-estoque').value,
        unidade: document.getElementById('unidade-estoque').value
    };
    
    socket.emit('add-estoque', item);
    e.target.reset();
    document.getElementById('quantidade-estoque').value = 0;
    document.getElementById('estoque-minimo-estoque').value = 0;
});

document.getElementById('form-compras').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const compra = {
        setor: document.getElementById('setor-compras').value,
        produto: document.getElementById('produto-compras').value,
        especificacao: document.getElementById('especificacao-compras').value,
        quantidade: document.getElementById('quantidade-compras').value,
        estoqueMinimo: document.getElementById('estoque-minimo-compras').value,
        ncm: document.getElementById('ncm-compras').value,
        unidade: document.getElementById('unidade-compras').value,
        valor: document.getElementById('valor-compras').value
    };
    
    socket.emit('add-compra', compra);
    e.target.reset();
    document.getElementById('quantidade-compras').value = 0;
    document.getElementById('estoque-minimo-compras').value = 0;
});

function filterSetor(setor) {
    filtroSetorAtivo = setor;
    
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    renderEstoque(estoqueAtual);
}

function renderEstoque(estoque) {
    console.log('=== RENDERIZANDO ESTOQUE ===');
    console.log('Itens a renderizar:', estoque.length);
    
    const tbody = document.getElementById('tbody-estoque');
    tbody.innerHTML = '';
    
    let estoqueFiltered = estoque;
    if (filtroSetorAtivo !== 'todos') {
        estoqueFiltered = estoque.filter(item => item.setor === filtroSetorAtivo);
        console.log('Filtrado por setor:', filtroSetorAtivo, '- Itens:', estoqueFiltered.length);
    }
    
    estoqueFiltered.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        const quantidade = parseInt(item.quantidade);
        const estoqueMinimo = parseInt(item.estoqueMinimo || 0);
        
        if (quantidade <= estoqueMinimo && estoqueMinimo > 0) {
            tr.classList.add('row-alert');
        } else if (quantidade > estoqueMinimo * 1.5) {
            tr.classList.add('row-safe');
        }
        
        const indexOriginal = estoque.indexOf(item);
        
        tr.innerHTML = `
            <td>${item.setor || '-'}</td>
            <td>${item.produto}</td>
            <td>${item.especificacao || '-'}</td>
            <td>${item.quantidade}</td>
            <td>${item.estoqueMinimo || 0}</td>
            <td>${item.ncm || '-'}</td>
            <td>${item.unidade}</td>
            <td><button class="btn-delete" onclick="deleteEstoque(${indexOriginal})">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
    
    console.log('Estoque renderizado com sucesso! Total de linhas:', tbody.children.length);
}

function renderCompras(compras) {
    const tbody = document.getElementById('tbody-compras');
    tbody.innerHTML = '';
    
    compras.forEach((compra, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${compra.setor || '-'}</td>
            <td>${compra.produto}</td>
            <td>${compra.especificacao || '-'}</td>
            <td>${compra.quantidade}</td>
            <td>${compra.ncm || '-'}</td>
            <td>${compra.unidade}</td>
            <td>R$ ${parseFloat(compra.valor).toFixed(2)}</td>
            <td><button class="btn-delete" onclick="deleteCompra(${index})">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderNecessidades() {
    const tbody = document.getElementById('tbody-necessidades');
    tbody.innerHTML = '';
    
    console.log('Verificando necessidades...');
    console.log('Estoque atual:', estoqueAtual);
    
    const necessidades = estoqueAtual.filter(item => {
        const quantidade = parseInt(item.quantidade);
        const estoqueMinimo = parseInt(item.estoqueMinimo || 0);
        const precisaReposicao = (estoqueMinimo > 0 && quantidade <= estoqueMinimo);
        
        if (precisaReposicao) {
            console.log(`${item.produto}: Qtd=${quantidade}, Min=${estoqueMinimo} - PRECISA REPOSIÇÃO`);
        }
        
        return precisaReposicao;
    });
    
    console.log('Total de produtos em necessidades:', necessidades.length);
    
    necessidades.forEach((item) => {
        const tr = document.createElement('tr');
        const quantidade = parseInt(item.quantidade);
        const estoqueMinimo = parseInt(item.estoqueMinimo);
        const faltante = Math.max(estoqueMinimo - quantidade, 0);
        
        let urgencia = '';
        let urgenciaClass = '';
        if (quantidade === 0) {
            urgencia = 'CRÍTICA';
            urgenciaClass = 'urgencia-alta';
        } else if (quantidade <= estoqueMinimo * 0.3) {
            urgencia = 'ALTA';
            urgenciaClass = 'urgencia-alta';
        } else if (quantidade <= estoqueMinimo * 0.6) {
            urgencia = 'MÉDIA';
            urgenciaClass = 'urgencia-media';
        } else {
            urgencia = 'BAIXA';
            urgenciaClass = 'urgencia-baixa';
        }
        
        tr.innerHTML = `
            <td>${item.produto}</td>
            <td>${item.setor || '-'}</td>
            <td>${quantidade}</td>
            <td>${estoqueMinimo}</td>
            <td>${faltante}</td>
            <td class="${urgenciaClass}">${urgencia}</td>
            <td><button class="btn-success" onclick="openModalCompra('${item.produto}', ${Math.max(faltante, 1)})">Comprado</button></td>
        `;
        tbody.appendChild(tr);
    });
    
    if (necessidades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum produto precisa de reposição no momento.</td></tr>';
    }
}

function openModalCompra(produto, quantidadeSugerida) {
    document.getElementById('produto-necessidade').value = produto;
    document.getElementById('quantidade-necessidade').value = quantidadeSugerida;
    document.getElementById('modal-compra').style.display = 'block';
}

function closeModal() {
    document.getElementById('modal-compra').style.display = 'none';
}

document.getElementById('form-compra-necessidade').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const produto = document.getElementById('produto-necessidade').value;
    const quantidade = document.getElementById('quantidade-necessidade').value;
    const valor = document.getElementById('valor-necessidade').value;
    
    socket.emit('comprar-necessidade', { produto, quantidade, valor });
    
    closeModal();
    e.target.reset();
});

function addKitItem() {
    const container = document.getElementById('itens-kit');
    const div = document.createElement('div');
    div.className = 'kit-item';
    div.innerHTML = `
        <input type="text" placeholder="Nome do Produto" class="kit-produto" required>
        <input type="number" placeholder="Qtd" class="kit-quantidade" min="1" value="1" required>
        <button type="button" class="btn-remove-item" onclick="removeKitItem(this)">X</button>
    `;
    container.appendChild(div);
}

function removeKitItem(button) {
    const container = document.getElementById('itens-kit');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

document.getElementById('form-kit').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('nome-kit').value;
    const descricao = document.getElementById('descricao-kit').value;
    
    const itensElements = document.querySelectorAll('.kit-item');
    const itens = [];
    
    itensElements.forEach(item => {
        const produto = item.querySelector('.kit-produto').value;
        const quantidade = item.querySelector('.kit-quantidade').value;
        if (produto && quantidade) {
            itens.push({ produto, quantidade });
        }
    });
    
    if (itens.length === 0) {
        alert('Adicione pelo menos um item ao kit!');
        return;
    }
    
    const kit = { nome, descricao, itens };
    socket.emit('add-kit', kit);
    
    e.target.reset();
    document.getElementById('itens-kit').innerHTML = `
        <div class="kit-item">
            <input type="text" placeholder="Nome do Produto" class="kit-produto" required>
            <input type="number" placeholder="Qtd" class="kit-quantidade" min="1" value="1" required>
            <button type="button" class="btn-remove-item" onclick="removeKitItem(this)">X</button>
        </div>
    `;
});

function renderKits(kits) {
    const container = document.getElementById('lista-kits');
    container.innerHTML = '';
    
    if (kits.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum kit cadastrado ainda.</p>';
        return;
    }
    
    kits.forEach((kit, index) => {
        const div = document.createElement('div');
        div.className = 'kit-card';
        
        let custoTotal = 0;
        let itensHtml = '<ul>';
        kit.itens.forEach(item => {
            const produtoEstoque = estoqueAtual.find(e => e.produto.toLowerCase() === item.produto.toLowerCase());
            const precoMedio = produtoEstoque ? parseFloat(produtoEstoque.precoMedio || 0) : 0;
            const custoItem = precoMedio * parseInt(item.quantidade);
            custoTotal += custoItem;
            
            itensHtml += `<li>• ${item.quantidade}x ${item.produto}`;
            if (precoMedio > 0) {
                itensHtml += ` - R$ ${custoItem.toFixed(2)}`;
            }
            itensHtml += `</li>`;
        });
        itensHtml += '</ul>';
        
        let custoHtml = '';
        if (custoTotal > 0) {
            custoHtml = `<p style="font-weight: bold; color: #667eea; font-size: 1.1em;">Custo Total Estimado: R$ ${custoTotal.toFixed(2)}</p>`;
        }
        
        div.innerHTML = `
            <h3>${kit.nome}</h3>
            <p>${kit.descricao || 'Sem descrição'}</p>
            ${itensHtml}
            ${custoHtml}
            <button class="btn-primary" onclick="produzirKit(${index})">Produzir Kit</button>
            <button class="btn-delete" onclick="deleteKit(${index})">Excluir Kit</button>
        `;
        
        container.appendChild(div);
    });
}

function produzirKit(index) {
    if (confirm('Deseja produzir este kit? Os itens serão deduzidos do estoque.')) {
        socket.emit('produzir-kit', index);
    }
}

function deleteKit(index) {
    if (confirm('Deseja excluir este kit?')) {
        socket.emit('delete-kit', index);
    }
}

function renderProjetosRetorno() {
    const container = document.getElementById('lista-projetos-retorno');
    container.innerHTML = '';
    
    if (projetosAtual.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum projeto realizado ainda.</p>';
        return;
    }
    
    projetosAtual.forEach((projeto, index) => {
        const div = document.createElement('div');
        div.className = 'projeto-retorno-card';
        
        if (projeto.retornoRealizado) {
            div.classList.add('processado');
        }
        
        let statusHtml = projeto.retornoRealizado 
            ? '<span style="color: #27ae60; font-weight: bold;">✓ Retorno Processado</span>'
            : '<span style="color: #f39c12; font-weight: bold;">⏳ Aguardando Retorno</span>';
        
        div.innerHTML = `
            <h3>${projeto.nome}</h3>
            <p><strong>Data de Produção:</strong> ${projeto.data}</p>
            <p><strong>Custo Total:</strong> R$ ${projeto.custoTotal.toFixed(2)}</p>
            <p><strong>Status:</strong> ${statusHtml}</p>
            ${!projeto.retornoRealizado ? `<button class="btn-primary" onclick="abrirModalRetorno(${index})">Processar Retorno</button>` : ''}
        `;
        
        container.appendChild(div);
    });
}

function abrirModalRetorno(indexProjeto) {
    const projeto = projetosAtual[indexProjeto];
    
    document.getElementById('index-projeto-retorno').value = indexProjeto;
    
    const infoDiv = document.getElementById('retorno-projeto-info');
    infoDiv.innerHTML = `
        <h3>${projeto.nome}</h3>
        <p><strong>Data:</strong> ${projeto.data} | <strong>Custo:</strong> R$ ${projeto.custoTotal.toFixed(2)}</p>
        <hr style="margin: 15px 0;">
    `;
    
    const itensDiv = document.getElementById('itens-retorno');
    itensDiv.innerHTML = '';
    
    projeto.itens.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'retorno-item';
        div.innerHTML = `
            <h4>${item.produto} (${item.quantidade} ${item.unidade} utilizados)</h4>
            <div class="retorno-inputs">
                <div>
                    <label>Retornou Intacta</label>
                    <input type="number" class="retorno-intacta" data-produto="${item.produto}" min="0" max="${item.quantidade}" value="0">
                </div>
                <div>
                    <label>Descartada</label>
                    <input type="number" class="retorno-descartada" data-produto="${item.produto}" min="0" max="${item.quantidade}" value="0">
                </div>
                <div>
                    <label>Danificada</label>
                    <input type="number" class="retorno-danificada" data-produto="${item.produto}" min="0" max="${item.quantidade}" value="0">
                </div>
            </div>
        `;
        itensDiv.appendChild(div);
    });
    
    document.getElementById('modal-retorno').style.display = 'block';
}

function closeModalRetorno() {
    document.getElementById('modal-retorno').style.display = 'none';
}

document.getElementById('form-retorno').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const indexProjeto = document.getElementById('index-projeto-retorno').value;
    const retornos = [];
    
    const itensRetorno = document.querySelectorAll('.retorno-item');
    itensRetorno.forEach(item => {
        const produto = item.querySelector('.retorno-intacta').dataset.produto;
        const intacta = parseInt(item.querySelector('.retorno-intacta').value) || 0;
        const descartada = parseInt(item.querySelector('.retorno-descartada').value) || 0;
        const danificada = parseInt(item.querySelector('.retorno-danificada').value) || 0;
        
        retornos.push({ produto, intacta, descartada, danificada });
    });
    
    socket.emit('retorno-evento', { indexProjeto: parseInt(indexProjeto), retornos });
});

function renderProjetosCustos() {
    const container = document.getElementById('lista-projetos-custos');
    container.innerHTML = '';
    
    if (projetosAtual.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum projeto realizado ainda.</p>';
        return;
    }
    
    const projetosOrdenados = [...projetosAtual].reverse();
    
    projetosOrdenados.forEach((projeto) => {
        const div = document.createElement('div');
        div.className = 'projeto-custo-card';
        
        let itensHtml = '<div class="itens-list">';
        projeto.itens.forEach(item => {
            const custoItem = item.precoMedio * item.quantidade;
            itensHtml += `
                <div class="item-custo">
                    <span>${item.quantidade}x ${item.produto}</span>
                    <span>R$ ${custoItem.toFixed(2)}</span>
                </div>
            `;
        });
        itensHtml += '</div>';
        
        const statusClass = projeto.retornoRealizado ? 'status-retorno' : 'status-produzido';
        const statusText = projeto.retornoRealizado ? 'Retorno Processado' : 'Produzido';
        
        div.innerHTML = `
            <h3>${projeto.nome}</h3>
            <div class="data">${projeto.data}</div>
            <div class="custo-total">R$ ${projeto.custoTotal.toFixed(2)}</div>
            <span class="status ${statusClass}">${statusText}</span>
            ${itensHtml}
        `;
        
        container.appendChild(div);
    });
}

function renderDashboard() {
    const totalItens = estoqueAtual.reduce((sum, item) => sum + parseInt(item.quantidade), 0);
    document.getElementById('total-itens').textContent = totalItens;
    
    const produtosFalta = estoqueAtual.filter(item => {
        const quantidade = parseInt(item.quantidade);
        const estoqueMinimo = parseInt(item.estoqueMinimo || 0);
        return (estoqueMinimo > 0 && quantidade <= estoqueMinimo);
    }).length;
    document.getElementById('produtos-falta').textContent = produtosFalta;
    
    const valorTotal = comprasAtual.reduce((sum, compra) => sum + parseFloat(compra.valor), 0);
    document.getElementById('valor-total').textContent = `R$ ${valorTotal.toFixed(2)}`;
}

function renderHistorico(historico) {
    const container = document.getElementById('lista-historico');
    container.innerHTML = '';
    
    if (historico.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhuma ação registrada ainda.</p>';
        return;
    }
    
    historico.forEach(item => {
        const div = document.createElement('div');
        div.className = 'historico-item';
        div.innerHTML = `
            <div class="data">${item.data}</div>
            <div class="mensagem">${item.mensagem}</div>
        `;
        container.appendChild(div);
    });
}

function deleteEstoque(index) {
    if (confirm('Deseja excluir este item do estoque?')) {
        socket.emit('delete-estoque', index);
    }
}

function deleteCompra(index) {
    if (confirm('Deseja excluir este registro de compra?')) {
        socket.emit('delete-compra', index);
    }
}

function deleteEstoque(index) {
    if (confirm('Deseja excluir este item do estoque?')) {
        socket.emit('delete-estoque', index);
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-compra');
    const modalRetorno = document.getElementById('modal-retorno');
    const modalInfo = document.getElementById('modal-info');
    const modalPaste = document.getElementById('modal-paste');
    const modalPasteCompras = document.getElementById('modal-paste-compras');
    if (event.target === modal) {
        closeModal();
    }
    if (event.target === modalRetorno) {
        closeModalRetorno();
    }
    if (event.target === modalInfo) {
        closeInfoModal();
    }
    if (event.target === modalPaste) {
        closeModalPaste();
    }
    if (event.target === modalPasteCompras) {
        closeModalPasteCompras();
    }
}
