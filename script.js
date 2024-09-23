const TOKEN_GENERIC = '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';

const OWNER = 'cledsonAlves';
const REPO = 'releases';
const LABEL = '[Android]-R100';
const ISSUE_NUMBER = 6;
const REPO_DOCS = 'cledsonAlves/releases';
const REPO_ISSUES = 'cledsonAlves/releases';
let tableBody;
let postmortemTableBody;

// Função principal
async function main() {
    try {
        addDebugLog('Iniciando o processo principal');
        tableBody = document.querySelector('#squadTable tbody');
        postmortemTableBody = document.querySelector('#postmortemTable tbody');
        if (!tableBody || !postmortemTableBody) {
            throw new Error('Elementos tbody não encontrados');
        }
        addDebugLog('Elementos tbody encontrados');

        const issue6Content = await getIssue6Content();
        addDebugLog(`Conteúdo da issue 6 obtido: ${issue6Content.substring(0, 100)}...`);

        if (issue6Content.trim() === '') {
            addDebugLog('Issue 6 está vazia. Carregando issues e criando tabela');
            await loadIssuesAndCreateTable();
        } else {
            addDebugLog('Carregando tabela a partir do conteúdo da issue 6');
            loadTableFromIssue6(issue6Content);
        }
        loadPostmortemTableFromIssue6(issue6Content);
        addDebugLog('Processo principal concluído com sucesso');
    } catch (error) {
        console.error(`Erro: ${error.message}`);
        addDebugLog(`Erro encontrado: ${error.message}`);
    }
}

async function readSquadsCSV() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/cledsonAlves/releases/main/squads.csv');
        if (!response.ok) {
            throw new Error('Erro ao buscar o CSV do GitHub');
        }
        const csvText = await response.text();

        const lines = csvText.split('\n');
        const squads = {};
        lines.forEach(line => {
            const [squad, modulos] = line.split(';');
            if (squad && modulos) {
                squads[squad.trim()] = modulos.replace(/"/g, '').split(',').map(m => m.trim()).filter(m => m !== '');
            }
        });
        addDebugLog(`Squads lidas do CSV: ${JSON.stringify(squads)}`);
        return squads;
    } catch (error) {
        console.error('Erro ao ler o arquivo CSV:', error);
        addDebugLog(`Erro ao ler o arquivo CSV: ${error.message}`);
        return {};
    }
}


// Função para verificar se squads de um módulo precisam testar
function verificarSquadsParaTestar(squads, modulo) {
    const squadsDessecModulo = Object.entries(squads).filter(([_, modulos]) => modulos.includes(modulo) || modulos.includes('todos'));
    const moduloTemEntrega = squadsDessecModulo.some(([squad]) => {
        const row = Array.from(tableBody.rows).find(row => row.cells[2].textContent.trim().includes(squad));
        return row && row.cells[1].textContent.trim() !== 'Não Iniciado';
    });

    if (moduloTemEntrega) {
        squadsDessecModulo.forEach(([squad]) => {
            console.log(`${squad} precisa testar porque houve entrega no módulo ${modulo}.`);
        });
    }
    }


// Função para carregar e criar a tabela
async function loadIssuesAndCreateTable() {
    const issues = await fetchIssuesWithLabel();
    addDebugLog(`Issues encontradas: ${issues.length}`);
    const squads = await readSquadsCSV();
    addDebugLog(`Squads lidas do CSV: ${Object.keys(squads).length}`);

    // Criar tabela a partir das issues
    createTableFromIssues(issues, squads);

    // Após a criação da tabela, verificar se squads de um mesmo módulo precisam testar
    const modulos = [...new Set(Object.values(squads).flat())];
    modulos.forEach(modulo => verificarSquadsParaTestar(squads, modulo));

    // Salvar a tabela completa na issue 6
    await saveFullTableToIssue6();
}

