# Web, Android e Windows

O mesmo aplicativo e a mesma autenticação/banco Supabase são usados nas três plataformas. O código do navegador continua sendo a aplicação principal; Capacitor o empacota para Android e Electron o executa como programa Windows.

## Supabase: configuração única antes de ativar convites e FCM

1. No SQL Editor do projeto Supabase, execute `supabase/native_push_devices.sql`. Execute também `supabase/push_subscriptions.sql` caso Web Push ainda não tenha essa tabela.
2. Implante as funções `send-push` e `admin-create-user` com a Supabase CLI:

   ```sh
   supabase functions deploy send-push --use-api --no-verify-jwt --project-ref aijkbluzpmffmnflhjyv
   supabase functions deploy admin-create-user --use-api --no-verify-jwt --project-ref aijkbluzpmffmnflhjyv
   ```

   As duas funções validam a sessão no servidor com `auth.getUser` e verificam o perfil e as permissões. Nesta configuração, a autenticação é feita pelas próprias funções, inclusive para JWTs com ES256: `--no-verify-jwt` desliga somente a checagem adicional do gateway, não a autenticação implementada nas funções. Não use esse parâmetro em funções que não validem suas próprias credenciais. `--use-api` permite empacotar pelo servidor sem Docker.

3. Configure os secrets das Edge Functions no Supabase (Dashboard ou fluxo seguro da CLI): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e, opcionalmente, `VAPID_SUBJECT`; para Android, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` e `FCM_PRIVATE_KEY`. As chaves privadas ficam somente no Supabase, nunca no navegador nem no APK. A chave pública VAPID do site deve corresponder ao par configurado no Supabase. Se o projeto já usa Web Push, preserve o par VAPID existente em vez de gerar outro.
4. No Firebase, habilite Firebase Cloud Messaging e a API HTTP v1. Registre o aplicativo Android com o identificador `com.sistemamanutencao.app`, baixe o `google-services.json` correspondente e coloque-o em `android/app/google-services.json`. Configure uma conta de serviço com permissão de envio FCM e guarde a chave privada nos secrets do Supabase.
5. Configure no Supabase Auth o envio de convites por e-mail e a URL de redirecionamento usada pelos usuários convidados. A função `admin-create-user` valida o administrador e a organização no servidor; não usa a chave de serviço no cliente.

Tokens nativos são associados ao usuário autenticado e removidos no logout. O Android usa o canal `maintenance_calls_v1`, som do recurso local e vibração. Android permite que a pessoa altere som/vibração do canal nas configurações do aparelho.

## Android

Requisitos: Node.js, pnpm, JDK compatível com a versão do Gradle do projeto, Android SDK e `ANDROID_HOME` ou `ANDROID_SDK_ROOT`. O arquivo `google-services.json` é necessário para o registro e a entrega FCM.

```sh
pnpm --filter @workspace/manutencao-android install
pnpm --filter @workspace/manutencao-android run android:sync
pnpm --filter @workspace/manutencao-android run android:apk
```

O APK de depuração é copiado para `artifacts/manutencao-android/release/Sistema-de-Manutencao-debug.apk`. Ele serve para instalação e teste; publicação na Play Store exige uma chave de assinatura de release, configuração de assinatura local segura e testes em aparelho real. Não distribua um APK debug como release.

## Windows

Requisitos: Node.js e pnpm. Gere o instalador NSIS x64 em uma máquina Windows:

```sh
pnpm --filter @workspace/manutencao-android install
pnpm --filter @workspace/manutencao-android run windows:exe
```

Os arquivos de instalação são gravados em `artifacts/manutencao-android/release/`. O EXE usa o ícone configurado para o programa, atalhos e instalador. Distribuição pública deve ser assinada com certificado de código da organização para reduzir alertas do Windows; nenhuma chave de assinatura deve ser incluída no repositório.

## Compilação automatizada

O workflow manual `.github/workflows/native-builds.yml` permite compilar Windows em um runner Windows e Android em um runner com SDK/JDK, quando o repositório estiver no GitHub. Para Android, configure o secret `GOOGLE_SERVICES_JSON_BASE64` com o arquivo Firebase do aplicativo codificado em base64. Esse arquivo não contém a chave privada da conta de serviço FCM; essa chave continua somente no Supabase.

Envios de código para branches `native-builds/**` executam somente a compilação Windows, sem depender do Firebase. Alterações somente em documentos Markdown ou no arquivo do workflow não disparam essa compilação automática; nesses casos, use a execução manual com a plataforma desejada. Use uma branch separada para preparar os pacotes sem alterar a publicação existente do GitHub Pages. O resultado fica nos artifacts da execução do GitHub Actions; uma compilação bem-sucedida não substitui a instalação e os testes em Windows real.

O ambiente Linux usado nesta revisão não possui Android SDK/JDK. A tentativa de finalizar NSIS com Wine também foi bloqueada pelos serviços RPCSS do container. O instalador NSIS e o APK debug foram posteriormente gerados com sucesso pelos runners do GitHub Actions; isso comprova a compilação, não a instalação nem o funcionamento com uma conta real.

### APK Android gerado

- [Baixar o novo artifact Android 1.0.1 no GitHub Actions](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38183785485/artifacts/11717644689). É necessário estar conectado ao GitHub; os artifacts seguem a retenção do repositório.
- Arquivo dentro do ZIP: `Sistema-de-Manutencao-debug.apk`.
- SHA-256 do APK: `7873b165cb8863a3cf1b71b02912a1a757041db13e501047e61c199885ec8ff0`.
- Validado: 20 testes controlados e TypeScript aprovados no runner Android, ZIP sem corrupção, `applicationId` correto, versão 1.0.1, novo canal no manifesto, 15/15 imagens PNG do launcher idênticas às fontes e certificado persistente presente. Nenhum arquivo privado de assinatura foi empacotado.
- É um APK debug para testes, não uma release para distribuição pública ou Play Store.
- Na versão anterior, instalação e login como mecânico foram confirmados pelo usuário em Android real. O servidor confirmou os dispositivos dos perfis mecânico e setor, e o usuário confirmou o recebimento de novos chamados e atualizações, porém sem som nos dois aparelhos.
- Na nova versão, o usuário confirmou instalação, login, ativação e ícones na tela inicial dos dois celulares. Após a orientação de configuração Samsung, confirmou os avisos reais com som, vibração e abertura do chamado correto: criação no A15 e aceite no A12 em segundo plano e fechado pelos recentes, além de solicitação de peça no A12 fechado. Também confirmou o aviso do Windows com o programa na bandeja e o clique abrindo o chamado correto. Ainda faltam os ícones do Windows, convites, operações por perfil e histórico.
- Este novo APK inclui o ajuste das consultas de peças para `requested_at` e cria o canal `maintenance_calls_v2` com importância alta, vibração e som padrão do Android. O canal anterior e seus recursos foram preservados. A instalação e os avisos reais com áudio foram confirmados nos dois aparelhos após configurar as categorias Samsung.
- A assinatura de debug agora é persistente e fica em um secret do GitHub Actions, fora do código. Conferido que o primeiro APK e o novo possuem assinaturas diferentes; será necessário remover a versão antiga para esta primeira atualização. Isso apaga a sessão e as preferências locais do aplicativo, não os dados no servidor; salve alterações pendentes antes e depois entre e ative as notificações novamente nos dois celulares. Futuras compilações utilizam a mesma assinatura protegida. A publicação correspondente no Supabase foi concluída.

### Backend configurado e verificado

- Aplicados os scripts `native_push_devices.sql` e `push_subscriptions.sql` em uma transação, sem exclusão dos registros existentes.
- As duas tabelas estão com RLS habilitada. A tabela Android tem as quatro políticas de acesso ao próprio dispositivo; a configuração Web Push existente foi preservada.
- Implantadas e ativas as funções `send-push` e `admin-create-user`.
- Preservadas as credenciais VAPID existentes; o digest da chave pública configurada corresponde à chave pública utilizada no aplicativo.
- Verificados nos endpoints reais, para as duas funções: preflight CORS com HTTP 200, método GET rejeitado com HTTP 405, ausência de credenciais e sessão inválida rejeitadas com HTTP 401.
- Esses testes não criaram usuários, não enviaram convites e não geraram notificações. Ainda faltam validação autenticada por perfil e testes em aparelhos reais.
- No teste real em segundo plano, o usuário informou que não recebeu avisos de criação nem atualização de chamados, sem som. A investigação confirmou chamadas à função com HTTP 200, mas nenhum Android cadastrado como mecânico para receber novos chamados; o dispositivo existente estava associado ao perfil setor. O token desse dispositivo foi aceito na validação FCM sem entrega. Ainda é necessário confirmar o perfil aberto no aparelho e corrigir ou validar sua associação antes de repetir o teste.
- O usuário esclareceu que utiliza dois celulares distintos: um como mecânico e outro como setor. Portanto, o cadastro do setor não comprova o registro do celular mecânico. Os registros consultados não mostraram erros de FCM ou de RLS; mostraram uma exclusão de cadastro de dispositivo seguida de registros do setor. A próxima etapa é ativar novamente as notificações no celular mecânico e confirmar seu cadastro no servidor.
- O usuário relatou vibração sem som no setor e ausência de som/vibração no mecânico, sem confirmar o resultado da ativação neste último. Enviada uma única mensagem FCM identificada como “Teste técnico de notificação” ao único dispositivo do setor cadastrado: HTTP 200, sem mudanças nos chamados ou no banco. O recebimento físico e o áudio desse teste ainda não foram confirmados. O recurso WAV contém áudio PCM válido e o plugin instalado aceita seu nome com extensão; não foi identificada falha de nome do arquivo de som.
- O usuário confirmou que a mensagem técnica chegou ao setor, sem som, e que a ativação no celular mecânico exibiu “Notificações Android ativadas”. A nova consulta ao servidor confirmou dois dispositivos distintos cadastrados: um mecânico e um setor. O recebimento de novos chamados no mecânico após essa ativação, as atualizações no setor e o áudio em ambos ainda precisam ser confirmados; verificar o som efetivamente selecionado nas configurações de cada canal Android.
- O usuário confirmou posteriormente a entrega do novo chamado ao mecânico e do aviso de chamado aceito ao setor, ambos sem som. Preparado o novo APK com canal de som padrão e o ajuste correspondente em `send-push`. As primeiras tentativas de publicação foram recusadas com HTTP 403 por falta das permissões de Edge Functions. O token de publicação foi posteriormente atualizado pelo fluxo seguro e o bloqueio foi resolvido, sem alterar os dados dos chamados.
- Publicada e confirmada **ACTIVE** a versão 11 de `send-push`. A fonte baixada pela CLI é idêntica à fonte local com o canal `maintenance_calls_v2`, som padrão e vibração. Preflight retornou HTTP 200 e requisição sem sessão HTTP 401. O Firebase aceitou o novo payload com HTTP 200 usando `validate_only: true`, sem enviar mensagens reais. Isso não comprova o som nos aparelhos: reinstalar o novo APK, entrar e reativar as notificações nos dois celulares antes do próximo teste físico.
- Para futuras publicações, manter um token limitado ao projeto com **Edge Functions — Read-write**, separado do token de consulta. Não é necessário ampliar acesso ao banco para publicar a função.
- Após a reinstalação, a consulta confirmou um dispositivo recém-registrado para cada perfil, mecânico e setor. Os registros de envio de criação e atualização mostraram `native_sent: 1` e `failed: 0`. Isso indica aceitação pelo Firebase, não comprova áudio físico. Antes de gerar outro APK, verificar nas configurações do canal “Chamados e atualizações — som padrão” se está em modo de alerta e se há um toque audível selecionado, além do volume de notificações e Não perturbe.
- Os aparelhos informados para os testes são Samsung Galaxy A15 (mecânico) e A12 (setor). O usuário não encontrou as categorias/opções de som. Nas versões Samsung com esse controle, habilitar **Configurações → Notificações → Configurações avançadas → Gerenciar categorias de notificações para cada aplicativo** e depois abrir **Aplicativos → Sistema de Manutenção → Notificações → Categorias de notificações**. Tocar no nome da categoria para acessar Alerta e Som; o interruptor ao lado apenas permite/bloqueia a categoria. Em versões anteriores, acessar diretamente as categorias do aplicativo. Isso é orientação de configuração, não confirmação de que o som foi corrigido.
- Ao responder à etapa de configuração/prévia, o usuário informou “Deu certo funcionou” nos dois aparelhos. Próxima validação: avisos de criação, atualização e peça com aplicativo em segundo plano e fechado pelos recentes, incluindo som, vibração e toque abrindo o chamado correto. Não considerar a confirmação da prévia como conclusão dessa validação.
- Na validação posterior dos eventos reais, o usuário confirmou sucesso completo para novos chamados no Galaxy A15 e avisos de aceite no Galaxy A12, ambos em segundo plano e fechados pelos recentes. Também confirmou a solicitação de peça no A12 fechado: recebimento com som, vibração e toque abrindo o chamado correto. Esses resultados são confirmações em aparelhos reais do usuário, não inferências dos testes controlados nem do HTTP 200 do Firebase.
- Configuradas as três credenciais FCM no Supabase a partir da conta de serviço, conferindo que o projeto corresponde ao Firebase do APK e que os digests dos valores configurados correspondem aos fornecidos pelo fluxo seguro.
- A autorização OAuth e a requisição FCM HTTP v1 com o payload Android foram aceitas com HTTP 200. A requisição usou `validate_only: true`: nenhuma mensagem foi entregue, e esse resultado não comprova recebimento em um dispositivo.
- O `google-services.json` usado na compilação identifica o aplicativo, mas não substitui a credencial administrativa FCM. Nenhuma chave privada foi incluída nos pacotes ou no repositório.
- A URL de retorno de convites do Supabase Auth foi preservada. O funcionamento do convite e da definição de senha no endereço configurado ainda precisa ser validado.

### Instalador Windows gerado

- [Baixar o artifact Windows corrigido no GitHub Actions](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38179548855/artifacts/11716403857). É necessário estar conectado ao GitHub; os artifacts seguem a retenção do repositório.
- Arquivo dentro do ZIP: `Sistema de Manutenção-1.0.1-x64.exe`.
- SHA-256 do EXE: `3f4fda9a5aac9223e07d92782583a192a000813b54bbd41c1927c8e75ef4917e`.
- Os 18 testes locais e o TypeScript passaram no runner Windows. Os testes são controlados/estáticos e não substituem o login real.
- Corrigido o User-Agent do Electron para usar somente ASCII. Os registros da versão anterior mostraram bytes Latin-1 do nome “Manutenção” sendo rejeitados durante a criação da sessão no Supabase. O nome visível, os ícones e a autenticação existente foram preservados.
- Corrigidas as consultas de peças para usar o campo existente `requested_at`, sem alterar o banco. O alias usado pela interface foi validado no endpoint PostgREST com HTTP 200, sem consultar registros reais.
- A instalação da versão anterior foi confirmada pelo usuário, mas o login falhou. O usuário confirmou o login no Windows após instalar a versão 1.0.1 e depois confirmou o recebimento de aviso com o programa na bandeja, com o clique abrindo o chamado correto. Ainda faltam confirmação dos ícones do Windows, convites, operações por perfil e histórico. Não há assinatura de código para distribuição pública.
- Antes de instalar a atualização, feche o programa pelo menu **Sair** na bandeja do Windows; o botão de fechar a janela apenas minimiza o aplicativo. Não é necessário redefinir senhas nem apagar os dados do sistema.

### Configuração Firebase para o APK

Registre no Firebase o aplicativo Android `com.sistemamanutencao.app`. A partir do `google-services.json` baixado, obtenha o base64 no seu computador:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\google-services.json"))
```

Guarde o resultado como secret `GOOGLE_SERVICES_JSON_BASE64` no GitHub Actions ou no formulário seguro solicitado pelo agente. Não envie o resultado pelo chat. Para configurar esse secret por automação, o token GitHub precisa de permissão de leitura e escrita em **Secrets**, além de **Contents**, **Workflows** e **Actions**. O JSON do aplicativo não substitui a conta de serviço FCM nem os secrets das funções Supabase.

## Verificação

`pnpm --filter @workspace/manutencao-android test` e `typecheck` verificam o código local. A entrega FCM requer teste com um Android instalado, usuário inscrito e o app em primeiro plano, segundo plano e fechado pela lista de recentes. Não confunda esse último estado com **Forçar parada** nas configurações do Android: o sistema impede o recebimento de Push de um aplicativo forçado a parar até ele ser aberto novamente. Convites exigem testar uma conta administradora e confirmar o e-mail recebido. O Windows requer executar o instalador em uma máquina Windows para verificar atalhos, ícone e notificações.

### Roteiro em aparelhos reais — ainda pendente

Use contas autorizadas dos perfis administrador, mecânico e setor. Identifique quaisquer registros criados para teste e não exclua nem altere chamados, usuários ou histórico reais.

- [x] Android: instalar o APK debug e entrar com uma conta mecânica ativa; registro do dispositivo confirmado no servidor.
- [x] Android: reinstalar a nova versão 1.0.1 nos dois celulares, entrar nos respectivos perfis e reativar as notificações; confirmação do usuário e novos cadastros no servidor.
- [x] Android: conferir o ícone na tela inicial dos dois celulares; confirmado pelo usuário.
- [x] Android: confirmar permissões e configurar o canal para alerta e som nos dois Samsung.
- [x] Windows: instalar o EXE corrigido e entrar com uma conta autorizada; login confirmado pelo usuário.
- [ ] Windows: conferir os ícones do instalador, atalhos e aplicativo.
- [ ] Administrador: convidar uma conta de teste, confirmar o recebimento do e-mail, definir a senha pelo link e entrar com a nova senha.
- [ ] Perfis: verificar criação, leitura, edição e exclusão onde permitidas pelas regras existentes; confirmar que operações proibidas são rejeitadas e que o histórico permanece correto.
- [x] Setor: criar um chamado identificado como teste e conferir a notificação no Android mecânico.
- [x] Mecânico: aceitar e atualizar o chamado, solicitar uma peça e conferir os avisos aos destinatários previstos.
- [x] Android: criação e aceite em segundo plano e fechados pelos recentes; solicitação de peça com setor fechado. Som, vibração e abertura do chamado correto confirmados pelo usuário.
- [x] Windows: aviso com o programa na bandeja e clique abrindo o chamado correto; confirmado pelo usuário.

Registre o resultado por etapa e eventuais mensagens de erro sem compartilhar senhas, tokens ou conteúdo privado. Compilação, inspeção dos recursos, testes estáticos e validação FCM sem entrega não substituem esse roteiro.
