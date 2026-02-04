/* 
 * ==============================================================
 *  TERMO CLONE - ENGINE PRINCIPAL
 *  Desenvolvido com foco em Clean Code, Arquitetura Baseada em Estado
 *  e UX (Experiência de Usuário) responsiva.
 * ==============================================================
 */

// Importação da base de dados de palavras
import { PALAVRAS } from './palavras.js';

// --- CONFIGURAÇÕES GLOBAIS E CONSTANTES ---
const CONFIG = {
    TAMANHO_PALAVRA: 6,      // O jogo foca em palavras de 6 letras
    MAX_TENTATIVAS: 6,       // Limite padrão de tentativas
    STORAGE_KEY_ESTADO: 'termo_vFinal_estado', // Chave para persistência do jogo
    STORAGE_KEY_STATS: 'termo_vFinal_stats',   // Chave para estatísticas
    STORAGE_KEY_THEME: 'termo_vFinal_theme',   // Chave para tema escuro
    ANIMATION_DELAY: 250     // Tempo entre revelação de cada letra (ms)
};

// --- ESTADO DA APLICAÇÃO (SINGLE SOURCE OF TRUTH) ---
// Todo o visual é derivado destas variáveis. Nunca lemos do DOM para lógica.
let estadoJogo = {
    palavraSecreta: null,    // A palavra a ser descoberta
    tentativasFeitas: [],    // Array de strings com os palpites já validados
    bufferAtual: [],         // Array de chars das letras sendo digitadas agora
    status: 'jogando',       // 'jogando' | 'vitoria' | 'derrota'
    temaEscuro: false        // Boolean para controle de tema
};

let estatisticas = {
    jogosJogados: 0,
    vitorias: 0,
    sequenciaAtual: 0,
    sequenciaMaxima: 0,
    // Distribuição de vitórias: index 0 = ganhou na 1ª, index 5 = ganhou na 6ª
    distribuicao: [0, 0, 0, 0, 0, 0]
};

// --- CACHE DE ELEMENTOS DO DOM (PERFORMANCE) ---
const dom = {
    grid: document.getElementById('grid-container'),
    teclado: document.getElementById('keyboard-container'),
    toastArea: document.getElementById('toast-container'),
    // Modais
    modalAjuda: document.getElementById('help-modal'),
    modalStats: document.getElementById('stats-modal'),
    overlays: document.querySelectorAll('.modal-overlay'),
    btnsFechar: document.querySelectorAll('.modal-close-button'),
    // Botões de Ação
    btnAjuda: document.getElementById('help-button'),
    btnStats: document.getElementById('stats-button'),
    btnCompartilhar: document.getElementById('share-button'),
    toggleTema: document.getElementById('dark-mode-toggle'),
    // Elementos de Texto de Estatísticas
    statJogos: document.getElementById('games-played'),
    statVitorias: document.getElementById('win-percentage'),
    statSequencia: document.getElementById('current-streak'),
    btnsRestart: document.querySelectorAll('.restart-game-btn')
};

/* ==============================================================
   1. INICIALIZAÇÃO E CICLO DE VIDA
   ============================================================== */

// Ponto de entrada
function inicializar() {
    carregarDadosLocais(); // Tenta recuperar progresso salvo
    aplicarTemaVisual();   // Aplica Dark/Light mode

    if (!estadoJogo.palavraSecreta) {
        // Se não tem jogo salvo, começa um novo
        iniciarNovoJogo();
    } else {
        // Se tem, restaura a grade visualmente
        restaurarJogoSalvo();
    }

    // Gera os botões do teclado virtual apenas uma vez
    construirTecladoVirtual();
    
    // Sincroniza as cores do teclado caso já tenhamos jogadas
    estadoJogo.tentativasFeitas.forEach(palavra => atualizarCoresTeclado(palavra));

    // Exibe tutorial na primeira visita
    if (!localStorage.getItem('tutorial_visto')) {
        toggleModal(dom.modalAjuda, true);
        localStorage.setItem('tutorial_visto', 'true');
    } else if (estadoJogo.status !== 'jogando') {
        // Se recarregou a página e o jogo já tinha acabado, mostra stats
        setTimeout(() => toggleModal(dom.modalStats, true), 1000);
    }

    registrarEventos();
}

function iniciarNovoJogo() {
    // Escolhe palavra aleatória
    const indice = Math.floor(Math.random() * PALAVRAS.length);
    estadoJogo.palavraSecreta = PALAVRAS[indice];
    
    // Reseta estado
    estadoJogo.tentativasFeitas = [];
    estadoJogo.bufferAtual = [];
    estadoJogo.status = 'jogando';
    
    salvarEstado();
    criarGradeVazia();
    limparCoresTeclado();
    
    console.log(`Debug (Desenvolvimento): Palavra é ${estadoJogo.palavraSecreta}`);
}

