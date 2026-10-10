# Sistema de Manutenção

Aplicação web/PWA existente, usando o Supabase para autenticação, banco de dados,
armazenamento de fotos e funções. O ponto de entrada é `index.html`; os módulos
de chamados, perfis, equipamentos, peças, histórico e manutenção preventiva
foram mantidos.

## Correção de login

Os scripts principais de `index.html` e `app.html` continham os caracteres
literais `\n` no meio de uma instrução JavaScript. Isso causava erro de sintaxe
e impedia a execução do restante do script. O login agora usa
`sb.auth.signInWithPassword` em um único fluxo e a sessão é persistida pelo
cliente oficial do Supabase. Sessões antigas salvas pelos arquivos anteriores
são migradas uma única vez.

Depois da autenticação, a aplicação consulta `public.profiles` pelo ID do
usuário. Se não houver um perfil acessível ou a política RLS bloquear a leitura,
o sistema agora mostra essa causa sem confundi-la com senha inválida.

## Testes

Na raiz do workspace:

```sh
pnpm --filter @workspace/manutencao-android test
pnpm --filter @workspace/manutencao-android run build
```

Os testes compilam todos os scripts inline e simulam login aceito e recusado
nos dois pontos de entrada. Eles não substituem um teste com uma conta real do
Supabase.

## Instalação no Android

Este projeto é uma PWA instalável; não é um pacote APK. Publique-o em um domínio
HTTPS, abra o endereço no Chrome do Android e toque em **Instalar app**. Se o
Chrome não mostrar o prompt, use o menu ⋮ e escolha **Instalar app** ou
**Adicionar à tela inicial**. O manifest e os ícones já estão configurados, e o
service worker guarda apenas arquivos estáticos do app — nunca respostas da
API/Supabase ou dados autenticados.

## Desenvolvimento

```sh
pnpm --filter @workspace/manutencao-android run dev
```

