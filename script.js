const TOKEN = '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';
const OWNER = 'cledsonAlves';
const REPO = 'releases';
const LABEL_PREFIX = 'start:'; //
const ISSUE_NUMBER = 6;
let tableBody;
let postmortemTableBody;

// Função principal
async function main() {
    try {
        tableBody = document.querySelector('#squadTable tbody');
        postmortemTableBody = document.querySelector('#postmortemTable tbody');
        if (!tableBody || !postmortemTableBody) {
            throw new Error('Elementos tbody não encontrados');
        }
        const issue6Content = await getIssue6Content();
        if (issue6Content.trim() === '') {
            await loadIssuesAndCreateTable();
        } else {
            loadTableFromIssue6(issue6Content);
        }
        loadPostmortemTableFromIssue6(issue6Content);
    } catch (error) {
        console.error(`Erro: ${error.message}`);
    }
}

// Função para obter conteúdo da issue
async function getIssue6Content() {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const issueData = await response.json();
    const bodyContent = issueData.body || '';

    // Procurar a label que começa com o prefixo 'start:'
    const startLabel = issueData.labels.find(label => label.name.startsWith(LABEL_PREFIX));

    if (startLabel) {
        const startTimeString = startLabel.name.substring(LABEL_PREFIX.length);
        const startTime = new Date(startTimeString);

        if (!isNaN(startTime)) {
            // Armazenar o tempo de início no localStorage
            localStorage.setItem('slaStartTime', startTime.toISOString());

            // Calcular o tempo restante do SLA e atualizar a interface imediatamente
            const remainingSLA = calculateRemainingSLA(startTime);
            if (remainingSLA > 0) {
                startSLAClock(remainingSLA);
            } else {
                document.getElementById('slaClock').textContent = 'Tempo esgotado!';
                disableEditButtons();
            }
        } else {
            console.error("Erro: Data de início da label 'start' é inválida.");
        }
    } else {
        console.error("Erro: Label 'start' não encontrada na issue.");
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

    function updateClock() {
        const hours = Math.floor(timer / 3600);
        const minutes = Math.floor((timer % 3600) / 60);
        const seconds = timer % 60;

        clockElement.textContent = `Tempo restante para o término: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Quando o tempo restante for menor que 10 minutos, mudar a cor para vermelho
        if (timer <= 10 * 60) {
            clockElement.style.color = 'red';
        }

        // Quando o tempo acabar, desabilitar os botões
        if (--timer < 0) {
            clockElement.textContent = 'Tempo esgotado!';
            clearInterval(clockInterval);
            disableEditButtons();
        }
    }

    updateClock(); // Chamar imediatamente para exibir o tempo correto
    const clockInterval = setInterval(updateClock, 1000);
}

// Função para desabilitar todos os botões de edição quando o SLA terminar
function disableEditButtons() {
    const editButtons = document.querySelectorAll('.edit-button');
    editButtons.forEach(button => {
        button.disabled = true;
    });
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
            disableEditButtons();
        }
    }
});

// Funções para carregar e criar a tabela
async function loadIssuesAndCreateTable() {
    const issues = await fetchIssuesWithLabel();
    createTableFromIssues(issues);
    await saveFullTableToIssue6();
}

async function fetchIssuesWithLabel() {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues?labels=${LABEL_PREFIX}&state=all`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const issues = await response.json();
    return issues;
}

function createTableFromIssues(issues) {
    tableBody.innerHTML = '';
    issues.forEach(issue => {
        const tr = document.createElement('tr');
        const squadMatch = issue.body ? issue.body.match(/- Squad\s*:\s*(.+)/) : null;
        const moduleMatch = issue.body ? issue.body.match(/- Nome do módulo\s*:\s*(.+)/) : null;
        const detalheEntregaMatch = issue.body ? issue.body.match(/## Detalhe da entrega\s*([\s\S]*?)\n##/) : null;

        const squad = squadMatch ? squadMatch[1].trim() : 'Não especificado';
        const modulo = moduleMatch ? moduleMatch[1].trim() : 'Não especificado';
        const detalheEntrega = detalheEntregaMatch ? detalheEntregaMatch[1].trim() : 'Nada a declarar';

        tr.innerHTML = `
            <td>${issue.number}</td>
            <td>Não Iniciado</td>
            <td>${squad}</td>
            <td>${modulo}</td>
            <td class="delivery-detail">${detalheEntrega}</td>
            <td><button class="edit-button">Editar</button></td>
        `;

        applyStatusColor(tr, 'Não Iniciado');
        addEditButtonListener(tr);
        tableBody.appendChild(tr);
    });

    updateStatusTotals();
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
        console.log('Tabela de postmortem não encontrada na issue 6.');
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

// Aplicar cores com base no status
function applyStatusColor(row, status) {
    row.classList.remove('row-in-progress', 'row-completed', 'row-blocked');
    row.style.backgroundColor = ''; // Reset background color

    if (status === 'Em andamento') {
        row.style.backgroundColor = 'orange';
    } else if (status === 'Finalizado') {
        row.style.backgroundColor = 'green';
    } else if (status === 'Bloqueado') {
        row.style.backgroundColor = 'black';
        row.style.color = 'white'; // Texto branco para contraste no fundo preto
    }
}

async function saveRowToIssue6(row) {
    try {
        const issueContent = await getIssue6Content();
        const updatedContent = updateTableRowInContent(issueContent, row);
        await updateIssue6Content(updatedContent);
        console.log('Alterações de linha salvas com sucesso na issue 6.');
    } catch (error) {
        console.error(`Erro ao salvar alterações de linha na issue 6: ${error.message}`);
    }
}

// Funções para salvar e atualizar conteúdo da tabela
async function saveFullTableToIssue6() {
    try {
        const tableContent = generateFullTableContent();
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
    rows.forEach(row => {
        const cells = row.cells;
        tableContent += `\n| ${cells[0].innerText} | ${cells[1].innerText} | ${cells[2].innerText} | ${cells[3].innerText} | ${cells[4].innerText} |`;
    });

    return tableContent;
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
