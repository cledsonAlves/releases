// Função para buscar dados da API
async function fetchReleaseData() {
    try {
        const url = 'https://api.github.com/repos/cledsonAlves/releases/issues/9';
        const response = await fetch(url);
        const data = await response.json();
        const markdownContent = data.body;
        console.log(markdownContent);
        return parseMarkdownData(markdownContent);
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        return null;
    }
}

// Função genérica para criar gráficos usando Chart.js
function createChart(chartId, type, data, options = {}) {
    const ctx = document.getElementById(chartId).getContext('2d');
    new Chart(ctx, {
        type: type,    // Tipo do gráfico: 'pie', 'bar', 'line', etc.
        data: data,    // Dados para popular o gráfico
        options: options // Opções extras para o gráfico
    });
}

// Função para analisar os dados Markdown
function parseMarkdownData(markdownContent) {
    const lines = markdownContent.split('\n').filter(line => line.trim() !== '');
    const headerIndex = lines.findIndex(line => line.startsWith('|Release|'));
    if (headerIndex === -1) return [];

    const headers = lines[headerIndex].split('|').filter(Boolean).map(header => header.trim());
    const releases = lines.slice(headerIndex + 2).map(line => {
        const values = line.split('|').filter(Boolean).map(value => value.trim());
        if (values.length !== headers.length) return null;
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || null;
            return obj;
        }, {});
    }).filter(Boolean);

    return releases;
}

// Função para calcular quantas releases ocorreram por mês
function countReleasesByMonth(releases) {
    const releasesByMonth = {};
    const today = new Date();

    releases.forEach(release => {
        const date = new Date(release['Início do regressivo']);
        if (!isNaN(date.getTime()) && date <= today) {
            const monthYear = date.toISOString().slice(0, 7); // Formato 'YYYY-MM'

            if (!releasesByMonth[monthYear]) {
                releasesByMonth[monthYear] = 0;
            }
            releasesByMonth[monthYear]++;
        }
    });

    return releasesByMonth;
}
function calculateReleaseDurations(releases) {
    const durations = releases.map(release => {
        const regressiveStart = new Date(release['Início do regressivo']);
        const alphaSubmission = new Date(release['Envio Alpha']);
        const distributionEnd = new Date(release['Fim da distribuição']);

        const timeToAlpha = (alphaSubmission - regressiveStart) / (1000 * 60 * 60 * 24); // Em dias
        const timeToDistributionEnd = (distributionEnd - regressiveStart) / (1000 * 60 * 60 * 24); // Em dias

        return {
            releaseName: release.Release,
            plataforma: release.Plataforma,
            timeToAlpha: isNaN(timeToAlpha) ? null : timeToAlpha,
            timeToDistributionEnd: isNaN(timeToDistributionEnd) ? null : timeToDistributionEnd
        };
    });

    return durations;
}
function createTimeToAlphaChart(durations) {
    const labels = durations.map(d => `${d.releaseName} (${d.plataforma})`);
    const data = durations.map(d => d.timeToAlpha);

    createChart('timeToAlphaChart', 'bar', {
        labels: labels,
        datasets: [{
            label: 'Dias até Envio Alpha',
            data: data,
            backgroundColor: data.map(d => d <= 5 ? '#4CAF50' : '#F44336') // Verde se <= 5 dias, vermelho caso contrário
        }]
    }, {
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Dias'
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Tempo do Início do Regressivo até Envio Alpha'
            }
        }
    });
}
function createTimeToDistributionEndChart(durations) {
    const labels = durations.map(d => `${d.releaseName} (${d.plataforma})`);
    const data = durations.map(d => d.timeToDistributionEnd);

    createChart('timeToDistributionEndChart', 'bar', {
        labels: labels,
        datasets: [{
            label: 'Dias até Fim da Distribuição',
            data: data,
            backgroundColor: data.map(d => d <= 12 ? '#4CAF50' : '#F44336') // Verde se <= 12 dias, vermelho caso contrário
        }]
    }, {
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Dias'
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Tempo do Início do Regressivo até Fim da Distribuição'
            }
        }
    });
}


function createReleasesByMonthLineChart(releasesByMonth) {
    const labels = Object.keys(releasesByMonth).sort();
    const data = labels.map(label => releasesByMonth[label]);

    createChart('releasesByMonthLineChart', 'line', {
        labels: labels,
        datasets: [{
            label: 'Releases por Mês',
            data: data,
            borderColor: '#36A2EB',
            fill: false
        }]
    }, {
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Mês'
                }
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Número de Releases'
                }
            }
        }
    });
}


