# Configuração do Google Drive - GeoTransportes

## Problema Identificado
As entregas estavam parando de sincronizar com o Google Drive porque o arquivo `google-credentials.json` não foi encontrado.

## Solução Implementada
O sistema agora:
✅ Detecta quando o Google Drive não está configurado
✅ Faz fallback automático para armazenamento local
✅ Continua salvando documentos normalmente no disco local

## Como Configurar o Google Drive (Opcional)

Se você deseja continuar salvando no Google Drive, siga estes passos:

### 1. Crie um Projeto no Google Cloud Console
- Acesse: https://console.cloud.google.com
- Crie um novo projeto
- Ative a API do Google Drive

### 2. Crie uma Service Account
- Vá para "Service Accounts"
- Crie uma nova Service Account
- Gere uma chave JSON
- Salve o JSON como `google-credentials.json`

### 3. Coloque o Arquivo
Copie o arquivo `google-credentials.json` para:
```
/backend/google-credentials.json
```

Ou no diretório raiz do projeto:
```
/google-credentials.json
```

### 4. Crie o Arquivo de Token
Crie um arquivo `google-token.json` com conteúdo vazio `{}`:
```
/backend/google-token.json
```

### 5. Compartilhe sua Pasta do Drive
- Obtenha o ID da pasta no Google Drive
- Adicione-o a `.env` como:
```
GDRIVE_FOLDER_ID=seu_id_da_pasta_aqui
```

- Compartilhe a pasta com a Service Account (use o email da conta de serviço)

## Status Atual
- 📦 **Entregas**: Salvando localmente em `backend/uploads/`
- 📄 **Documentos**: Salvando localmente com fallback automático
- 🔄 **Google Drive**: Desativado (arquivo de credenciais não encontrado)

## Próximos Passos
1. ✅ Sistema continua funcionando normalmente
2. ⏳ Documentos são salvos em `persistent_uploads/` e `backend/uploads/`
3. 📱 Você pode acessar os documentos através da interface web normalmente

**Nenhuma ação urgente necessária - o sistema está funcionando em modo local!**
