# Checklista: Diagnosticar Por Que Google Drive Não Está Salvando

## O Problema
- ✓ Uploads funcionam (arquivo é criado)
- ✗ Google Drive vazio (arquivo não aparece lá)
- ✗ Download falha depois (arquivo desaparece após 1 hora)

## Por Que Isso Acontece?

Google Drive provavelmente **NÃO está realmente salvando** — o upload está:
1. Tentando Google Drive → FALHA
2. Fazendo fallback para disco local → SUCESSO (por isso funciona no momento)
3. Arquivo salvo em disco local do Render → DELETADO no próximo deploy (por falta de Persistent Disk)

## Solução: Ver os Logs do Render

### Passo 1: Abra Dashboard Render
- URL: https://dashboard.render.com
- Selecione sua service **backend** (grupogel)

### Passo 2: Abra Aba "Logs"
- Você verá todos os eventos em tempo real

### Passo 3: Reproduza o Upload
- No seu app, faça um **NOVO upload**
- Anote a **hora exata**

### Passo 4: Procure pelos Logs
- Na seção de logs, procure por: `[GDRIVE]`
- Você deve ver algo como:
  ```
  [GDRIVE] Tentando Google Drive...
  [GDRIVE] ✓ Google Drive OK: ...
  ```
  ou
  ```
  [GDRIVE] Tentando Google Drive...
  [GDRIVE] Google Drive falhou: ...
  ```

### Passo 5: Envie os Logs
- Copie as linhas com `[GDRIVE]` aqui
- Envie também a mensagem de erro (se houver)

## Se Não Tem `[GDRIVE]` nos Logs?

Significa que o código ainda não está sendo executado. Isso que dizer:
- Deploy ainda está em progresso
- Ou o novo código ainda não foi registrado

**Solução:** Aguarde 5-10 minutos e tente novamente.

## Se Tem `[GDRIVE] ... falhou` nos Logs?

Existem algumas causas prováveis:

1. **GOOGLE_CREDENTIALS_JSON está malformado**
   - Causa: JSON inválido no Render
   - Solução: Eu refaço o setup

2. **Pasta do Google Drive não tem permissão**
   - Causa: Folder `1VM14mNsCX_022womJSTK9szseuitwstv` não tem acesso de escrita
   - Solução: Cria nova pasta e configura no Render

3. **Token expirou**
   - Causa: `GOOGLE_TOKEN_JSON` venceu
   - Solução: Renovar token via script

---

## ALTERNATIVA: Usar Persistent Disk (mais simples)

Se Google Drive continuar não funcionando, eu configuro **Persistent Disk** para você (5 minutos):

1. Dashboard Render → **Environment** → **Disks** → **+ Add Disk**
   - Name: `uploads`
   - Mount Path: `/app/backend/persistent_uploads`
   - Size: `10 GB`

2. **Environment Variables** → **+ Add**:
   - Key: `BACKEND_UPLOADS_DIR`
   - Value: `/app/backend/persistent_uploads`

Pronto! Uploads persistem permanentemente.

---

## Ação Imediata

1. **Aguarde 5 minutos**
2. **Va a Render Dashboard → Logs**
3. **Faça um novo upload**
4. **Procure por `[GDRIVE]` nos logs**
5. **Envie aqui as linhas que encontrar**