function countReleasesByMonthAndPlatform(releases) {
    const data = {};
    const today = new Date();

    releases.forEach(release => {
        const date = new Date(release['Início do regressivo']);
        if (!isNaN(date.getTime()) && date <= today) {
            const monthYear = date.toISOString().slice(0, 7); // 'YYYY-MM'
            const platform = release.Plataforma;

            if (!data[monthYear]) {
                data[monthYear] = {};
            }
            if (!data[monthYear][platform]) {
                data[monthYear][platform] = 0;
            }
            data[monthYear][platform]++;
        }
    });

    return data;
}



// Função para criar o gráfico de releases por mês
function createReleasesByMonthChart(releasesByMonth) {
    const labels = Object.keys(releasesByMonth);
    const data = Object.values(releasesByMonth);

    createChart('releasesByMonthChart', 'bar', {
        labels: labels,
        datasets: [{
            label: 'Releases por Mês',
            data: data,
            backgroundColor: '#36A2EB'
        }]
    });
}

function createStackedBarChart(data) {
    const labels = Object.keys(data).sort();
    const platforms = [...new Set(Object.values(data).flatMap(monthData => Object.keys(monthData)))];

    const datasets = platforms.map(platform => {
        return {
            label: platform,
            data: labels.map(label => data[label][platform] || 0),
            backgroundColor: platform === 'Android' ? '#4CAF50' : '#2196F3'
        };
    });

    createChart('stackedBarChart', 'bar', {
        labels: labels,
        datasets: datasets
    }, {
        scales: {
            x: {
                stacked: true,
                title: {
                    display: true,
                    text: 'Mês'
                }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Número de Releases'
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Releases por Mês e Plataforma'
            }
        }
    });
}


// Função para processar os dados e criar os gráficos
function processData(releases) {
    // Funções existentes
    const statusData = countReleaseStatus(releases);
    const platformData = countPlatforms(releases);
    const canceledByPlatformData = countCanceledByPlatform(releases);
    const okrProgress = calculateOKRProgress(releases);

    // Novas contagens
    const releasesByMonth = countReleasesByMonth(releases);
    const releasesByMonthAndPlatform = countReleasesByMonthAndPlatform(releases);

    // Cálculo dos tempos para as metas
    const releaseDurations = calculateReleaseDurations(releases);

    // Criação de gráficos existentes
    createStatusChart(statusData);
    createPlatformChart(platformData);
    createSuccessRateChart(statusData);
    createCanceledByPlatformChart(canceledByPlatformData);
    createOKRCharts(okrProgress);
    createTimeline(releases);

    // Criação dos novos gráficos
    createReleasesByMonthChart(releasesByMonth);
    createReleasesByMonthLineChart(releasesByMonth);
    createStackedBarChart(releasesByMonthAndPlatform);

    // Novos gráficos para as metas
    createTimeToAlphaChart(releaseDurations);
    createTimeToDistributionEndChart(releaseDurations);
}



// Funções auxiliares para processamento de dados
function countReleaseStatus(releases) {
    const status = { Concluída: 0, Cancelada: 0, 'Em andamento': 0 };
    releases.forEach(release => {
        if (release.Status === 'Concluída') status.Concluída++;
        else if (release.Status === 'Cancelada') status.Cancelada++;
        else status['Em andamento']++;
    });
    return status;
}

function countPlatforms(releases) {
    return releases.reduce((count, release) => {
        count[release.Plataforma] = (count[release.Plataforma] || 0) + 1;
        return count;
    }, {});
}

function calculateReleaseTimes(releases) {
    return releases.map(release => {
        const start = new Date(release['Início do regressivo']);
        const end = new Date(release['Fim da distribuição']);
        return (end - start) / (1000 * 60 * 60 * 24); // Dias
    }).filter(time => !isNaN(time));
}

function countCanceledByPlatform(releases) {
    return releases.reduce((count, release) => {
        if (release.Status === 'Cancelada') {
            count[release.Plataforma] = (count[release.Plataforma] || 0) + 1;
        }
        return count;
    }, {});
}

function calculateOKRProgress(releases) {
    const storeSubmissionTimes = [];
    const fullRolloutTimes = [];

    releases.forEach(release => {
        const regressiveStart = new Date(release['Início do regressivo']);
        const alphaSubmission = new Date(release['Envio Alpha']);
        const distributionEnd = new Date(release['Fim da distribuição']);

        if (!isNaN(regressiveStart) && !isNaN(alphaSubmission)) {
            storeSubmissionTimes.push((alphaSubmission - regressiveStart) / (1000 * 60 * 60 * 24));
        }

        if (!isNaN(regressiveStart) && !isNaN(distributionEnd)) {
            fullRolloutTimes.push((distributionEnd - regressiveStart) / (1000 * 60 * 60 * 24));
        }
    });

    return {
        storeSubmission: storeSubmissionTimes.reduce((a, b) => a + b, 0) / storeSubmissionTimes.length,
        fullRollout: fullRolloutTimes.reduce((a, b) => a + b, 0) / fullRolloutTimes.length
    };
}