async function getIssue6Content() {
    const response = await fetch(`https://api.github.com/repos/${REPO_ISSUES}/issues/${ISSUE_NUMBER}`, {
        headers: { 'Authorization': `Bearer ${TOKEN_GENERIC}` }
    });
    const issueData = await response.json();
    const bodyContent = issueData.body || '';

    // Extrair o valor de start:YYYY-MM-DDTHH:MM:SS
    const startTimeMatch = bodyContent.match(/start:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);

    if (startTimeMatch) {
        const startTime = new Date(startTimeMatch[1]);

        // Armazenar o tempo de início no localStorage
        localStorage.setItem('slaStartTime', startTime.toISOString());

        // Calcular o tempo restante do SLA
        const remainingSLA = calculateRemainingSLA(startTime);
        startSLAClock(remainingSLA);
    } else {
        console.error("Erro: Label 'start' não encontrada no conteúdo da issue.");
    }

    return bodyContent;
}

// Função para calcular o tempo restante do SLA
function calculateRemainingSLA(startTime) {
    const now = new Date();
    const elapsedSeconds = Math.floor((now - new Date(startTime)) / 1000);
    const slaDuration = 24 * 60 * 60; // 24 horas em segundos
    return slaDuration - elapsedSeconds;
}

// Função para iniciar o SLA clock
function startSLAClock(duration) {
    let timer = duration;
    const clockElement = document.getElementById('slaClock');
    let clockInterval;

    function updateClock() {
        const hours = Math.floor(timer / 3600);
        const minutes = Math.floor((timer % 3600) / 60);
        const seconds = timer % 60;

        clockElement.textContent = `Tempo restante para o término: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (--timer < 0) {
            clockElement.textContent = 'Tempo esgotado!';
            clearInterval(clockInterval);
        }
    }

    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

// Inicialização com recuperação do localStorage
document.addEventListener('DOMContentLoaded', () => {
    main();

    // Recuperar o tempo de início armazenado no localStorage
    const storedStartTime = localStorage.getItem('slaStartTime');
    if (storedStartTime) {
        const remainingSLA = calculateRemainingSLA(new Date(storedStartTime));
        if (remainingSLA > 0) {
            startSLAClock(remainingSLA);
        } else {
            document.getElementById('slaClock').textContent = 'Tempo esgotado!';
        }
    }
});

// Atualização da issue
async function updateIssue6Content(content) {
    if (content.trim() === '') {
        console.error('Conteúdo vazio. Não será atualizada a issue 6.');
        return;
    }

    const response = await fetch(`https://api.github.com/repos/${REPO_ISSUES}/issues/${ISSUE_NUMBER}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${TOKEN_GENERIC}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body: content })
    });

    if (!response.ok) {
        throw new Error('Falha ao atualizar o conteúdo da issue');
    }
}

// Adicione logs para debug
function addDebugLog(message) {
    console.log(`DEBUG: ${message}`);
}


async function fetchIssuesWithLabel() {
    const response = await fetch(`https://api.github.com/repos/${REPO_ISSUES}/issues?labels=${LABEL}&state=all`, {
        headers: { 'Authorization': `Bearer ${TOKEN_GENERIC}` }
    });
    const issues = await response.json();
    console.log(issues);
    return issues;
}

