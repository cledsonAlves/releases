const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const STACKSPOT_TOKEN_URL = 'https://idm.stackspot.com/stackspot-freemium/oidc/oauth/token';
const CLIENT_ID = 'cc9f20d3-a84f-4919-8219-507437035bf1';
const CLIENT_SECRET = '56SSE8L8F4b0SYk4A77C7JlX02Ox2lhri9DOccMVWo16zv44XCIH6CSGFjvo9DwW';

const logMessage = (message) => {
  const logDiv = document.getElementById('log');
  const timestamp = new Date().toLocaleTimeString();
  logDiv.innerHTML += `<p>[${timestamp}] ${message}</p>`;
  logDiv.scrollTop = logDiv.scrollHeight; // Scroll to the bottom of the log
};

// Função para obter o token de acesso
const getAccessToken = async () => {
  try {
    logMessage('Fetching access token...');
    const response = await fetch(CORS_PROXY + STACKSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
    });
    if (!response.ok) {
      logMessage(`Erro ao obter token: ${response.status}`);
      throw new Error('Falha ao obter o token');
    }
    const data = await response.json();
    logMessage('Access token recebido com sucesso');
    return data.access_token;
  } catch (error) {
    logMessage(`Erro: ${error.message}`);
    showError("Erro ao obter token de acesso.");
  }
};

// Função genérica para processar qualquer endpoint
const processTask = async (endpoint, accessToken, inputText) => {
  try {
    logMessage(`Enviando dados para o endpoint ${endpoint}...`);
    const response = await fetch(CORS_PROXY + endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: inputText
      })
    });

    const data = await response.text(); // Altere para response.text() se a resposta for uma string

    logMessage(`Resposta completa da API do endpoint ${endpoint}: ${data}`);

    if (!response.ok) {
      logMessage(`Erro ao processar ${endpoint}: ${response.status}`);
      throw new Error('Falha ao processar o endpoint');
    }

    logMessage(`Execution ID recebido do endpoint ${endpoint}: ${data}`);
    return data; // Retorna o resultado diretamente
  } catch (error) {
    logMessage(`Erro: ${error.message}`);
    showError("Falha ao processar o endpoint.");
  }
};

// Função genérica para verificar o status de execução
const checkExecutionStatus = async (executionId, accessToken, endpoint) => {
  logMessage(`Verificando o status da execução para o ID: ${executionId}`);
  executionId = executionId.replace(/['"]+/g, '');

  while (true) {
    const response = await fetch(CORS_PROXY + endpoint + '/' + executionId, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      logMessage(`Erro ao verificar status: ${response.status}`);
      throw new Error('Erro ao verificar o status da execução');
    }

    const data = await response.json();
    logMessage(`Status da execução: ${JSON.stringify(data)}`);

    const { execution_percentage, status } = data.progress;

    document.getElementById('progressPercentage').innerText = (execution_percentage * 100).toFixed(0);

    if (execution_percentage === 1.0 && status === 'COMPLETED') {
      logMessage('Execução completada com sucesso!');
      return data.result;
    }

    logMessage(`Progresso: ${(execution_percentage * 100).toFixed(0)}%. Aguardando...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
};

// Função para gerenciar erros
const showError = (message) => {
  document.getElementById('alert').style.display = 'block';
  document.getElementById('alertDescription').innerText = message;
};

// Função principal para o botão de "Release Notes"
document.getElementById('releaseNotesButton').addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value;
  const generatedResult = document.getElementById('generatedResult');
  document.getElementById('alert').style.display = 'none';
  generatedResult.value = '';

  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      const executionId = await processTask('/release-notes', accessToken, inputText);
      if (executionId) {
        const result = await checkExecutionStatus(executionId, accessToken, '/release-notes');
        generatedResult.value = result || "Release notes gerado com sucesso!";
      }
    } catch (error) {
      logMessage(`Erro: ${error.message}`);
      showError("Falha ao verificar o status da execução.");
    }
  }
});

// Função principal para o botão de "Code Review"
document.getElementById('codeReviewButton').addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value;
  const generatedResult = document.getElementById('generatedResult');
  document.getElementById('alert').style.display = 'none';
  generatedResult.value = '';

  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      const executionId = await processTask('/codereview', accessToken, inputText);
      if (executionId) {
        const result = await checkExecutionStatus(executionId, accessToken, '/codereview');
        generatedResult.value = result || "Code review gerado com sucesso!";
      }
    } catch (error) {
      logMessage(`Erro: ${error.message}`);
      showError("Falha ao verificar o status da execução.");
    }
  }
});