// Funções para criar os gráficos
function createStatusChart(data) {
    createChart('statusChart', 'pie', {
        labels: Object.keys(data),
        datasets: [{
            data: Object.values(data),
            backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56']
        }]
    });
}

function createPlatformChart(data) {
    createChart('platformChart', 'bar', {
        labels: Object.keys(data),
        datasets: [{
            label: 'Releases',
            data: Object.values(data),
            backgroundColor: ['#4CAF50', '#2196F3']
        }]
    });
}

// Função para criar o gráfico de linha do tempo de releases como barras horizontais
function createTimeline(releases) {
    const labels = releases.map(release => `${release.Release} (${release.Plataforma})`);
    const startDates = releases.map(release => new Date(release['Início do regressivo']).getTime());
    const endDates = releases.map(release => new Date(release['Fim da distribuição']).getTime());

    const today = new Date().getTime();

    // Filtra releases apenas até hoje
    const validReleases = releases.filter(release => new Date(release['Início do regressivo']) <= today);

    const durations = validReleases.map(release => {
        const start = new Date(release['Início do regressivo']);
        const end = new Date(release['Fim da distribuição']);
        return (end - start) / (1000 * 60 * 60 * 24); // Duração em dias
    });

    const ctx = document.getElementById('timelineChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duração (dias)',
                data: durations,
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            indexAxis: 'y',  // Transforma o gráfico em barras horizontais
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Dias'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Linha do Tempo de Releases (em dias)'
                }
            }
        }
    });
}


function createSuccessRateChart(data) {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const successRate = data.Concluída / total;
    createChart('successRateChart', 'doughnut', {
        labels: ['Sucesso', 'Falha'],
        datasets: [{
            data: [successRate, 1 - successRate],
            backgroundColor: ['#4CAF50', '#F44336']
        }]
    });
}

function createCanceledByPlatformChart(data) {
    createChart('canceledByPlatformChart', 'pie', {
        labels: Object.keys(data),
        datasets: [{
            data: Object.values(data),
            backgroundColor: ['#4CAF50', '#2196F3']
        }]
    });
}

function createOKRCharts(data) {
    createGaugeChart('okrStoreChart', data.storeSubmission, 5, 10);
    createGaugeChart('okrRolloutChart', data.fullRollout, 15, 30);
}

function createGaugeChart(id, value, target, max) {
    createChart(id, 'doughnut', {
        datasets: [{
            data: [value, max - value],
            backgroundColor: [value <= target ? '#4CAF50' : '#FFA000', '#e0e0e0'],
            circumference: 180,
            rotation: 270,
        }]
    }, {
        plugins: {
            datalabels: {
                formatter: () => `${value.toFixed(1)} dias`,
                color: '#000',
                font: { size: 20 },
                anchor: 'end',
                align: 'start',
            }
        },
        title: {
            display: true,
            text: `Meta: ${target} dias`,
            position: 'bottom'
        }
    });
}

function createTimeline(releases) {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = ''; // Limpa o conteúdo existente

    releases.forEach(release => {
        const releaseElement = document.createElement('div');
        releaseElement.className = 'release';
        releaseElement.style.left = `${getDatePosition(release['Início do regressivo'], releases)}%`;
        releaseElement.style.width = `${getDateWidth(release['Início do regressivo'], release['Fim da distribuição'], releases)}%`;
        releaseElement.textContent = `${release.Release} (${release.Plataforma})`;
        timeline.appendChild(releaseElement);
    });
}

function getDatePosition(dateString, releases) {
    const date = new Date(dateString);
    const minDate = new Date(Math.min(...releases.map(r => new Date(r['Início do regressivo']))));
    const maxDate = new Date(Math.max(...releases.map(r => new Date(r['Fim da distribuição']))));
    return ((date - minDate) / (maxDate - minDate)) * 100;
}

function getDateWidth(startDateString, endDateString, releases) {
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);
    const minDate = new Date(Math.min(...releases.map(r => new Date(r['Início do regressivo']))));
    const maxDate = new Date(Math.max(...releases.map(r => new Date(r['Fim da distribuição']))));
    const totalDuration = maxDate - minDate;
    return ((endDate - startDate) / totalDuration) * 100;
}

// Função principal para inicializar o dashboard
async function initDashboard() {
    const releaseData = await fetchReleaseData();
    if (releaseData) {
        processData(releaseData);
    } else {
        console.error('Não foi possível carregar os dados das releases.');
    }
}

// Inicializa o dashboard quando a página carrega
window.addEventListener('load', initDashboard);