/* ==============================================================
   2. CONTROLE DE ENTRADA (CONTROLLER)
   ============================================================== */

/**
 * Função central que decide o que fazer com uma tecla pressionada.
 * Aceita entradas do teclado físico e cliques virtuais.
 */
function processarInput(tecla) {
    if (estadoJogo.status !== 'jogando') return;

    // Normalização
    tecla = tecla.toUpperCase();
    if (tecla === '⌫') tecla = 'BACKSPACE';

    if (tecla === 'ENTER') {
        tentarSubmeterPalavra();
    } else if (tecla === 'BACKSPACE') {
        removerLetraDoBuffer();
    } else if (eLetraValida(tecla)) {
        adicionarLetraAoBuffer(tecla);
    }
}

function adicionarLetraAoBuffer(letra) {
    if (estadoJogo.bufferAtual.length < CONFIG.TAMANHO_PALAVRA) {
        estadoJogo.bufferAtual.push(letra);
        renderizarLinhaAtiva();
    }
}

function removerLetraDoBuffer() {
    if (estadoJogo.bufferAtual.length > 0) {
        estadoJogo.bufferAtual.pop();
        renderizarLinhaAtiva();
    }
}

async function tentarSubmeterPalavra() {
    // 1. Validação de Tamanho
    if (estadoJogo.bufferAtual.length !== CONFIG.TAMANHO_PALAVRA) {
        mostrarNotificacao("Palavra incompleta");
        animarShakeErro();
        return;
    }

    const palavraTentada = estadoJogo.bufferAtual.join("");

    // 2. Validação de Dicionário
    if (!PALAVRAS.includes(palavraTentada)) {
        mostrarNotificacao("Palavra não existe");
        animarShakeErro();
        return;
    }

    // 3. Processar Jogada Válida
    estadoJogo.tentativasFeitas.push(palavraTentada);
    estadoJogo.bufferAtual = []; // Limpa input
    salvarEstado();

    // Inicia a animação de revelação
    const indiceLinha = estadoJogo.tentativasFeitas.length - 1;
    await animarRevelacao(indiceLinha, palavraTentada);
    
    // Atualiza cores do teclado APÓS revelar
    atualizarCoresTeclado(palavraTentada);

    // 4. Verificação de Vitória/Derrota
    verificarFimDeJogo(palavraTentada);
}

function verificarFimDeJogo(palavra) {
    if (palavra === estadoJogo.palavraSecreta) {
        estadoJogo.status = 'vitoria';
        salvarEstado();
        processarVitoria();
    } else if (estadoJogo.tentativasFeitas.length >= CONFIG.MAX_TENTATIVAS) {
        estadoJogo.status = 'derrota';
        salvarEstado();
        processarDerrota();
    }
}

function processarVitoria() {
    atualizarEstatisticas(true);
    const msgs = ["Gênio!", "Magnífico!", "Impressionante!", "Esplêndido!", "Muito bom!", "Ufa!"];
    const indiceMsg = estadoJogo.tentativasFeitas.length - 1;
    
    mostrarNotificacao(msgs[indiceMsg] || "Parabéns!", 3000);
    
    // Animação de comemoração
    setTimeout(() => animarVitoria(), CONFIG.ANIMATION_DELAY);
    // Abre modal de stats
    setTimeout(() => toggleModal(dom.modalStats, true), 2000);
}

function processarDerrota() {
    atualizarEstatisticas(false);
    mostrarNotificacao(estadoJogo.palavraSecreta, -1); // Fica na tela
    setTimeout(() => toggleModal(dom.modalStats, true), 2500);
}

/* ==============================================================
   3. LÓGICA DO JOGO (ENGINE DE CORES)
   ============================================================== */

/**
 * Retorna um array de estados ['correct', 'present', 'absent']
 * Trata corretamente letras duplicadas.
 */
