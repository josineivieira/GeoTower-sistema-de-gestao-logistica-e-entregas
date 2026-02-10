# Configuração de Persistent Disk no Render

Para que seus uploads sejam salvos permanentemente (mesmo após deploy/atualizações), siga estes passos:

## Passo 1: Montar Persistent Disk no Render

1. Acesse o dashboard do Render: https://dashboard.render.com
2. Selecione sua service backend (**grupogel**)
3. Vá em **Environment** → **Disks** (ou **Filesystem**)
4. Clique em **+ Add Disk**
   - **Name**: `uploads`
   - **Mount Path**: `/app/backend/persistent_uploads`
   - **Size**: 10 GB (ou conforme necessário)
5. Clique em **Save**

O Render reiniciará seu serviço automaticamente.

## Passo 2: Configurar Variável de Ambiente

1. Na mesma service, vá em **Environment**
2. Clique em **+ Add Environment Variable**
   - **Key**: `BACKEND_UPLOADS_DIR`
   - **Value**: `/app/backend/persistent_uploads`
3. Clique em **Save**

O Render reiniciará seu serviço.

## Passo 3: Testar

1. Faça login no app em https://entregasperfeitas.onrender.com
2. Upload um arquivo em qualquer entrega
3. O arquivo será salvo em `/app/backend/persistent_uploads`
4. Faça um deploy novo (git push) — o arquivo deve continuar lá
5. Teste o download — deve funcionar agora

## Alternativa: Usar Google Drive (já configurado)

Se preferir não montar Persistent Disk, você pode:
- Usar a integração Google Drive já pronta no seu código
- Os uploads vão direto para seu Google Drive (mais seguro e não ocupa espaço do Render)
- Basta garantir que `GOOGLE_CREDENTIALS_JSON` e `GOOGLE_TOKEN_JSON` estão configurados (já estão)

## Verificar se Está Funcionando

Após configurar, rode este comando para confirmar que `BACKEND_UPLOADS_DIR` está ativo:

```bash
curl -H "Authorization: Bearer <TOKEN>" https://grupogel.onrender.com/api/admin/deliveries
```

Os novos uploads deverão aparecer no disco persistente.

---

**Dúvidas?** O código já está preparado para usar `BACKEND_UPLOADS_DIR` — basta montar o disco e configurar a variável no Render.