function createTableFromIssues(issues, squads) {
    tableBody.innerHTML = '';
    let rowsAdded = 0;

    // Usar um conjunto para armazenar combinações únicas de módulo + squad
    const linhasAdicionadas = new Set();

    issues.forEach(issue => {
        const moduleMatch = issue.body ? issue.body.match(/- Nome do módulo\s*:\s*([^\n]+)/) : null;
        const squadMatch = issue.body ? issue.body.match(/- Squad\s*:\s*(.+)/) : null;

        const modulo = moduleMatch ? moduleMatch[1].trim() : 'Não especificado';
        const issueSquad = squadMatch ? squadMatch[1].trim() : 'Não especificado';

        addDebugLog(`Processando issue: ${issue.number}, Módulo: ${modulo}, Squad: ${issueSquad}`);

        // Verificar se o módulo aparece no CSV e pegar todas as squads associadas
        const squadsAssociadas = Object.entries(squads).filter(([_, modulos]) => modulos.includes(modulo));

        // Para cada squad encontrada no CSV com o mesmo módulo, adicionamos uma nova linha na tabela se ainda não foi adicionada
        squadsAssociadas.forEach(([csvSquad]) => {
            const chaveUnica = `${modulo}-${csvSquad}`;

            // Verificar se a combinação já foi adicionada ao conjunto
            if (!linhasAdicionadas.has(chaveUnica)) {
                addDebugLog(`Adicionando linha para o módulo ${modulo} e squad ${csvSquad}`);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${issue.number}</td>
                    <td>Não Iniciado</td>
                    <td>${csvSquad}</td>  <!-- Squad do CSV -->
                    <td>${modulo}</td>
                    <td class="delivery-detail">Nada a declarar</td>
                    <td><button class="edit-button">Editar</button></td>
                `;

                applyStatusColor(tr, 'Não Iniciado');
                addEditButtonListener(tr);
                tableBody.appendChild(tr);
                rowsAdded++;

                // Adiciona a combinação única ao conjunto para evitar duplicações
                linhasAdicionadas.add(chaveUnica);
            } else {
                addDebugLog(`Linha duplicada ignorada para a combinação ${chaveUnica}`);
            }
        });
    });

    addDebugLog(`Linhas adicionadas à tabela: ${rowsAdded}`);
    updateStatusTotals();
}



function checkSquadInclusion(issueSquad, issueModule, squads) {
    for (const [csvSquad, modules] of Object.entries(squads)) {
        // Verifica se o nome da squad da issue contém o nome da squad do CSV
        if (issueSquad.toUpperCase().includes(csvSquad.split('-')[1].trim().toUpperCase())) {
            // Verifica se o módulo está na lista de módulos da squad ou se a squad tem 'todos'
            if (modules.includes(issueModule) || modules.includes('todos')) {
                addDebugLog(`Match encontrado: Issue Squad: ${issueSquad}, CSV Squad: ${csvSquad}, Módulo: ${issueModule}`);
                return true;
            }
        }
    }
    return false;
}

function loadTableFromIssue6(content) {
    const lines = content.split('\n');
    const tableStartIndex = lines.findIndex(line => line.includes('| Número da Squad | Status |'));

    if (tableStartIndex === -1) {
        console.log('Tabela não encontrada na issue 6.');
        return;
    }

    tableBody.innerHTML = '';

    for (let i = tableStartIndex + 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') break;

        const [number, status, squad, modulo, detalheEntrega] = line.split('|').slice(1, -1).map(cell => cell.trim());

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${number}</td>
            <td>${status}</td>
            <td>${squad}</td>
            <td>${modulo}</td>
            <td class="delivery-detail">${detalheEntrega}</td>
            <td><button class="edit-button">Editar</button></td>
        `;

        applyStatusColor(tr, status);
        addEditButtonListener(tr);
        tableBody.appendChild(tr);
    }

    updateStatusTotals();
}

function loadPostmortemTableFromIssue6(content) {
    const lines = content.split('\n');
    const tableStartIndex = lines.findIndex(line => line.includes('| Squad | Bug | Testado em Homologação |'));

    if (tableStartIndex === -1) {
        console.log('Tabela de postmortem não encontrada na issue');
        return;
    }

    postmortemTableBody.innerHTML = '';

    for (let i = tableStartIndex + 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') break;

        const [squad, bug, testedInHomolog] = line.split('|').slice(1, -1).map(cell => cell.trim());

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${squad}</td>
            <td>${bug}</td>
            <td>${testedInHomolog}</td>
        `;

        postmortemTableBody.appendChild(tr);
    }
}

// Funções para manipulação de linhas e edição
function addEditButtonListener(row) {
    const editButton = row.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', () => toggleEditRow(editButton));
    }
}

async function toggleEditRow(button) {
    const row = button.closest('tr');
    const statusCell = row.cells[1];
    const detailCell = row.cells[4];

    if (button.innerText === 'Editar') {
        const statusSelect = document.createElement('select');
        ['Não Iniciado', 'Em andamento', 'Finalizado', 'Bloqueado'].forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.text = optionValue;
            if (statusCell.innerText === optionValue) {
                option.selected = true;
            }
            statusSelect.appendChild(option);
        });
        statusCell.innerHTML = '';
        statusCell.appendChild(statusSelect);

        const detailInput = document.createElement('textarea');
        detailInput.value = detailCell.innerText.trim();
        detailCell.innerHTML = '';
        detailCell.appendChild(detailInput);

        button.innerText = 'Salvar';
    } else {
        const statusSelect = statusCell.querySelector('select');
        const detailInput = detailCell.querySelector('textarea');

        statusCell.innerHTML = statusSelect.value;
        detailCell.innerHTML = detailInput.value;

        applyStatusColor(row, statusSelect.value);

        button.innerText = 'Editar';
        updateStatusTotals();

        await saveRowToIssue6(row);
    }
}

async function saveRowToIssue6(row) {
    try {
        const issueContent = await getIssue6Content();
        const updatedContent = updateTableRowInContent(issueContent, row);
        await updateIssue6Content(updatedContent);
        console.log('Alterações de linha salvas com sucesso na issue 6.');
    } catch (error) {
        console.error(`Erro ao salvar alterações de linha na issue: ${error.message}`);
    }
}

// Funções para salvar e atualizar conteúdo da tabela
async function saveFullTableToIssue6() {
    try {
        const tableContent = generateFullTableContent();
        if (tableContent.trim() === '') {
            console.error('A tabela está vazia. Não será salva na issue 6.');
            return;
        }
        await updateIssue6Content(tableContent);
        console.log('Tabela salva com sucesso na issue 6.');
    } catch (error) {
        console.error(`Erro ao salvar tabela na issue 6: ${error.message}`);
    }
}

function generateFullTableContent() {
    let tableContent = "| Número da Squad | Status | Squad (da Issue) | Módulo (da Issue) | Detalhe da Entrega |\n";
    tableContent += "|------------------|--------|-------------------|--------------------|--------------------|";

    const rows = tableBody.querySelectorAll('tr');
    addDebugLog(`Número de linhas na tabela: ${rows.length}`);

    if (rows.length === 0) {
        addDebugLog('Nenhuma linha encontrada na tabela.');
        return '';
    }

    rows.forEach(row => {
        const cells = row.cells;
        if (cells.length >= 5) {
            tableContent += `\n| ${cells[0].innerText} | ${cells[1].innerText} | ${cells[2].innerText} | ${cells[3].innerText} | ${cells[4].innerText} |`;
        }
    });

    addDebugLog(`Conteúdo da tabela gerado: ${tableContent}`);
    return tableContent;
}

// Função para adicionar logs de debug
function addDebugLog(message) {
    console.log(`DEBUG: ${message}`);
}

function updateTableRowInContent(content, updatedRow) {
    const lines = content.split('\n');
    const tableStartIndex = lines.findIndex(line => line.includes('| Número da Squad | Status |'));

    if (tableStartIndex === -1) {
        return content + '\n\n' + generateFullTableContent();
    }

    const updatedCells = Array.from(updatedRow.cells).map(cell => cell.innerText);
    const updatedRowIndex = lines.findIndex((line, index) =>
        index > tableStartIndex && line.includes(`| ${updatedCells[0]} |`)
    );

    if (updatedRowIndex !== -1) {
        lines[updatedRowIndex] = `| ${updatedCells.join(' | ')} |`;
    } else {
        lines.push(`| ${updatedCells.join(' | ')} |`);
    }

    return lines.join('\n');
}

// Funções auxiliares
function applyStatusColor(row, status) {
    row.classList.remove('row-in-progress', 'row-completed', 'row-blocked');
    if (status === 'Em andamento') {
        row.classList.add('row-in-progress');
    } else if (status === 'Finalizado') {
        row.classList.add('row-completed');
    } else if (status === 'Bloqueado') {
        row.classList.add('row-blocked');
    }
}

function updateStatusTotals() {
    let totalNaoIniciados = 0;
    let totalEmAndamento = 0;
    let totalFinalizados = 0;

    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const status = row.cells[1].innerText.trim();
        if (status === 'Não Iniciado') {
            totalNaoIniciados++;
        } else if (status === 'Em andamento') {
            totalEmAndamento++;
        } else if (status === 'Finalizado') {
            totalFinalizados++;
        }
    });

    const naoIniciadosElement = document.getElementById('totalNaoIniciados');
    const emAndamentoElement = document.getElementById('totalEmAndamento');
    const finalizadosElement = document.getElementById('totalFinalizados');

    if (naoIniciadosElement) naoIniciadosElement.innerText = totalNaoIniciados;
    if (emAndamentoElement) emAndamentoElement.innerText = totalEmAndamento;
    if (finalizadosElement) finalizadosElement.innerText = totalFinalizados;
}

// Inicialização
document.addEventListener('DOMContentLoaded', main);

// Implementação do chat para postmortem
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');

let postmortemState = {
    inProgress: false,
    squad: '',
    bug: '',
    testedInHomolog: ''
};

function addMessageToChat(message, isUser = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add(isUser ? 'user-message' : 'assistant-message');
    messageElement.textContent = message;
    chatBody.appendChild(messageElement);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function handleChatInput() {
    const userMessage = chatInput.value.trim();
    if (userMessage) {
        addMessageToChat(userMessage, true);
        chatInput.value = '';
        processUserInput(userMessage);
    }
}

sendButton.addEventListener('click', handleChatInput);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleChatInput();
    }
});

function processUserInput(input) {
    if (!postmortemState.inProgress) {
        if (input.toLowerCase().includes('postmortem')) {
            postmortemState.inProgress = true;
            addMessageToChat("Iniciando o processo de postmortem. Por favor, informe a squad:");
        } else {
            addMessageToChat("Olá! Como posso ajudar? Se quiser iniciar um postmortem, basta mencionar 'postmortem'.");
        }
    } else {
        if (!postmortemState.squad) {
            postmortemState.squad = input;
            addMessageToChat("Obrigado. Agora, descreva o bug encontrado:");
        } else if (!postmortemState.bug) {
            postmortemState.bug = input;
            addMessageToChat("Entendi. Este cenário foi testado em homologação? (Sim/Não)");
        } else if (!postmortemState.testedInHomolog) {
            postmortemState.testedInHomolog = input.toLowerCase() === 'sim' ? 'Sim' : 'Não';
            addMessageToChat("Obrigado pelas informações. Vou cadastrar esse bug na release.");
            cadastrarBugNaIssue6();
        }
    }
}

async function cadastrarBugNaIssue6() {
    try {
        const issueContent = await getIssue6Content();
        const updatedContent = addPostmortemToIssue6(issueContent, postmortemState);
        await updateIssue6Content(updatedContent);
        console.log('Postmortem cadastrado com sucesso na issue 6.');
        addMessageToChat("Bug cadastrado com sucesso. Deseja cadastrar outro bug?");
        resetPostmortemState();
    } catch (error) {
        console.error(`Erro ao cadastrar postmortem na issue 6: ${error.message}`);
        addMessageToChat("Ocorreu um erro ao cadastrar o bug. Por favor, tente novamente mais tarde.");
    }
}

function addPostmortemToIssue6(content, postmortemData) {
    const lines = content.split('\n');
    const postmortemTableIndex = lines.findIndex(line => line.includes('| Squad | Bug | Testado em Homologação |'));

    if (postmortemTableIndex === -1) {
        content += '\n\n## Postmortem\n\n| Squad | Bug | Testado em Homologação |\n|-------|-----|--------------------------|';
    }

    content += `\n| ${postmortemData.squad} | ${postmortemData.bug} | ${postmortemData.testedInHomolog} |`;

    return content;
}

function resetPostmortemState() {
    postmortemState = {
        inProgress: false,
        squad: '',
        bug: '',
        testedInHomolog: ''
    };
}

// Função para destacar linhas com atraso
function highlightDelayedRows() {
    const rows = tableBody.getElementsByTagName('tr');
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < rows.length; i++) {
        const statusCell = rows[i].cells[1];
        const dateCell = rows[i].cells[5]; // Assumindo que a data está na sexta coluna

        if (statusCell.textContent !== 'Finalizado') {
            const date = new Date(dateCell.textContent);
            if (date < twoDaysAgo) {
                rows[i].style.backgroundColor = '#ffcccc';
            }
        }
    }
}

// Atualizar a tabela a cada 5 minutos
setInterval(() => {
    highlightDelayedRows();
}, 5 * 60 * 1000);