function calcularStatusLetras(palavraChute) {
    const alvoArr = estadoJogo.palavraSecreta.split('');
    const chuteArr = palavraChute.split('');
    const resultado = new Array(CONFIG.TAMANHO_PALAVRA).fill('absent');
    const letrasDisponiveis = {};

    // Mapa de frequência da palavra secreta
    alvoArr.forEach(l => letrasDisponiveis[l] = (letrasDisponiveis[l] || 0) + 1);

    // Passada 1: Prioridade para ACERTOS (Verde/Correct)
    chuteArr.forEach((letra, i) => {
        if (letra === alvoArr[i]) {
            resultado[i] = 'correct';
            letrasDisponiveis[letra]--;
        }
    });

    // Passada 2: Checar por PRESENÇAS (Amarelo/Present)
    chuteArr.forEach((letra, i) => {
        if (resultado[i] !== 'correct' && letrasDisponiveis[letra] > 0) {
            resultado[i] = 'present';
            letrasDisponiveis[letra]--;
        }
    });

    return resultado;
}

/* ==============================================================
   4. MANIPULAÇÃO DO DOM & RENDERIZAÇÃO
   ============================================================== */

function criarGradeVazia() {
    dom.grid.innerHTML = '';
    for (let i = 0; i < CONFIG.MAX_TENTATIVAS; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.id = `row-${i}`; // ID para facilitar busca
        
        for (let j = 0; j < CONFIG.TAMANHO_PALAVRA; j++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            row.appendChild(tile);
        }
        dom.grid.appendChild(row);
    }
}

function construirTecladoVirtual() {
    dom.teclado.innerHTML = '';
    // Layout QWERTY padrão + controles
    const layout = [
        "Q W E R T Y U I O P",
        "A S D F G H J K L",
        "ENTER Z X C V B N M ⌫"
    ];

    layout.forEach(linha => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        
        linha.split(' ').forEach(tecla => {
            const btn = document.createElement('button');
            btn.className = 'key';
            
            // Texto visível vs Dado lógico
            const textoDisplay = tecla;
            const valorLogico = tecla === '⌫' ? 'BACKSPACE' : tecla;

            if (tecla === 'ENTER' || tecla === '⌫') btn.classList.add('large');

            btn.textContent = textoDisplay;
            btn.dataset.key = valorLogico; // Para busca via seletor CSS

            // Acessibilidade
            if(tecla === '⌫') btn.setAttribute('aria-label', 'Apagar letra');
            if(tecla === 'ENTER') btn.setAttribute('aria-label', 'Confirmar palavra');

            rowDiv.appendChild(btn);
        });
        dom.teclado.appendChild(rowDiv);
    });
}

/**
 * Atualiza visualmente a linha atual enquanto o usuário digita
 */
function renderizarLinhaAtiva() {
    const indice = estadoJogo.tentativasFeitas.length;
    const row = document.getElementById(`row-${indice}`);
    const tiles = row.children;

    // Limpa estado anterior visual da linha
    Array.from(tiles).forEach(t => {
        t.textContent = '';
        t.removeAttribute('data-state');
        t.style.animation = 'none'; // Reseta animação pop
    });

    // Preenche com o buffer
    estadoJogo.bufferAtual.forEach((letra, i) => {
        const t = tiles[i];
        t.textContent = letra;
        t.dataset.state = 'tbd'; // 'To Be Determined' (estado de digitação)
        t.style.animation = 'pop 0.1s ease-in forwards'; 
    });
}

function restaurarJogoSalvo() {
    criarGradeVazia();
    
    // Repinta tentativas anteriores estaticamente
    estadoJogo.tentativasFeitas.forEach((palavra, i) => {
        const row = document.getElementById(`row-${i}`);
        const cores = calcularStatusLetras(palavra);
        
        Array.from(row.children).forEach((tile, j) => {
            tile.textContent = palavra[j];
            tile.dataset.state = cores[j];
        });
    });

    // Se o jogo ainda está ativo, renderiza o que o usuário já tinha digitado
    if (estadoJogo.status === 'jogando') {
        renderizarLinhaAtiva();
    }
}

/* ==============================================================
   5. ANIMAÇÕES & EFEITOS VISUAIS
   ============================================================== */

/**
 * Anima a linha de tiles girando (Flip) em cascata.
 * Retorna uma Promise para podermos aguardar o fim da animação.
 */
function animarRevelacao(indiceLinha, palavra) {
    return new Promise(resolve => {
        const row = document.getElementById(`row-${indiceLinha}`);
        const tiles = row.children;
        const cores = calcularStatusLetras(palavra);

        Array.from(tiles).forEach((tile, i) => {
            setTimeout(() => {
                tile.classList.add('flip-in');
                
                // No meio do giro (125ms), trocamos a cor e a letra vira
                setTimeout(() => {
                    tile.dataset.state = cores[i];
                    tile.classList.remove('flip-in');
                    tile.classList.add('flip-out');
                }, 125);

            }, i * 200); // Cascata de 200ms
        });

        // Resolve a promise após a última animação
        const tempoTotal = (CONFIG.TAMANHO_PALAVRA * 200) + 400;
        setTimeout(resolve, tempoTotal);
    });
}

function animarShakeErro() {
    const row = document.getElementById(`row-${estadoJogo.tentativasFeitas.length}`);
    if (row) {
        row.classList.remove('shake');
        void row.offsetWidth; // Força reflow do CSS para reiniciar anim
        row.classList.add('shake');
    }
}

function animarVitoria() {
    // Pega a linha da vitória
    const row = document.getElementById(`row-${estadoJogo.tentativasFeitas.length - 1}`);
    Array.from(row.children).forEach((t, i) => {
        setTimeout(() => t.classList.add('dance'), i * 100);
    });
}

/**
 * Feedback Visual Sincronizado:
 * Faz a tecla virtual "pulsar" quando pressionada no teclado físico.
 */
function simularCliqueTecladoFisico(tecla) {
    const btn = document.querySelector(`.key[data-key="${tecla}"]`);
    if (btn) {
        btn.classList.remove('active-pulse'); // Remove classe anterior
        void btn.offsetWidth; // Force Reflow
        btn.classList.add('active-pulse'); // Reaplica animação CSS
        
        // Remove a classe após curto período para limpeza
        setTimeout(() => btn.classList.remove('active-pulse'), 150);
    }
}

function atualizarCoresTeclado(palavra) {
    const cores = calcularStatusLetras(palavra);
    
    palavra.split('').forEach((letra, i) => {
        const btn = document.querySelector(`.key[data-key="${letra}"]`);
        if (!btn) return;

        const corNova = cores[i];
        const corAtual = btn.dataset.state || '';
        
        // Hierarquia de prioridade: correct > present > absent > null
        const niveis = { 'correct': 3, 'present': 2, 'absent': 1, '': 0 };

        if (niveis[corNova] > niveis[corAtual]) {
            btn.dataset.state = corNova;
            // Adiciona transição suave via JS inline se necessário, mas CSS resolve
        }
    });
}

function limparCoresTeclado() {
    document.querySelectorAll('.key').forEach(k => k.removeAttribute('data-state'));
}

/* ==============================================================
   6. GERENCIAMENTO DE MODAIS, NOTIFICAÇÕES & TEMA
   ============================================================== */

function toggleModal(modal, mostrar) {
    if (mostrar) {
        // Fecha outros primeiro para evitar sobreposição
        dom.overlays.forEach(o => o.hidden = true);
        modal.hidden = false;
        
        // Atualiza UI se for stats
        if (modal === dom.modalStats) renderizarEstatisticasUI();
    } else {
        modal.hidden = true;
    }
}

function mostrarNotificacao(msg, duracao = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    dom.toastArea.innerHTML = ''; // Evita empilhamento
    dom.toastArea.appendChild(toast);

    if (duracao > 0) {
        setTimeout(() => {
            if (dom.toastArea.contains(toast)) toast.remove();
        }, duracao);
    } else {
        // Se duração negativa, clique para fechar
        toast.style.cursor = 'pointer';
        toast.onclick = () => toast.remove();
    }
}

function aplicarTemaVisual() {
    if (estadoJogo.temaEscuro) {
        document.body.classList.add('dark-mode');
        if (dom.toggleTema) dom.toggleTema.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        if (dom.toggleTema) dom.toggleTema.checked = false;
    }
}

/* ==============================================================
   7. ESTATÍSTICAS E COMPARTILHAMENTO
   ============================================================== */

function atualizarEstatisticas(venceu) {
    estatisticas.jogosJogados++;
    if (venceu) {
        estatisticas.vitorias++;
        estatisticas.sequenciaAtual++;
        if (estatisticas.sequenciaAtual > estatisticas.sequenciaMaxima) {
            estatisticas.sequenciaMaxima = estatisticas.sequenciaAtual;
        }
        // index 0 = 1 tentativa
        estatisticas.distribuicao[estadoJogo.tentativasFeitas.length - 1]++;
    } else {
        estatisticas.sequenciaAtual = 0;
    }
    salvarStats();
}

function renderizarEstatisticasUI() {
    dom.statJogos.textContent = estatisticas.jogosJogados;
    dom.statSequencia.textContent = estatisticas.sequenciaAtual;
    
    const pct = estatisticas.jogosJogados > 0
        ? Math.round((estatisticas.vitorias / estatisticas.jogosJogados) * 100)
        : 0;
    dom.statVitorias.textContent = pct + "%";
}

function compartilharResultado() {
    const jogadaStr = estadoJogo.status === 'vitoria' 
        ? estadoJogo.tentativasFeitas.length 
        : 'X';
    
    const titulo = `Termo Clone ${jogadaStr}/${CONFIG.MAX_TENTATIVAS}`;
    
    const gradeEmoji = estadoJogo.tentativasFeitas.map(palavra => {
        const cores = calcularStatusLetras(palavra);
        return cores.map(c => {
            if (c === 'correct') return '🟩';
            if (c === 'present') return '🟨';
            return '⬛';
        }).join('');
    }).join('\n');

    const textoFinal = `${titulo}\n\n${gradeEmoji}`;

    if (navigator.share) {
        navigator.share({ title: 'Termo Clone', text: textoFinal }).catch(err => {
            console.warn('Compartilhamento cancelado', err);
        });
    } else {
        navigator.clipboard.writeText(textoFinal).then(() => {
            mostrarNotificacao('Copiado para área de transferência!');
        });
    }
}

/* ==============================================================
   8. UTILITÁRIOS & PERSISTÊNCIA
   ============================================================== */

function eLetraValida(str) {
    return /^[A-Z]$/.test(str);
}

function carregarDadosLocais() {
    const savedState = localStorage.getItem(CONFIG.STORAGE_KEY_ESTADO);
    const savedStats = localStorage.getItem(CONFIG.STORAGE_KEY_STATS);
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEY_THEME);

    if (savedState) estadoJogo = JSON.parse(savedState);
    if (savedStats) estatisticas = JSON.parse(savedStats);
    
    // Verifica tema salvo OU preferência do sistema
    if (savedTheme) {
        estadoJogo.temaEscuro = (savedTheme === 'true');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        estadoJogo.temaEscuro = true;
    }
}

function salvarEstado() {
    localStorage.setItem(CONFIG.STORAGE_KEY_ESTADO, JSON.stringify(estadoJogo));
}
function salvarStats() {
    localStorage.setItem(CONFIG.STORAGE_KEY_STATS, JSON.stringify(estatisticas));
}

/* ==============================================================
   9. REGISTRO DE EVENTOS (LISTENERS)
   ============================================================== */

function registrarEventos() {
    // 1. Teclado Físico
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return; // Ignora atalhos
        
        let key = e.key.toUpperCase();
        if (key === 'ENTER' || key === 'BACKSPACE' || eLetraValida(key)) {
            simularCliqueTecladoFisico(key === 'BACKSPACE' ? 'BACKSPACE' : key);
            processarInput(key);
        }
        
        // Fecha modais com ESC
        if (e.key === 'Escape') {
            dom.overlays.forEach(o => o.hidden = true);
        }
    });

    // 2. Teclado Virtual (Delegação de Eventos para Performance)
    dom.teclado.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            // Evita foco persistente no botão após clique
            e.preventDefault(); 
            btn.blur();
            processarInput(btn.dataset.key);
        }
    });

    // 3. UI Toggle Tema
    if (dom.toggleTema) {
        dom.toggleTema.addEventListener('change', (e) => {
            estadoJogo.temaEscuro = e.target.checked;
            aplicarTemaVisual();
            localStorage.setItem(CONFIG.STORAGE_KEY_THEME, estadoJogo.temaEscuro);
        });
    }

    // 4. Botões de Modal e Header
    dom.btnAjuda.addEventListener('click', () => toggleModal(dom.modalAjuda, true));
    dom.btnStats.addEventListener('click', () => toggleModal(dom.modalStats, true));
    dom.btnCompartilhar.addEventListener('click', compartilharResultado);

    const botoesReiniciar = document.querySelectorAll('.restart-game-btn');
    botoesReiniciar.forEach(btn => {
        btn.addEventListener('click', () => {
            // Se o jogo está em andamento, pede confirmação
            if (estadoJogo.status === 'jogando' && estadoJogo.tentativasFeitas.length > 0) {
                if (confirm("Você quer mesmo começar um novo jogo? O progresso atual será perdido.")) {
                    iniciarNovoJogo();
                    // Garante que o modal de estatísticas feche caso esteja aberto
                    toggleModal(dom.modalStats, false); 
                }
            } else {
                // Se o jogo já acabou, reinicia direto sem perguntar
                iniciarNovoJogo();
                toggleModal(dom.modalStats, false);
            }
        });
    });

    // 5. Fechar Modais (X ou Fundo Escuro)
    dom.btnsFechar.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita bubble para o overlay
            btn.closest('.modal-overlay').hidden = true;
        });
    });
    
    dom.overlays.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.hidden = true;
            }
        });
    });
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', inicializar);